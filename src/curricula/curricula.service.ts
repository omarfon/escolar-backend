import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, IsNull } from 'typeorm';
import { Curriculum } from './entities/curriculum.entity';
import { CurriculumArea } from './entities/curriculum-area.entity';
import { CurriculumSubject } from './entities/curriculum-subject.entity';
import { CurriculumCompetencia } from './entities/curriculum-competencia.entity';
import { CurriculumCapacidad } from './entities/curriculum-capacidad.entity';
import { CurriculumIndicador } from './entities/curriculum-indicador.entity';
import { CurriculumTeacherAssignment } from './entities/curriculum-teacher-assignment.entity';
import { MaestroCurso } from '../maestros/cursos/entities/maestro-curso.entity';
import { Salon } from '../maestros/salones/entities/salon.entity';
import {
  Docente,
  maxHorasForTipo,
} from '../maestros/docentes/entities/docente.entity';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';
import {
  CreateCurriculumAreaDto,
  CreateCurriculumDto,
  CreateCurriculumSubjectDto,
  CreateTeacherAssignmentDto,
  UpdateCurriculumAreaDto,
  UpdateCurriculumDto,
  UpdateCurriculumSubjectDto,
  UpdateTeacherAssignmentDto,
} from './dto/curricula.dto';
import { CURRICULA_SEED_DATA } from './curricula-seed.data';
import { maestroCursoKey } from '../maestros/cursos/cursos-seed.data';
import {
  getMineduCompetencias,
  MineduAreaKey,
  resolveMineduKey,
} from './minedu-competencias.data';
import { resetCurriculaIdSequences } from './curricula-table-rename';

export interface CurriculaCatalogResponse {
  curriculas: Curriculum[];
  areas: CurriculumArea[];
  cursos: CurriculumSubject[];
  competencias: CurriculumCompetencia[];
  capacidades: CurriculumCapacidad[];
  indicadores: CurriculumIndicador[];
  asignaciones: CurriculumTeacherAssignment[];
}

export interface MallaCurricularResponse {
  curriculo: Curriculum;
  curriculas: Curriculum[];
  areas: CurriculumArea[];
  cursos: CurriculumSubject[];
  asignaciones: CurriculumTeacherAssignment[];
  grados: string[];
  totalesPorGrado: Record<string, number>;
  docentesAsignados: number;
}

export interface AsignacionDocenteItem {
  id: number;
  nombres: string;
  apellidos: string;
  dni: string;
  especialidad: string;
  tipo: 'nombrado' | 'contratado';
  maxHoras: number;
  activo: boolean;
}

export interface AsignacionCursoItem {
  id: number;
  curriculumId: number;
  maestroCursoId: number | null;
  nombre: string;
  area: string;
  areaId: number;
  nivel: string;
  grados: string[];
  horasSemanales: number;
}

export interface AsignacionContextResponse {
  anioEscolar: number;
  curriculas: Curriculum[];
  docentes: AsignacionDocenteItem[];
  cursos: AsignacionCursoItem[];
  asignaciones: CurriculumTeacherAssignment[];
  seccionesPorGrado: Record<string, string[]>;
}

const GRADOS_POR_NIVEL: Record<string, string[]> = {
  Inicial: ['3 años', '4 años', '5 años'],
  Primaria: ['1°', '2°', '3°', '4°', '5°', '6°'],
  Secundaria: ['1°', '2°', '3°', '4°', '5°'],
};

@Injectable()
export class CurriculaService implements OnModuleInit {
  private readonly logger = new Logger(CurriculaService.name);

  constructor(
    @InjectRepository(Curriculum)
    private readonly curriculumRepo: Repository<Curriculum>,
    @InjectRepository(CurriculumArea)
    private readonly areaRepo: Repository<CurriculumArea>,
    @InjectRepository(CurriculumSubject)
    private readonly subjectRepo: Repository<CurriculumSubject>,
    @InjectRepository(CurriculumCompetencia)
    private readonly competenciaRepo: Repository<CurriculumCompetencia>,
    @InjectRepository(CurriculumCapacidad)
    private readonly capacidadRepo: Repository<CurriculumCapacidad>,
    @InjectRepository(CurriculumIndicador)
    private readonly indicadorRepo: Repository<CurriculumIndicador>,
    @InjectRepository(CurriculumTeacherAssignment)
    private readonly assignmentRepo: Repository<CurriculumTeacherAssignment>,
    @InjectRepository(MaestroCurso)
    private readonly maestroCursoRepo: Repository<MaestroCurso>,
    @InjectRepository(Docente)
    private readonly docenteRepo: Repository<Docente>,
    @InjectRepository(Salon)
    private readonly salonRepo: Repository<Salon>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await resetCurriculaIdSequences(this.dataSource);
    await this.ensureCurriculumLinks();
    await this.ensureActiveCurriculumBundles();
    await this.ensureMaestroCursoLinks();
    await this.syncMineduCompetencias();
  }

  /** Asigna curriculumId a áreas/cursos existentes (migración de datos previos). */
  async ensureCurriculumLinks(): Promise<void> {
    const curriculas = await this.curriculumRepo.find();
    if (!curriculas.length) return;

    const areas = await this.areaRepo.find();
    for (const area of areas) {
      if (area.curriculumId) continue;
      const curr =
        curriculas.find((c) => c.nivel === area.nivel && c.estado === 'activo') ??
        curriculas.find((c) => c.nivel === area.nivel);
      if (curr) await this.areaRepo.update(area.id, { curriculumId: curr.id });
    }

    const subjects = await this.subjectRepo.find();
    for (const sub of subjects) {
      if (sub.curriculumId) continue;
      const area = await this.areaRepo.findOneBy({ id: sub.areaId });
      if (area?.curriculumId) {
        await this.subjectRepo.update(sub.id, { curriculumId: area.curriculumId });
      }
    }

    const assignments = await this.assignmentRepo.find();
    for (const asg of assignments) {
      if (asg.curriculumId) continue;
      const sub = await this.subjectRepo.findOneBy({ id: asg.cursoId });
      if (sub?.curriculumId) {
        await this.assignmentRepo.update(asg.id, { curriculumId: sub.curriculumId });
      }
    }
  }

