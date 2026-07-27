import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HorarioPeriodo } from './entities/horario-periodo.entity';
import { HorarioBlock } from './entities/horario-block.entity';
import { HORARIO_ASSIGNMENTS_SEED } from './horarios-assignments-seed.data';
import { HORARIO_BLOCKS_SEED } from './horarios-blocks-seed.data';
import {
  CreateHorarioBlockDto,
  ResolveHorarioConflictsDto,
  UpdateHorarioBlockDto,
} from './dto/horario.dto';
import { CurriculaService } from '../curricula/curricula.service';
import { Salon } from '../maestros/salones/entities/salon.entity';
import { CurriculumTeacherAssignment } from '../curricula/entities/curriculum-teacher-assignment.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import {
  normalizeGradoMatricula,
} from '../maestros/salones/salones.util';

export interface HorarioPeriodoResponse {
  id: number;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  isReceso: boolean;
  niveles: string[];
}

export interface HorarioBlockResponse {
  id: number;
  anioEscolar: number;
  nivel: string;
  grado: string;
  seccion: string;
  dia: number;
  periodoId: number;
  cursoId: number;
  docenteId: number;
}

export interface HorarioCursoItem {
  id: number;
  nombre: string;
  area: string;
  nivel: string;
}

export interface HorarioDocenteItem {
  id: number;
  apellidos: string;
  nombres: string;
  abrev: string;
}

export interface HorarioClaseItem {
  nivel: string;
  grado: string;
  seccion: string;
}

export interface HorarioConflictoItem {
  key: string;
  tipo: 'docente_solapado' | 'asignacion_invalida';
  dia: number;
  periodoId: number;
  docenteId: number;
  docNombre: string;
  entradas: HorarioBlockResponse[];
}

export interface HorarioGestionClase {
  nivel: string;
  grado: string;
  seccion: string;
  key: string;
  totalSlots: number;
  filled: number;
  estado: 'completo' | 'en_progreso' | 'sin_horario';
}

export interface HorarioContextResponse {
  anioEscolar: number;
  periodos: HorarioPeriodoResponse[];
  salones: HorarioClaseItem[];
  cursos: HorarioCursoItem[];
  docentes: HorarioDocenteItem[];
  blocks: HorarioBlockResponse[];
  conflictos: HorarioConflictoItem[];
  gestion: {
    conHorario: number;
    enProgreso: number;
    sinHorario: number;
    clases: HorarioGestionClase[];
  };
}

@Injectable()
export class HorariosService {
  constructor(
    @InjectRepository(HorarioPeriodo)
    private readonly periodoRepo: Repository<HorarioPeriodo>,
    @InjectRepository(HorarioBlock)
    private readonly blockRepo: Repository<HorarioBlock>,
    @InjectRepository(Salon)
    private readonly salonRepo: Repository<Salon>,
    @InjectRepository(CurriculumTeacherAssignment)
    private readonly assignmentRepo: Repository<CurriculumTeacherAssignment>,
    @InjectRepository(Docente)
    private readonly docenteRepo: Repository<Docente>,
    private readonly curriculaService: CurriculaService,
  ) {}

  /** Solo desarrollo: preferir npm run db:horarios-data para cargar datos en PostgreSQL. */
  async seedDemoHorarios(
    anioEscolar: number,
    force = false,
  ): Promise<{ blocks: number; reseeded: boolean }> {
    const existing = await this.blockRepo.count({ where: { anioEscolar } });
    if (existing > 0 && !force) return { blocks: existing, reseeded: false };

    if (force && existing > 0) {
      await this.blockRepo.delete({ anioEscolar });
    }

    await this.ensureHorarioAssignments(anioEscolar);
    const inserted = await this.seedHorarioBlocks(anioEscolar);
    if (inserted > 0) {
      console.log(`[horarios] ${inserted} bloques demo insertados para A.E. ${anioEscolar}`);
    }
    return { blocks: inserted || existing, reseeded: inserted > 0 };
  }

  async getPeriodosForYear(anioEscolar: number): Promise<HorarioPeriodo[]> {
    const periodos = await this.periodoRepo.find({
      where: { anioEscolar, activo: true },
      order: { orden: 'ASC' },
    });
    if (!periodos.length) {
      throw new BadRequestException(
        `No hay períodos horario para A.E. ${anioEscolar}. Ejecute: npm run db:horarios-data`,
      );
    }
    return periodos;
  }

  /** @deprecated Usar getPeriodosForYear. Mantenido por compatibilidad interna. */
  async ensurePeriodos(anioEscolar: number): Promise<HorarioPeriodo[]> {
    return this.getPeriodosForYear(anioEscolar);
  }

  async getContext(anioEscolar: number): Promise<HorarioContextResponse> {
    const periodosDb = await this.ensurePeriodos(anioEscolar);
    const periodos = periodosDb.map((p) => this.mapPeriodo(p));

    const asignacionCtx = await this.curriculaService.getAsignacionContext(
      anioEscolar,
    );

    const salones = await this.salonRepo.find({
      where: { anioEscolar, activo: true },
      order: { nivel: 'ASC', grado: 'ASC', seccion: 'ASC' },
    });

    const blocksDb = await this.blockRepo.find({
      where: { anioEscolar, activo: true },
      order: { id: 'ASC' },
    });
    const blocks = blocksDb.map((b) => this.mapBlock(b));

    const cursos = asignacionCtx.cursos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      area: c.area,
      nivel: c.nivel,
    }));

    const docentes = asignacionCtx.docentes
      .filter((d) => d.activo)
      .map((d) => ({
        id: d.id,
        apellidos: d.apellidos,
        nombres: d.nombres,
        abrev: this.abrevDocente(d.nombres, d.apellidos),
      }));

    const docMap = new Map(docentes.map((d) => [d.id, d]));

    const assignments = await this.assignmentRepo.find({
      where: { activo: true },
    });

    const salonesItems = this.mergeClasesAula(
      salones.map((s) => ({
        nivel: s.nivel,
        grado: normalizeGradoMatricula(s.grado),
        seccion: s.seccion.trim().toUpperCase(),
      })),
      blocks,
      asignacionCtx.seccionesPorGrado,
      assignments,
    );

    const conflictos = this.detectConflicts(blocks, docMap);

    const gestion = this.buildGestion(
      salonesItems,
      blocks,
      periodos,
    );

    return {
      anioEscolar,
      periodos,
      salones: salonesItems,
      cursos,
      docentes,
      blocks,
      conflictos,
      gestion,
    };
  }

  async createBlock(dto: CreateHorarioBlockDto): Promise<HorarioBlockResponse> {
    const payload: CreateHorarioBlockDto = {
      ...dto,
      grado: normalizeGradoMatricula(dto.grado),
      seccion: dto.seccion.trim().toUpperCase(),
    };
    await this.validateBlockRefs(payload);

    const periodos = await this.ensurePeriodos(payload.anioEscolar);
    const periodo = periodos.find((p) => p.id === payload.periodoId);
    if (!periodo) {
      throw new BadRequestException('Período horario no válido');
    }
    if (periodo.esReceso) {
      throw new BadRequestException('No se puede asignar clase en recreo');
    }
    if (!periodo.niveles.includes(payload.nivel)) {
      throw new BadRequestException(
        `El período no aplica al nivel ${payload.nivel}`,
      );
    }

    const dup = await this.blockRepo.findOne({
      where: {
        anioEscolar: payload.anioEscolar,
        nivel: payload.nivel,
        grado: payload.grado,
        seccion: payload.seccion,
        dia: payload.dia,
        periodoId: payload.periodoId,
        activo: true,
      },
    });
    if (dup) {
      throw new BadRequestException(
        'Ya existe una clase en ese horario para el aula',
      );
    }

    const saved = await this.blockRepo.save(
      this.blockRepo.create({ ...payload, activo: true }),
    );
    return this.mapBlock(saved);
  }

  async updateBlock(
    id: number,
    dto: UpdateHorarioBlockDto,
  ): Promise<HorarioBlockResponse> {
    const block = await this.blockRepo.findOneBy({ id });
    if (!block) throw new NotFoundException(`Bloque ${id} no encontrado`);

    if (dto.cursoId != null) block.cursoId = dto.cursoId;
    if (dto.docenteId != null) block.docenteId = dto.docenteId;
    if (dto.activo != null) block.activo = dto.activo;

    await this.validateBlockRefs({
      anioEscolar: block.anioEscolar,
      nivel: block.nivel,
      grado: block.grado,
      seccion: block.seccion,
      dia: block.dia,
      periodoId: block.periodoId,
      cursoId: block.cursoId,
      docenteId: block.docenteId,
    });

    const saved = await this.blockRepo.save(block);
    return this.mapBlock(saved);
  }

  async deleteBlock(id: number): Promise<{ ok: true }> {
    const block = await this.blockRepo.findOneBy({ id });
    if (!block) throw new NotFoundException(`Bloque ${id} no encontrado`);
    await this.blockRepo.remove(block);
    return { ok: true };
  }

  async resolveConflicts(
    dto: ResolveHorarioConflictsDto,
  ): Promise<{ removed: number; blocks: HorarioBlockResponse[] }> {
    const keep = await this.blockRepo.findOneBy({ id: dto.keepBlockId });
    if (!keep) {
      throw new NotFoundException(
        `Bloque a conservar ${dto.keepBlockId} no encontrado`,
      );
    }

    const toRemove = dto.removeBlockIds.filter((id) => id !== dto.keepBlockId);
    if (!toRemove.length) {
      throw new BadRequestException('No hay bloques para eliminar');
    }

    const blocks = await this.blockRepo.find({
      where: { id: In(toRemove) },
    });
    if (blocks.length !== toRemove.length) {
      throw new BadRequestException('Algunos bloques a eliminar no existen');
    }

    for (const b of blocks) {
      if (
        b.docenteId !== keep.docenteId ||
        b.dia !== keep.dia ||
        b.periodoId !== keep.periodoId
      ) {
        throw new BadRequestException(
          'Los bloques a eliminar deben ser del mismo conflicto (docente, día y período)',
        );
      }
    }

    await this.blockRepo.remove(blocks);

    const remaining = await this.blockRepo.find({
      where: { anioEscolar: keep.anioEscolar, activo: true },
      order: { id: 'ASC' },
    });

    return {
      removed: blocks.length,
      blocks: remaining.map((b) => this.mapBlock(b)),
    };
  }

  async getConflicts(anioEscolar: number): Promise<HorarioConflictoItem[]> {
    const ctx = await this.getContext(anioEscolar);
    return ctx.conflictos;
  }

  private async validateBlockRefs(dto: {
    anioEscolar: number;
    nivel: string;
    grado: string;
    seccion: string;
    dia: number;
    periodoId: number;
    cursoId: number;
    docenteId: number;
  }): Promise<void> {
    const ctx = await this.curriculaService.getAsignacionContext(
      dto.anioEscolar,
      dto.nivel,
    );
    const curso = ctx.cursos.find((c) => c.id === dto.cursoId);
    if (!curso) {
      throw new BadRequestException('Curso no encontrado en la currícula');
    }
    const docente = ctx.docentes.find((d) => d.id === dto.docenteId && d.activo);
    if (!docente) {
      throw new BadRequestException('Docente no encontrado o inactivo');
    }
  }

  private detectConflicts(
    blocks: HorarioBlockResponse[],
    docMap: Map<number, HorarioDocenteItem>,
  ): HorarioConflictoItem[] {
    const result: HorarioConflictoItem[] = [];
    const aulaKey = (b: HorarioBlockResponse) =>
      `${b.nivel}|${b.grado}|${b.seccion}`;

    const byDocSlot = new Map<string, HorarioBlockResponse[]>();
    for (const b of blocks) {
      const key = `${b.docenteId}-${b.dia}-${b.periodoId}`;
      if (!byDocSlot.has(key)) byDocSlot.set(key, []);
      byDocSlot.get(key)!.push(b);
    }

    for (const [key, entradas] of byDocSlot.entries()) {
      if (entradas.length <= 1) continue;
      const aulas = new Set(entradas.map(aulaKey));
      if (aulas.size < 2) continue;

      const parts = key.split('-');
      const periodoId = +parts.pop()!;
      const dia = +parts.pop()!;
      const docenteId = +parts.join('-');
      const doc = docMap.get(docenteId);
      result.push({
        key,
        tipo: 'docente_solapado',
        dia,
        periodoId,
        docenteId,
        docNombre: doc
          ? `${doc.apellidos}, ${doc.nombres}`
          : `Docente #${docenteId}`,
        entradas,
      });
    }

    return result;
  }

  private mergeClasesAula(
    salones: HorarioClaseItem[],
    blocks: HorarioBlockResponse[],
    seccionesPorGrado: Record<string, string[]>,
    assignments: CurriculumTeacherAssignment[],
  ): HorarioClaseItem[] {
    const seen = new Set<string>();
    const out: HorarioClaseItem[] = [];

    const push = (nivel: string, grado: string, seccion: string) => {
      const g = normalizeGradoMatricula(grado);
      const sec = seccion.trim().toUpperCase();
      if (!nivel?.trim() || !g || !sec) return;
      const key = `${nivel}|${g}|${sec}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ nivel: nivel.trim(), grado: g, seccion: sec });
    };

    for (const s of salones) push(s.nivel, s.grado, s.seccion);
    for (const b of blocks) push(b.nivel, b.grado, b.seccion);
    for (const [rawKey, secs] of Object.entries(seccionesPorGrado ?? {})) {
      const [nivel, grado] = rawKey.split('|');
      for (const sec of secs) push(nivel, grado, sec);
    }
    for (const a of assignments) {
      if (!a.activo) continue;
      for (const sec of a.secciones ?? []) push(a.nivel, a.grado, sec);
    }

    return out.sort(
      (a, b) =>
        a.nivel.localeCompare(b.nivel) ||
        a.grado.localeCompare(b.grado, 'es', { numeric: true }) ||
        a.seccion.localeCompare(b.seccion),
    );
  }

  private buildGestion(
    clases: HorarioClaseItem[],
    blocks: HorarioBlockResponse[],
    periodos: HorarioPeriodoResponse[],
  ): HorarioContextResponse['gestion'] {
    const slotsByNivel = new Map<string, number>();
    for (const p of periodos) {
      if (p.isReceso) continue;
      for (const n of p.niveles) {
        slotsByNivel.set(n, (slotsByNivel.get(n) ?? 0) + 5);
      }
    }

    let conHorario = 0;
    let enProgreso = 0;
    let sinHorario = 0;
    const clasesGestion: HorarioGestionClase[] = [];

    for (const cl of clases) {
      const totalSlots = slotsByNivel.get(cl.nivel) ?? 0;
      const filled = blocks.filter(
        (b) =>
          b.nivel === cl.nivel &&
          b.grado === cl.grado &&
          b.seccion === cl.seccion,
      ).length;
      let estado: HorarioGestionClase['estado'] = 'sin_horario';
      if (filled === 0) {
        sinHorario++;
      } else if (filled < totalSlots) {
        enProgreso++;
        estado = 'en_progreso';
      } else {
        conHorario++;
        estado = 'completo';
      }
      clasesGestion.push({
        ...cl,
        key: `${cl.nivel}-${cl.grado}-${cl.seccion}`,
        totalSlots,
        filled,
        estado,
      });
    }

    return { conHorario, enProgreso, sinHorario, clases: clasesGestion };
  }

  private fallbackClases(blocks: HorarioBlockResponse[]): HorarioClaseItem[] {
    const seen = new Set<string>();
    const out: HorarioClaseItem[] = [];
    for (const b of blocks) {
      const key = `${b.nivel}|${b.grado}|${b.seccion}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ nivel: b.nivel, grado: b.grado, seccion: b.seccion });
    }
    return out;
  }

  private mapPeriodo(p: HorarioPeriodo): HorarioPeriodoResponse {
    return {
      id: p.id,
      nombre: p.nombre,
      horaInicio: p.horaInicio,
      horaFin: p.horaFin,
      isReceso: p.esReceso,
      niveles: p.niveles,
    };
  }

  private mapBlock(b: HorarioBlock): HorarioBlockResponse {
    return {
      id: b.id,
      anioEscolar: b.anioEscolar,
      nivel: b.nivel,
      grado: normalizeGradoMatricula(b.grado),
      seccion: b.seccion.trim().toUpperCase(),
      dia: b.dia,
      periodoId: b.periodoId,
      cursoId: b.cursoId,
      docenteId: b.docenteId,
    };
  }

  private abrevDocente(nombres: string, apellidos: string): string {
    const ini = nombres.trim().charAt(0).toUpperCase();
    const ap = apellidos.trim().split(/\s+/)[0] ?? apellidos;
    return `${ini}. ${ap}`;
  }

  private async ensureHorarioAssignments(anioEscolar: number): Promise<void> {
    const ctx = await this.curriculaService.getAsignacionContext(anioEscolar);
    const curriculumByNivel = new Map(ctx.curriculas.map((c) => [c.nivel, c.id]));
    const cursoByKey = new Map(
      ctx.cursos.map((c) => [`${c.nivel}|${c.nombre}`, c.id]),
    );
    const docentes = await this.docenteRepo.find({
      where: { estado: 'activo' },
    });
    const docenteByUsername = new Map(docentes.map((d) => [d.username, d]));

    for (const seed of HORARIO_ASSIGNMENTS_SEED) {
      const docente = docenteByUsername.get(seed.docenteUsername);
      const cursoId = cursoByKey.get(`${seed.nivel}|${seed.cursoNombre}`);
      const curriculumId = curriculumByNivel.get(seed.nivel);
      if (!docente || !cursoId || !curriculumId) continue;

      const docenteNombre = `${docente.nombres} ${docente.apellidos}`;
      let row = await this.assignmentRepo.findOne({
        where: {
          cursoId,
          nivel: seed.nivel,
          grado: seed.grado,
          docenteId: docente.id,
          activo: true,
        },
      });

      if (row) {
        row.secciones = [...new Set([...row.secciones, ...seed.secciones])];
        row.docenteNombre = docenteNombre;
        await this.assignmentRepo.save(row);
        continue;
      }

      const orphan = await this.assignmentRepo.findOne({
        where: { cursoId, nivel: seed.nivel, grado: seed.grado, activo: true },
      });
      if (orphan && !orphan.docenteId) {
        orphan.docenteId = docente.id;
        orphan.docenteNombre = docenteNombre;
        orphan.secciones = seed.secciones;
        orphan.curriculumId = curriculumId;
        await this.assignmentRepo.save(orphan);
        continue;
      }

      const curso = ctx.cursos.find((c) => c.id === cursoId);
      await this.assignmentRepo.save(
        this.assignmentRepo.create({
          docenteId: docente.id,
          docenteNombre,
          cursoId,
          curriculumId,
          nivel: seed.nivel,
          grado: seed.grado,
          secciones: seed.secciones,
          horasSemanales: curso?.horasSemanales ?? 0,
          activo: true,
        }),
      );
    }
  }

  private async seedHorarioBlocks(anioEscolar: number): Promise<number> {
    const periodos = await this.ensurePeriodos(anioEscolar);
    const periodoIdByOrden = new Map(periodos.map((p) => [p.orden, p.id]));

    const ctx = await this.curriculaService.getAsignacionContext(anioEscolar);
    const cursoByKey = new Map(
      ctx.cursos.map((c) => [`${c.nivel}|${c.nombre}`, c.id]),
    );
    const docentes = await this.docenteRepo.find({
      where: { estado: 'activo' },
    });
    const docenteByUsername = new Map(docentes.map((d) => [d.username, d.id]));

    const toInsert: HorarioBlock[] = [];

    for (const slot of HORARIO_BLOCKS_SEED) {
      const periodoId = periodoIdByOrden.get(slot.periodoOrden);
      const cursoId = cursoByKey.get(`${slot.nivel}|${slot.cursoNombre}`);
      const docenteId = docenteByUsername.get(slot.docenteUsername);
      if (!periodoId || !cursoId || !docenteId) continue;

      const dup = await this.blockRepo.findOne({
        where: {
          anioEscolar,
          nivel: slot.nivel,
          grado: slot.grado,
          seccion: slot.seccion,
          dia: slot.dia,
          periodoId,
          activo: true,
        },
      });
      if (dup) continue;

      toInsert.push(
        this.blockRepo.create({
          anioEscolar,
          nivel: slot.nivel,
          grado: slot.grado,
          seccion: slot.seccion,
          dia: slot.dia,
          periodoId,
          cursoId,
          docenteId,
          activo: true,
        }),
      );
    }

    if (!toInsert.length) return 0;
    await this.blockRepo.save(toInsert);
    return toInsert.length;
  }
}