  async seedIfEmpty(): Promise<void> {
    if (await this.curriculumRepo.count()) return;

    const curriculas = await this.curriculumRepo.save(
      CURRICULA_SEED_DATA.curriculas.map((c) => this.curriculumRepo.create(c)),
    );

    const activas2026 = curriculas.filter(
      (c) => c.anio === 2026 && c.estado === 'activo',
    );

    for (const curr of activas2026) {
      await this.seedBundleForCurriculum(curr.id, curr.nivel);
    }
  }

  /** Siembra currícula demo y competencias MINEDU (solo si tablas vacías). */
  async seedCatalogBundle(): Promise<void> {
    await this.seedIfEmpty();
    await this.ensureActiveCurriculumBundles();
    await this.ensureMaestroCursoLinks();
    await this.syncMineduCompetencias();
  }

  /** Garantiza malla y competencias en currículas activas sin cursos o sin competencias. */
  private async ensureActiveCurriculumBundles(): Promise<void> {
    const activas = await this.curriculumRepo.find({ where: { estado: 'activo' } });
    for (const curr of activas) {
      const subjectCount = await this.subjectRepo.count({
        where: { curriculumId: curr.id, activo: true },
      });
      if (subjectCount === 0) {
        this.logger.log(
          `Siembra de malla MINEDU para currícula activa ${curr.id} (${curr.nivel} ${curr.anio})`,
        );
        await this.seedBundleForCurriculum(curr.id, curr.nivel);
        continue;
      }

      const subjects = await this.subjectRepo.find({
        where: { curriculumId: curr.id, activo: true },
        select: { id: true },
      });
      const subjectIds = subjects.map((s) => s.id);
      const compCount = subjectIds.length
        ? await this.competenciaRepo.count({
            where: { cursoId: In(subjectIds), activo: true },
          })
        : 0;
      if (compCount === 0) {
        this.logger.warn(
          `Currícula ${curr.id} (${curr.nivel} ${curr.anio}) sin competencias — se sincronizarán desde MINEDU`,
        );
      }
    }
  }

  private async seedBundleForCurriculum(
    curriculumId: number,
    nivel: string,
  ): Promise<void> {
    const areaSeed = CURRICULA_SEED_DATA.areas
      .map((a, seedIndex) => ({ ...a, seedIndex }))
      .filter((a) => a.nivel === nivel);

    const savedAreas = await this.areaRepo.save(
      areaSeed.map((a) =>
        this.areaRepo.create({
          curriculumId,
          nombre: a.nombre,
          nivel: a.nivel,
          orden: a.orden,
          colorClass: a.colorClass,
          dotClass: a.dotClass,
          activo: true,
        }),
      ),
    );

    const areaIndexToId = new Map<number, number>();
    areaSeed.forEach((a, i) => areaIndexToId.set(a.seedIndex, savedAreas[i].id));

    const subjectSeed = CURRICULA_SEED_DATA.subjects
      .map((s, seedIndex) => ({ ...s, seedIndex }))
      .filter((s) => s.nivel === nivel);

    const maestroLookup = await this.buildMaestroCursoLookup();

    const savedSubjects = await this.subjectRepo.save(
      subjectSeed.map((s) =>
        this.subjectRepo.create({
          curriculumId,
          nombre: s.nombre,
          areaId: areaIndexToId.get(s.areaIndex)!,
          nivel: s.nivel,
          grados: s.grados,
          horasSemanales: s.horasSemanales,
          maestroCursoId: maestroLookup.get(maestroCursoKey(s.nivel, s.nombre)) ?? null,
          activo: true,
        }),
      ),
    );

    const subjectIndexToId = new Map<number, number>();
    subjectSeed.forEach((s, i) => subjectIndexToId.set(s.seedIndex, savedSubjects[i].id));

    for (const sub of savedSubjects) {
      const area = savedAreas.find((a) => a.id === sub.areaId);
      if (!area) continue;
      const key = resolveMineduKey(nivel, sub.nombre, area.nombre);
      if (key) await this.applyMineduToSubject(sub.id, key);
    }

    const asgSeed = CURRICULA_SEED_DATA.assignments.filter((a) => {
      const sub = CURRICULA_SEED_DATA.subjects[a.subjectIndex];
      return sub?.nivel === nivel;
    });

    await this.assignmentRepo.save(
      asgSeed.map((a) => {
        const sub = CURRICULA_SEED_DATA.subjects[a.subjectIndex];
        return this.assignmentRepo.create({
          docenteId: null,
          docenteNombre: a.docenteNombre,
          cursoId: subjectIndexToId.get(a.subjectIndex)!,
          curriculumId,
          nivel: a.nivel,
          grado: a.grado,
          secciones: a.secciones,
          horasSemanales: sub?.horasSemanales ?? 0,
          activo: true,
        });
      }),
    );
  }

  private async syncMineduCompetencias(): Promise<void> {
    try {
      const curriculas = await this.curriculumRepo.find({
        where: { estado: 'activo' },
      });
      for (const curr of curriculas) {
        const subjects = await this.subjectRepo.find({
          where: { curriculumId: curr.id, activo: true },
        });
        for (const sub of subjects) {
          try {
            const area = await this.areaRepo.findOneBy({ id: sub.areaId });
            if (!area) continue;
            const key = resolveMineduKey(curr.nivel, sub.nombre, area.nombre);
            if (!key) continue;
            const expected = getMineduCompetencias(key).length;
            const current = await this.competenciaRepo.count({
              where: { cursoId: sub.id, activo: true },
            });
            if (current === expected) continue;
            await this.clearCompetenciasForSubject(sub.id);
            await this.applyMineduToSubject(sub.id, key);
            this.logger.log(
              `Competencias MINEDU aplicadas: ${sub.nombre} (${curr.nivel} ${curr.anio}) → ${expected}`,
            );
          } catch (err) {
            console.warn(
              `[curricula] sync MINEDU omitido para curso ${sub.id} (${sub.nombre}):`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      }
    } catch (err) {
      console.warn(
        '[curricula] sync MINEDU no completado:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async clearCompetenciasForSubject(cursoId: number): Promise<void> {
    const comps = await this.competenciaRepo.find({ where: { cursoId } });
    const compIds = comps.map((c) => c.id);
    if (!compIds.length) return;

    const caps = await this.capacidadRepo
      .createQueryBuilder('cap')
      .where('cap.competenciaId IN (:...compIds)', { compIds })
      .getMany();
    const capIds = caps.map((c) => c.id);
    if (capIds.length) {
      await this.indicadorRepo
        .createQueryBuilder()
        .delete()
        .where('capacidadId IN (:...capIds)', { capIds })
        .execute();
      await this.capacidadRepo
        .createQueryBuilder()
        .delete()
        .where('competenciaId IN (:...compIds)', { compIds })
        .execute();
    }
    await this.competenciaRepo.delete({ cursoId });
  }

  private async applyMineduToSubject(
    cursoId: number,
    key: MineduAreaKey,
  ): Promise<void> {
    const defs = getMineduCompetencias(key);
    for (const def of defs) {
      const comp = await this.competenciaRepo.save(
        this.competenciaRepo.create({
          cursoId,
          nombre: def.nombre,
          activo: true,
        }),
      );
      for (let i = 0; i < def.capacidades.length; i++) {
        await this.capacidadRepo.save(
          this.capacidadRepo.create({
            competenciaId: comp.id,
            nombre: def.capacidades[i],
            orden: i + 1,
            activo: true,
          }),
        );
      }
    }
  }

  async getMalla(curriculumId: number): Promise<MallaCurricularResponse> {
    const curriculo = await this.getCurriculumOrFail(curriculumId);

    const [curriculas, areas, cursos, asignaciones] = await Promise.all([
      this.curriculumRepo.find({ order: { anio: 'DESC', nivel: 'ASC' } }),
      this.areaRepo.find({
        where: { curriculumId, activo: true },
        order: { orden: 'ASC' },
      }),
      this.subjectRepo.find({
        where: { curriculumId, activo: true },
        order: { nombre: 'ASC' },
      }),
      this.assignmentRepo.find({ where: { curriculumId } }),
    ]);

    const grados = GRADOS_POR_NIVEL[curriculo.nivel] ?? [];
    const totalesPorGrado: Record<string, number> = {};
    for (const grado of grados) {
      totalesPorGrado[grado] = cursos
        .filter((c) => c.grados.includes(grado))
        .reduce((sum, c) => sum + c.horasSemanales, 0);
    }

    const docentesAsignados = new Set(
      asignaciones.map((a) => a.docenteNombre),
    ).size;

    return {
      curriculo,
      curriculas,
      areas,
      cursos,
      asignaciones,
      grados,
      totalesPorGrado,
      docentesAsignados,
    };
  }

  async getCatalog(
    curriculumId?: number,
    nivel?: string,
  ): Promise<CurriculaCatalogResponse> {
    const curriculas = await this.curriculumRepo.find({
      order: { anio: 'DESC', nivel: 'ASC' },
    });

    if (!curriculumId) {
      return {
        curriculas,
        areas: [],
        cursos: [],
        competencias: [],
        capacidades: [],
        indicadores: [],
        asignaciones: [],
      };
    }

    await this.getCurriculumOrFail(curriculumId);

    const areaWhere = { curriculumId, activo: true };
    const subjectWhere = { curriculumId, activo: true };

    const [areas, cursos] = await Promise.all([
      this.areaRepo.find({ where: areaWhere, order: { orden: 'ASC' } }),
      this.subjectRepo.find({ where: subjectWhere, order: { nombre: 'ASC' } }),
    ]);

    const cursoIds = cursos.map((c) => c.id);
    const competencias = cursoIds.length
      ? await this.competenciaRepo.find({
          where: { cursoId: In(cursoIds), activo: true },
          order: { id: 'ASC' },
        })
      : [];

    const compIds = competencias.map((c) => c.id);
    const capacidades = compIds.length
      ? await this.capacidadRepo
          .createQueryBuilder('cap')
          .where('cap.competenciaId IN (:...compIds)', { compIds })
          .andWhere('cap.activo = true')
          .orderBy('cap.orden', 'ASC')
          .getMany()
      : [];

    const capIds = capacidades.map((c) => c.id);
    const indicadores = capIds.length
      ? await this.indicadorRepo
          .createQueryBuilder('ind')
          .where('ind.capacidadId IN (:...capIds)', { capIds })
          .andWhere('ind.activo = true')
          .getMany()
      : [];

    const asignaciones = await this.assignmentRepo.find({ where: { curriculumId } });

    return {
      curriculas,
      areas,
      cursos,
      competencias,
      capacidades,
      indicadores,
      asignaciones,
    };
  }

  findCurriculas(filters?: {
    anio?: number;
    nivel?: string;
    estado?: string;
  }): Promise<Curriculum[]> {
    const qb = this.curriculumRepo
      .createQueryBuilder('c')
      .orderBy('c.anio', 'DESC')
      .addOrderBy('c.nivel', 'ASC');

    if (filters?.anio) qb.andWhere('c.anio = :anio', { anio: filters.anio });
    if (filters?.nivel) qb.andWhere('c.nivel = :nivel', { nivel: filters.nivel });
    if (filters?.estado) qb.andWhere('c.estado = :estado', { estado: filters.estado });

    return qb.getMany();
  }

  async createCurriculum(dto: CreateCurriculumDto): Promise<Curriculum> {
    const existing = await this.curriculumRepo.findOne({
      where: { anio: dto.anio, nivel: dto.nivel, version: '1.0' },
    });
    if (existing && existing.estado !== 'inactivo') {
      throw new BadRequestException(
        `Ya existe una currícula para ${dto.nivel} ${dto.anio}`,
      );
    }

    const created = await this.curriculumRepo.save(
      this.curriculumRepo.create({
        anio: dto.anio,
        nivel: dto.nivel,
        estado: 'borrador',
        version: '1.0',
        tipoEscala: dto.tipoEscala ?? 'numerica',
        tipoPeriodo: dto.tipoPeriodo ?? 'bimestral',
        fechaCreacion: new Date().toISOString().slice(0, 10),
      }),
    );

    const source = await this.curriculumRepo.findOne({
      where: { nivel: dto.nivel, estado: 'activo' },
    });
    if (source) {
      await this.cloneCurriculumStructure(source.id, created.id);
    }

    return created;
  }

  async updateCurriculum(id: number, dto: UpdateCurriculumDto): Promise<Curriculum> {
    const curr = await this.getCurriculumOrFail(id);

    if (curr.estado === 'inactivo' && (dto.tipoEscala || dto.tipoPeriodo || dto.version)) {
      throw new BadRequestException('No se puede editar una currícula inactiva');
    }

    if (dto.estado === 'activo') {
      await this.curriculumRepo.update(
        { nivel: curr.nivel, estado: 'activo' as const },
        { estado: 'inactivo' },
      );
    }

    Object.assign(curr, dto);
    return this.curriculumRepo.save(curr);
  }

  async getCurriculumSummary(id: number) {
    const curr = await this.getCurriculumOrFail(id);
    const cursos = await this.subjectRepo.find({
      where: { curriculumId: id, activo: true },
    });
    const cursoIds = cursos.map((c) => c.id);
    const [areasCount, competenciasCount] = await Promise.all([
      this.areaRepo.count({ where: { curriculumId: id, activo: true } }),
      cursoIds.length
        ? this.competenciaRepo.count({
            where: { cursoId: In(cursoIds), activo: true },
          })
        : Promise.resolve(0),
    ]);

    return {
      ...curr,
      areasCount,
      cursosCount: cursos.length,
      competenciasCount,
      totalHoras: cursos.reduce((s, c) => s + c.horasSemanales, 0),
    };
  }

  async copyCurriculum(id: number): Promise<Curriculum> {
    const orig = await this.getCurriculumOrFail(id);
    const copy = await this.curriculumRepo.save(
      this.curriculumRepo.create({
        anio: orig.anio,
        nivel: orig.nivel,
        estado: 'borrador',
        version: '1.0',
        tipoEscala: orig.tipoEscala,
        tipoPeriodo: orig.tipoPeriodo,
        fechaCreacion: new Date().toISOString().slice(0, 10),
      }),
    );

    await this.cloneCurriculumStructure(id, copy.id);
    return copy;
  }

  private async cloneCurriculumStructure(
    sourceId: number,
    targetId: number,
  ): Promise<void> {
    const areas = await this.areaRepo.find({
      where: { curriculumId: sourceId, activo: true },
      order: { orden: 'ASC' },
    });
    const areaMap = new Map<number, number>();
    for (const area of areas) {
      const saved = await this.areaRepo.save(
        this.areaRepo.create({
          curriculumId: targetId,
          nombre: area.nombre,
          nivel: area.nivel,
          orden: area.orden,
          colorClass: area.colorClass,
          dotClass: area.dotClass,
          activo: true,
        }),
      );
      areaMap.set(area.id, saved.id);
    }

    const subjects = await this.subjectRepo.find({
      where: { curriculumId: sourceId, activo: true },
    });
    const subjectMap = new Map<number, number>();
    for (const sub of subjects) {
      const newAreaId = areaMap.get(sub.areaId);
      if (!newAreaId) continue;
      const saved = await this.subjectRepo.save(
        this.subjectRepo.create({
          curriculumId: targetId,
          nombre: sub.nombre,
          areaId: newAreaId,
          nivel: sub.nivel,
          grados: sub.grados,
          horasSemanales: sub.horasSemanales,
          maestroCursoId: sub.maestroCursoId,
          activo: true,
        }),
      );
      subjectMap.set(sub.id, saved.id);
    }

    if (!subjectMap.size) return;

    const competencias = await this.competenciaRepo.find({
      where: { cursoId: In([...subjectMap.keys()]), activo: true },
    });
    const compMap = new Map<number, number>();
    for (const comp of competencias) {
      const newCursoId = subjectMap.get(comp.cursoId);
      if (!newCursoId) continue;
      const saved = await this.competenciaRepo.save(
        this.competenciaRepo.create({
          cursoId: newCursoId,
          nombre: comp.nombre,
          activo: true,
        }),
      );
      compMap.set(comp.id, saved.id);
    }

    if (!compMap.size) return;

    const capacidades = await this.capacidadRepo
      .createQueryBuilder('cap')
      .where('cap.competenciaId IN (:...compIds)', { compIds: [...compMap.keys()] })
      .andWhere('cap.activo = true')
      .getMany();
    const capMap = new Map<number, number>();
    for (const cap of capacidades) {
      const newCompId = compMap.get(cap.competenciaId);
      if (!newCompId) continue;
      const saved = await this.capacidadRepo.save(
        this.capacidadRepo.create({
          competenciaId: newCompId,
          nombre: cap.nombre,
          orden: cap.orden,
          activo: true,
        }),
      );
      capMap.set(cap.id, saved.id);
    }

    if (capMap.size) {
      const indicadores = await this.indicadorRepo
        .createQueryBuilder('ind')
        .where('ind.capacidadId IN (:...capIds)', { capIds: [...capMap.keys()] })
        .andWhere('ind.activo = true')
        .getMany();
      for (const ind of indicadores) {
        const newCapId = capMap.get(ind.capacidadId);
        if (!newCapId) continue;
        await this.indicadorRepo.save(
          this.indicadorRepo.create({
            capacidadId: newCapId,
            descripcion: ind.descripcion,
            ponderacion: ind.ponderacion,
            activo: true,
          }),
        );
      }
    }

    const assignments = await this.assignmentRepo.find({
      where: { curriculumId: sourceId },
    });
    for (const asg of assignments) {
      const newCursoId = subjectMap.get(asg.cursoId);
      if (!newCursoId) continue;
      await this.assignmentRepo.save(
        this.assignmentRepo.create({
          docenteId: asg.docenteId,
          docenteNombre: asg.docenteNombre,
          cursoId: newCursoId,
          curriculumId: targetId,
          nivel: asg.nivel,
          grado: asg.grado,
          secciones: asg.secciones,
          horasSemanales: asg.horasSemanales,
          activo: asg.activo,
        }),
      );
    }
  }

  findAreas(curriculumId?: number): Promise<CurriculumArea[]> {
    const where = curriculumId ? { curriculumId, activo: true } : { activo: true };
    return this.areaRepo.find({ where, order: { orden: 'ASC' } });
  }

  async createArea(dto: CreateCurriculumAreaDto): Promise<CurriculumArea> {
    const curr = await this.getCurriculumOrFail(dto.curriculumId);
    const nivel = dto.nivel ?? curr.nivel;

    let orden = dto.orden;
    if (orden == null) {
      const row = await this.areaRepo
        .createQueryBuilder('a')
        .select('MAX(a.orden)', 'max')
        .where('a.curriculumId = :curriculumId', { curriculumId: dto.curriculumId })
        .getRawOne<{ max: string | null }>();
      orden = (row?.max ? Number(row.max) : 0) + 1;
    }

    const palettes = [
      { colorClass: 'bg-indigo-50 border-indigo-200 text-indigo-800', dotClass: 'bg-indigo-500' },
      { colorClass: 'bg-blue-50 border-blue-200 text-blue-800', dotClass: 'bg-blue-500' },
      { colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-800', dotClass: 'bg-emerald-500' },
      { colorClass: 'bg-amber-50 border-amber-200 text-amber-800', dotClass: 'bg-amber-500' },
      { colorClass: 'bg-pink-50 border-pink-200 text-pink-800', dotClass: 'bg-pink-500' },
      { colorClass: 'bg-teal-50 border-teal-200 text-teal-800', dotClass: 'bg-teal-500' },
      { colorClass: 'bg-violet-50 border-violet-200 text-violet-800', dotClass: 'bg-violet-500' },
      { colorClass: 'bg-orange-50 border-orange-200 text-orange-800', dotClass: 'bg-orange-500' },
    ];
    const palette = palettes[(orden - 1) % palettes.length];

    return this.areaRepo.save(
      this.areaRepo.create({
        curriculumId: dto.curriculumId,
        nombre: dto.nombre,
        nivel,
        orden,
        colorClass: dto.colorClass ?? palette.colorClass,
        dotClass: dto.dotClass ?? palette.dotClass,
        activo: true,
      }),
    );
  }

  async updateArea(id: number, dto: UpdateCurriculumAreaDto): Promise<CurriculumArea> {
    const area = await this.areaRepo.findOneBy({ id });
    if (!area) throw new NotFoundException(`Área ${id} no encontrada`);
    Object.assign(area, dto);
    return this.areaRepo.save(area);
  }

  findSubjects(curriculumId?: number): Promise<CurriculumSubject[]> {
    const where = curriculumId
      ? { curriculumId, activo: true }
      : { activo: true };
    return this.subjectRepo.find({ where, order: { nombre: 'ASC' } });
  }

  async createSubject(dto: CreateCurriculumSubjectDto): Promise<CurriculumSubject> {
    const curr = await this.getCurriculumOrFail(dto.curriculumId);
    const area = await this.getAreaOrFail(dto.areaId);
    if (area.curriculumId !== dto.curriculumId) {
      throw new BadRequestException('El área no pertenece a esta currícula');
    }
    if (dto.nivel !== curr.nivel) {
      throw new BadRequestException('El nivel del curso no coincide con la currícula');
    }

    let maestroCursoId = dto.maestroCursoId ?? null;
    if (maestroCursoId) {
      const maestro = await this.maestroCursoRepo.findOneBy({
        id: maestroCursoId,
        activo: true,
      });
      if (!maestro) {
        throw new BadRequestException('Curso maestro no encontrado o inactivo');
      }
      if (maestro.nivel !== dto.nivel) {
        throw new BadRequestException(
          'El curso maestro no corresponde al nivel de la currícula',
        );
      }

      const existingSubject = await this.subjectRepo.findOne({
        where: { curriculumId: dto.curriculumId, maestroCursoId, activo: true },
      });
      if (existingSubject) {
        throw new BadRequestException(
          'Este curso del catálogo maestro ya está registrado en esta currícula',
        );
      }
    } else {
      throw new BadRequestException(
        'Debe seleccionar un curso del catálogo maestro (maestroCursoId)',
      );
    }

    return this.subjectRepo.save(
      this.subjectRepo.create({
        ...dto,
        maestroCursoId,
        activo: true,
      }),
    );
  }

  async updateSubject(
    id: number,
    dto: UpdateCurriculumSubjectDto,
  ): Promise<CurriculumSubject> {
    const subject = await this.subjectRepo.findOneBy({ id });
    if (!subject) throw new NotFoundException(`Curso ${id} no encontrado`);
    if (dto.areaId != null) {
      const area = await this.getAreaOrFail(dto.areaId);
      if (area.curriculumId !== subject.curriculumId) {
        throw new BadRequestException('El área no pertenece a esta currícula');
      }
    }
    Object.assign(subject, dto);
    return this.subjectRepo.save(subject);
  }

  findAssignments(curriculumId?: number): Promise<CurriculumTeacherAssignment[]> {
    return curriculumId
      ? this.assignmentRepo.find({ where: { curriculumId }, order: { id: 'ASC' } })
      : this.assignmentRepo.find({ order: { id: 'ASC' } });
  }

  async getAsignacionContext(
    anio: number,
    nivel?: string,
  ): Promise<AsignacionContextResponse> {
    let curriculas = await this.resolveCurriculasParaAsignacion(anio, nivel);

    const curriculumIds = curriculas.map((c) => c.id);
    const docentes = await this.loadDocentesForAsignacion();

    if (!curriculumIds.length) {
      return {
        anioEscolar: anio,
        curriculas: [],
        docentes,
        cursos: [],
        asignaciones: [],
        seccionesPorGrado: {},
      };
    }

    for (const curr of curriculas) {
      await this.ensureCurriculumSubjectsFromMaestro(curr.id, curr.nivel);
    }
    await this.ensureMaestroCursoLinks();

    const [asignaciones, salones, cursosEnriched] = await Promise.all([
      this.assignmentRepo.find({
        where: { curriculumId: In(curriculumIds), activo: true },
        order: { id: 'ASC' },
      }),
      this.salonRepo.find({
        where: { anioEscolar: anio, activo: true },
        order: { nivel: 'ASC', grado: 'ASC', seccion: 'ASC' },
      }),
      this.buildCursosDesdeMaestro(curriculas),
    ]);

    const subjectHoras = new Map(cursosEnriched.map((c) => [c.id, c.horasSemanales]));

    const asignacionesEnriched = asignaciones.map((a) => ({
      ...a,
      horasSemanales:
        a.horasSemanales > 0
          ? a.horasSemanales
          : (subjectHoras.get(a.cursoId) ?? 0),
    }));

    const seccionesPorGrado: Record<string, string[]> = {};
    const pushSeccion = (nivel: string, grado: string, seccion: string) => {
      const key = `${nivel}|${normalizeGradoMatricula(grado)}`;
      const sec = seccion.trim().toUpperCase();
      if (!sec) return;
      if (!seccionesPorGrado[key]) seccionesPorGrado[key] = [];
      if (!seccionesPorGrado[key].includes(sec)) {
        seccionesPorGrado[key].push(sec);
      }
    };

    for (const salon of salones) {
      pushSeccion(salon.nivel, salon.grado, salon.seccion);
    }
    for (const a of asignaciones) {
      if (!a.activo) continue;
      for (const sec of a.secciones ?? []) {
        pushSeccion(a.nivel, a.grado, sec);
      }
    }

    return {
      anioEscolar: anio,
      curriculas,
      docentes,
      cursos: cursosEnriched,
      asignaciones: asignacionesEnriched,
      seccionesPorGrado,
    };
  }

  /**
   * Una currícula por nivel y año: preferir activa; si no hay, usar la más reciente.
   */
  private async resolveCurriculasParaAsignacion(
    anio: number,
    nivel?: string,
  ): Promise<Curriculum[]> {
    const where: { anio: number; nivel?: string } = { anio };
    if (nivel) where.nivel = nivel;

    const all = await this.curriculumRepo.find({
      where,
      order: { id: 'DESC' },
    });
    if (!all.length) return [];

    const estadoRank: Record<string, number> = {
      activo: 3,
      borrador: 2,
      inactivo: 1,
    };

    const byNivel = new Map<string, Curriculum>();
    for (const curr of all) {
      const prev = byNivel.get(curr.nivel);
      if (!prev) {
        byNivel.set(curr.nivel, curr);
        continue;
      }
      const rankCurr = estadoRank[curr.estado] ?? 0;
      const rankPrev = estadoRank[prev.estado] ?? 0;
      if (
        rankCurr > rankPrev ||
        (rankCurr === rankPrev && curr.id > prev.id)
      ) {
        byNivel.set(curr.nivel, curr);
      }
    }

    return [...byNivel.values()].sort((a, b) =>
      a.nivel.localeCompare(b.nivel),
    );
  }

  /**
   * Lista de cursos asignables: catálogo maestro como fuente de verdad,
   * instanciados en la currícula activa (crea subjects faltantes).
   */
  private async buildCursosDesdeMaestro(
    curriculas: Curriculum[],
    nivelFilter?: string,
  ): Promise<AsignacionCursoItem[]> {
    const nivelToCurriculumId = new Map(curriculas.map((c) => [c.nivel, c.id]));
    let niveles = [...nivelToCurriculumId.keys()];
    if (nivelFilter) {
      niveles = niveles.filter((n) => n === nivelFilter);
    }
    if (!niveles.length) return [];

    const curriculumIds = niveles
      .map((n) => nivelToCurriculumId.get(n))
      .filter((id): id is number => id != null);

    const maestros = await this.maestroCursoRepo
      .createQueryBuilder('m')
      .where('m.activo = true')
      .andWhere('m.nivel IN (:...niveles)', { niveles })
      .orderBy('m.nivel', 'ASC')
      .addOrderBy('m.area', 'ASC')
      .addOrderBy('m.nombre', 'ASC')
      .getMany();

    const subjects = await this.subjectRepo.find({
      where: { curriculumId: In(curriculumIds), activo: true },
    });

    const subjectByMaestroId = new Map<number, CurriculumSubject>();
    const subjectByKey = new Map<string, CurriculumSubject>();
    for (const s of subjects) {
      subjectByKey.set(maestroCursoKey(s.nivel, s.nombre), s);
      if (s.maestroCursoId != null) {
        subjectByMaestroId.set(s.maestroCursoId, s);
      }
    }

    const items: AsignacionCursoItem[] = [];

    for (const m of maestros) {
      const curriculumId = nivelToCurriculumId.get(m.nivel);
      if (!curriculumId) continue;

      let subject =
        subjectByMaestroId.get(m.id) ??
        subjectByKey.get(maestroCursoKey(m.nivel, m.nombre));

      if (!subject) {
        await this.ensureCurriculumSubjectsFromMaestro(curriculumId, m.nivel);
        subject =
          (await this.subjectRepo.findOne({
            where: {
              curriculumId,
              nivel: m.nivel,
              nombre: m.nombre,
              activo: true,
            },
          })) ?? undefined;
      }

      if (!subject) continue;

      if (subject.curriculumId !== curriculumId) {
        subject.curriculumId = curriculumId;
        subject = await this.subjectRepo.save(subject);
      }

      subject = await this.syncSubjectGradosFromMaestro(subject);

      items.push({
        id: subject.id,
        curriculumId,
        maestroCursoId: m.id,
        nombre: m.nombre,
        area: m.area,
        areaId: subject.areaId,
        nivel: m.nivel,
        grados: [...subject.grados],
        horasSemanales: m.horasSemanales,
      });
    }

    return items;
  }

  async createAssignment(
    dto: CreateTeacherAssignmentDto,
  ): Promise<CurriculumTeacherAssignment> {
    await this.getCurriculumOrFail(dto.curriculumId);
    let subject = await this.syncSubjectGradosFromMaestro(
      await this.getSubjectOrFail(dto.cursoId),
    );

    if (subject.curriculumId != null && subject.curriculumId !== dto.curriculumId) {
      subject.curriculumId = dto.curriculumId;
      subject = await this.subjectRepo.save(subject);
    }

    const gradoCanonico = this.resolveGradoCanonico(dto.grado, subject.grados);
    if (!this.gradosIncluyen(gradoCanonico, subject.grados)) {
      throw new BadRequestException(
        `El curso no está disponible para el grado ${dto.grado}`,
      );
    }

    const docente = await this.getDocenteOrFail(dto.docenteId);
    const seccionesNorm = dto.secciones.map((s) => s.trim().toUpperCase());

    const existingSameDocente = await this.findActiveAssignmentForDocente(
      dto.curriculumId,
      dto.cursoId,
      gradoCanonico,
      docente.id,
    );
    if (existingSameDocente) {
      const merged = [
        ...new Set([
          ...(existingSameDocente.secciones ?? []).map((s) => s.toUpperCase()),
          ...seccionesNorm,
        ]),
      ];
      return this.updateAssignment(existingSameDocente.id, {
        docenteId: dto.docenteId,
        nivel: dto.nivel,
        grado: gradoCanonico,
        secciones: merged,
        horasSemanales: dto.horasSemanales,
      });
    }

    await this.assertNoSectionConflict(
      dto.curriculumId,
      dto.cursoId,
      gradoCanonico,
      seccionesNorm,
    );

    const horas =
      dto.horasSemanales ?? subject.horasSemanales ?? 0;

    return this.assignmentRepo.save(
      this.assignmentRepo.create({
        curriculumId: dto.curriculumId,
        docenteId: docente.id,
        docenteNombre: `${docente.nombres} ${docente.apellidos}`.trim(),
        cursoId: dto.cursoId,
        nivel: dto.nivel,
        grado: gradoCanonico,
        secciones: seccionesNorm,
        horasSemanales: horas,
        activo: dto.activo ?? true,
      }),
    );
  }

  async updateAssignment(
    id: number,
    dto: UpdateTeacherAssignmentDto,
  ): Promise<CurriculumTeacherAssignment> {
    const current = await this.getAssignmentOrFail(id);
    const curriculumId = current.curriculumId!;
    const cursoId = dto.cursoId ?? current.cursoId;
    const grado = dto.grado ?? current.grado;

    if (dto.cursoId != null || dto.grado != null) {
      let subject = await this.syncSubjectGradosFromMaestro(
        await this.getSubjectOrFail(cursoId),
      );
      if (subject.curriculumId != null && subject.curriculumId !== curriculumId) {
        throw new BadRequestException('El curso no pertenece a esta currícula');
      }
      const gradoCanonico = this.resolveGradoCanonico(grado, subject.grados);
      if (!this.gradosIncluyen(gradoCanonico, subject.grados)) {
        throw new BadRequestException(
          `El curso no está disponible para el grado ${grado}`,
        );
      }
      await this.assertNoSectionConflict(
        curriculumId,
        cursoId,
        gradoCanonico,
        dto.secciones?.map((s) => s.trim().toUpperCase()) ?? current.secciones,
        id,
      );
      current.grado = gradoCanonico;
    }

    if (dto.docenteId != null) {
      const docente = await this.getDocenteOrFail(dto.docenteId);
      current.docenteId = docente.id;
      current.docenteNombre = `${docente.nombres} ${docente.apellidos}`.trim();
    }

    if (dto.cursoId != null) current.cursoId = dto.cursoId;
    if (dto.nivel != null) current.nivel = dto.nivel;
    if (dto.secciones != null) {
      const seccionesNorm = dto.secciones.map((s) => s.trim().toUpperCase());
      await this.assertNoSectionConflict(
        curriculumId,
        cursoId,
        current.grado,
        seccionesNorm,
        id,
      );
      current.secciones = seccionesNorm;
    }
    if (dto.activo != null) current.activo = dto.activo;

    if (dto.horasSemanales != null) {
      current.horasSemanales = dto.horasSemanales;
    } else if (dto.cursoId != null) {
      const subject = await this.getSubjectOrFail(cursoId);
      current.horasSemanales = subject.horasSemanales;
    }

    return this.assignmentRepo.save(current);
  }

  async deleteAssignment(id: number): Promise<{ ok: true }> {
    const current = await this.getAssignmentOrFail(id);
    await this.assignmentRepo.remove(current);
    return { ok: true };
  }

  private async loadDocentesForAsignacion(): Promise<AsignacionDocenteItem[]> {
    const docentes = await this.docenteRepo.find({
      order: { apellidos: 'ASC', nombres: 'ASC' },
    });
    return docentes.map((d) => this.mapDocenteToItem(d));
  }

  private mapDocenteToItem(docente: Docente): AsignacionDocenteItem {
    return {
      id: docente.id,
      nombres: docente.nombres,
      apellidos: docente.apellidos,
      dni: docente.dni,
      especialidad: docente.especialidad?.trim() || 'Docente',
      tipo: docente.tipo,
      maxHoras: docente.maxHoras || maxHorasForTipo(docente.tipo),
      activo: docente.estado === 'activo',
    };
  }

  private async getDocenteOrFail(id: number): Promise<Docente> {
    const docente = await this.docenteRepo.findOneBy({ id });
    if (!docente) {
      throw new NotFoundException(`Docente ${id} no encontrado`);
    }
    if (docente.estado !== 'activo') {
      throw new BadRequestException('El docente seleccionado no está activo');
    }
    return docente;
  }

  private async getAssignmentOrFail(
    id: number,
  ): Promise<CurriculumTeacherAssignment> {
    const row = await this.assignmentRepo.findOneBy({ id });
    if (!row) throw new NotFoundException(`Asignación ${id} no encontrada`);
    return row;
  }

  private async getSubjectOrFail(id: number): Promise<CurriculumSubject> {
    const subject = await this.subjectRepo.findOneBy({ id });
    if (!subject) throw new NotFoundException(`Curso ${id} no encontrado`);
    return subject;
  }

  private async findActiveAssignmentForDocente(
    curriculumId: number,
    cursoId: number,
    grado: string,
    docenteId: number,
  ): Promise<CurriculumTeacherAssignment | null> {
    const gradoKey = this.gradoAsignacionKey(grado);
    const rows = await this.assignmentRepo.find({
      where: { curriculumId, cursoId, docenteId, activo: true },
    });
    return (
      rows.find((row) => this.gradoAsignacionKey(row.grado) === gradoKey) ?? null
    );
  }

  private async assertNoSectionConflict(
    curriculumId: number,
    cursoId: number,
    grado: string,
    secciones: string[],
    excludeId?: number,
  ): Promise<void> {
    const gradoKey = this.gradoAsignacionKey(grado);
    const newSecs = new Set(secciones.map((s) => s.trim().toUpperCase()));
    const rows = await this.assignmentRepo.find({
      where: { curriculumId, cursoId, activo: true },
    });
    for (const row of rows) {
      if (excludeId != null && row.id === excludeId) continue;
      if (this.gradoAsignacionKey(row.grado) !== gradoKey) continue;
      for (const sec of row.secciones ?? []) {
        const normalized = sec.trim().toUpperCase();
        if (newSecs.has(normalized)) {
          throw new BadRequestException(
            `La sección ${normalized} ya está asignada a ${row.docenteNombre} en este curso y grado`,
          );
        }
      }
    }
  }

  private gradoAsignacionKey(grado: string): string {
    const t = grado.trim().toLowerCase();
    if (t.includes('año') || t.includes('anos')) {
      return t.replace(/\s+/g, ' ');
    }
    return normalizeGradoMatricula(grado).toLowerCase();
  }

  private gradosIncluyen(grado: string, grados: string[]): boolean {
    const key = this.gradoAsignacionKey(grado);
    return grados.some((g) => this.gradoAsignacionKey(g) === key);
  }

  private resolveGradoCanonico(grado: string, grados: string[]): string {
    const key = this.gradoAsignacionKey(grado);
    const match = grados.find((g) => this.gradoAsignacionKey(g) === key);
    if (match) return match;
    const t = grado.trim().toLowerCase();
    if (t.includes('año') || t.includes('anos')) return grado.trim();
    return normalizeGradoMatricula(grado);
  }

  private async syncSubjectGradosFromMaestro(
    subject: CurriculumSubject,
  ): Promise<CurriculumSubject> {
    if (!subject.maestroCursoId) return subject;
    const maestro = await this.maestroCursoRepo.findOneBy({
      id: subject.maestroCursoId,
      activo: true,
    });
    if (!maestro?.grados?.length) return subject;

    const maestroKeys = maestro.grados.map((g) => this.gradoAsignacionKey(g));
    const subjectKeys = (subject.grados ?? []).map((g) =>
      this.gradoAsignacionKey(g),
    );
    const needsSync =
      maestroKeys.length !== subjectKeys.length ||
      maestroKeys.some((k) => !subjectKeys.includes(k));

    if (!needsSync) return subject;

    subject.grados = [...maestro.grados];
    if (subject.horasSemanales <= 0 && maestro.horasSemanales > 0) {
      subject.horasSemanales = maestro.horasSemanales;
    }
    return this.subjectRepo.save(subject);
  }

  /** Enlaza curriculum subjects existentes con maestros_cursos por (nivel, nombre). */
  async ensureMaestroCursoLinks(): Promise<number> {
    const lookup = await this.buildMaestroCursoLookup();
    const subjects = await this.subjectRepo.find({
      where: { maestroCursoId: IsNull() },
    });

    let linked = 0;
    for (const sub of subjects) {
      const maestroId = lookup.get(maestroCursoKey(sub.nivel, sub.nombre));
      if (!maestroId) continue;
      await this.subjectRepo.update(sub.id, { maestroCursoId: maestroId });
      linked++;
    }
    return linked;
  }

  /** Asegura subjects del catálogo maestro en la currícula vigente de cada nivel/año. */
  private async ensureActiveCurriculumSubjects(): Promise<void> {
    const row = await this.curriculumRepo
      .createQueryBuilder('c')
      .select('MAX(c.anio)', 'anio')
      .getRawOne<{ anio: string | null }>();
    const anio = row?.anio ? Number(row.anio) : new Date().getFullYear();
    const curriculas = await this.resolveCurriculasParaAsignacion(anio);
    for (const curr of curriculas) {
      await this.ensureCurriculumSubjectsFromMaestro(curr.id, curr.nivel);
    }
  }

  /**
   * Crea en la currícula los cursos faltantes tomando datos de maestros_cursos.
   * Permite reutilizar el catálogo maestro en cualquier año/nivel activo.
   */
  private async ensureCurriculumSubjectsFromMaestro(
    curriculumId: number,
    nivel: string,
  ): Promise<void> {
    const [maestros, existingSubjects, areas] = await Promise.all([
      this.maestroCursoRepo.find({ where: { nivel, activo: true } }),
      this.subjectRepo.find({ where: { curriculumId, activo: true } }),
      this.areaRepo.find({ where: { curriculumId, activo: true } }),
    ]);

    const existingKeys = new Set(
      existingSubjects.map((s) => maestroCursoKey(s.nivel, s.nombre)),
    );
    const areaByName = new Map(areas.map((a) => [a.nombre, a.id]));

    for (const maestro of maestros) {
      const key = maestroCursoKey(maestro.nivel, maestro.nombre);
      if (existingKeys.has(key)) continue;

      let areaId = areaByName.get(maestro.area);
      if (!areaId) {
        const maxOrden = areas.reduce((max, a) => Math.max(max, a.orden), 0);
        const savedArea = await this.areaRepo.save(
          this.areaRepo.create({
            curriculumId,
            nombre: maestro.area,
            nivel: maestro.nivel,
            orden: maxOrden + 1,
            colorClass: 'bg-gray-50 border-gray-200 text-gray-800',
            dotClass: 'bg-gray-500',
            activo: true,
          }),
        );
        areaId = savedArea.id;
        areaByName.set(maestro.area, areaId);
        areas.push(savedArea);
      }

      await this.subjectRepo.save(
        this.subjectRepo.create({
          curriculumId,
          nombre: maestro.nombre,
          areaId,
          nivel: maestro.nivel,
          grados: maestro.grados,
          horasSemanales: maestro.horasSemanales,
          maestroCursoId: maestro.id,
          activo: true,
        }),
      );
      existingKeys.add(key);
    }
  }

  private async buildMaestroCursoLookup(): Promise<Map<string, number>> {
    const maestros = await this.maestroCursoRepo.find({
      where: { activo: true },
    });
    return new Map(
      maestros.map((m) => [maestroCursoKey(m.nivel, m.nombre), m.id]),
    );
  }

  private async getCurriculumOrFail(id: number): Promise<Curriculum> {
    const curr = await this.curriculumRepo.findOneBy({ id });
    if (!curr) throw new NotFoundException(`Currícula ${id} no encontrada`);
    return curr;
  }

  private async getAreaOrFail(id: number): Promise<CurriculumArea> {
    const area = await this.areaRepo.findOneBy({ id });
    if (!area) throw new NotFoundException(`Área ${id} no encontrada`);
    return area;
  }
}
