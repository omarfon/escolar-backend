import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from '../grades/entities/grade.entity';
import { CursosMaestrosService } from '../maestros/cursos/cursos.service';
import { FormulasEvaluacionMaestrosService } from '../maestros/formulas-evaluacion/formulas-evaluacion.service';
import {
  calcNotaPonderada,
  nivelFromNota,
} from '../maestros/formulas-evaluacion/evaluation-formula.util';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { StudentsService } from '../students/students.service';
import { listStudentsForAula } from '../students/students-dedupe.util';
import { ApproveActaDto, GenerateActaDto } from './dto/acta.dto';
import {
  ActaAlumnoRow,
  ActaSnapshot,
  EvaluationActa,
} from './entities/evaluation-acta.entity';

export interface ActaListItem {
  id: number;
  nivel: string;
  grado: string;
  seccion: string;
  bimestre: number;
  anio: string;
  estado: string;
  docente: string;
  aprobadoPor: string;
  totalAlumnos: number;
  aprobados: number;
  desaprobados: number;
  promedioAula: number | null;
  fechaGeneracion: string;
  fechaAprobacion: string | null;
}

export interface ActaDetail extends ActaListItem {
  observaciones: string;
  snapshot: ActaSnapshot;
  cursos: string[];
  alumnos: ActaAlumnoRow[];
  bimestreActual: number;
  bimestresTerminados: number[];
}

export interface ActasBimestresDisponibles {
  anioEscolar: number;
  bimestreActual: number;
  bimestresTerminados: number[];
}

@Injectable()
export class ActasService {
  constructor(
    @InjectRepository(EvaluationActa)
    private readonly actaRepo: Repository<EvaluationActa>,
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    private readonly studentsService: StudentsService,
    private readonly formulasService: FormulasEvaluacionMaestrosService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly cursosMaestrosService: CursosMaestrosService,
  ) {}

  async getBimestresDisponibles(): Promise<ActasBimestresDisponibles> {
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const bimestresTerminados =
      await this.periodosService.resolveBimestresTerminados(anioEscolar);
    return { anioEscolar, bimestreActual, bimestresTerminados };
  }

  async findAll(query?: {
    nivel?: string;
    grado?: string;
    seccion?: string;
    bimestre?: number;
    estado?: string;
  }): Promise<ActaListItem[]> {
    const qb = this.actaRepo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');

    if (query?.nivel) qb.andWhere('a.nivel = :nivel', { nivel: query.nivel });
    if (query?.grado) qb.andWhere('a.grado = :grado', { grado: query.grado });
    if (query?.seccion) qb.andWhere('a.seccion = :seccion', { seccion: query.seccion });
    if (query?.bimestre) qb.andWhere('a.bimestre = :bimestre', { bimestre: query.bimestre });
    if (query?.estado) qb.andWhere('a.estado = :estado', { estado: query.estado });

    const rows = await qb.getMany();
    return rows.map((row) => this.toListItem(row));
  }

  async findOne(id: number): Promise<ActaDetail> {
    const acta = await this.getOrFail(id);
    return await this.toDetail(acta);
  }

  async generate(dto: GenerateActaDto): Promise<ActaDetail> {
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const anio = dto.anio?.trim() || String(anioEscolar);
    const bimestresTerminados =
      await this.periodosService.resolveBimestresTerminados(+anio);

    const existing = await this.actaRepo.findOne({
      where: {
        nivel: dto.nivel,
        grado: dto.grado,
        seccion: dto.seccion,
        bimestre: dto.bimestre,
        anio,
      },
    });

    if (!existing && !bimestresTerminados.includes(dto.bimestre)) {
      const lista =
        bimestresTerminados.length > 0
          ? bimestresTerminados.map((b) => `${b}°`).join(', ')
          : 'ninguno';
      throw new BadRequestException(
        `El acta se genera al concluir el bimestre. Bimestres cerrados: ${lista}.`,
      );
    }

    if (existing?.estado === 'cerrada') {
      throw new BadRequestException(
        'El acta de este salón y bimestre ya está cerrada y no puede modificarse',
      );
    }

    const snapshot = await this.buildSnapshot(
      dto.nivel,
      dto.grado,
      dto.seccion,
      dto.bimestre,
    );

    if (!snapshot.alumnos.length) {
      throw new BadRequestException(
        'No hay alumnos matriculados en este salón',
      );
    }

    const conNotas = snapshot.alumnos.some((a) =>
      Object.values(a.notas).some((n) => n !== null),
    );
    if (!conNotas) {
      throw new BadRequestException(
        'No hay notas registradas en este bimestre para generar el acta',
      );
    }

    if (existing) {
      existing.estado = 'generada';
      existing.docente = dto.docente?.trim() || existing.docente || 'Docente titular';
      existing.observaciones = dto.observaciones?.trim() ?? existing.observaciones;
      existing.snapshot = snapshot;
      existing.approvedAt = null;
      existing.closedAt = null;
      existing.aprobadoPor = '';
      const saved = await this.actaRepo.save(existing);
      return await this.toDetail(saved);
    }

    const saved = await this.actaRepo.save(
      this.actaRepo.create({
        nivel: dto.nivel,
        grado: dto.grado,
        seccion: dto.seccion,
        bimestre: dto.bimestre,
        anio,
        estado: 'generada',
        docente: dto.docente?.trim() || 'Docente titular',
        observaciones: dto.observaciones?.trim() || '',
        snapshot,
      }),
    );

    return await this.toDetail(saved);
  }

  async approve(id: number, dto: ApproveActaDto): Promise<ActaDetail> {
    const acta = await this.getOrFail(id);
    if (acta.estado !== 'generada') {
      throw new BadRequestException('Solo se pueden aprobar actas en estado generada');
    }
    acta.estado = 'aprobada';
    acta.aprobadoPor = dto.aprobadoPor?.trim() || 'Dirección';
    acta.approvedAt = new Date();
    const saved = await this.actaRepo.save(acta);
    return await this.toDetail(saved);
  }

  async close(id: number): Promise<ActaDetail> {
    const acta = await this.getOrFail(id);
    if (acta.estado !== 'aprobada') {
      throw new BadRequestException('Solo se pueden cerrar actas aprobadas');
    }
    acta.estado = 'cerrada';
    acta.closedAt = new Date();
    const saved = await this.actaRepo.save(acta);
    return await this.toDetail(saved);
  }

  async remove(id: number) {
    const acta = await this.getOrFail(id);
    if (acta.estado === 'cerrada') {
      throw new BadRequestException('No se puede eliminar un acta cerrada');
    }
    await this.actaRepo.remove(acta);
    return { deleted: true, id };
  }

  private async buildSnapshot(
    nivel: string,
    grado: string,
    seccion: string,
    bimestre: number,
  ): Promise<ActaSnapshot> {
    const students = listStudentsForAula(
      await this.studentsService.findAll(),
      nivel,
      grado,
      seccion,
    );

    if (!students.length) {
      return {
        cursos: [],
        alumnos: [],
        resumen: { total: 0, aprobados: 0, desaprobados: 0, promedioAula: null },
      };
    }

    const cursosMaestros = await this.cursosMaestrosService.findAll({
      activo: true,
      nivel,
    });
    const catalogCursos = cursosMaestros
      .filter((c) => (c.grados ?? []).includes(grado))
      .map((c) => c.nombre);

    const allGrades = await this.gradesRepo.find({ where: { bimestre } });
    const fromGrades = [
      ...new Set(
        allGrades
          .filter((g) => students.some((s) => s.id === g.studentId))
          .map((g) => g.curso),
      ),
    ];

    const cursos = [...new Set([...catalogCursos, ...fromGrades])].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );

    const formulaCache = new Map<
      string,
      Awaited<ReturnType<FormulasEvaluacionMaestrosService['resolve']>>
    >();
    const alumnos: ActaAlumnoRow[] = [];

    const resolveFormula = async (curso: string) => {
      const key = `${nivel}|${grado}|${curso}|${bimestre}`;
      if (!formulaCache.has(key)) {
        formulaCache.set(
          key,
          await this.formulasService.resolve({ nivel, grado, curso, bimestre }),
        );
      }
      return formulaCache.get(key)!;
    };

    const calcCursoPonderado = async (
      studentId: number,
      curso: string,
    ): Promise<{
      nota: number | null;
      escala: Awaited<
        ReturnType<FormulasEvaluacionMaestrosService['resolve']>
      >['escalaLogro'];
    }> => {
      const formula = await resolveFormula(curso);
      const studentGrades = allGrades.filter(
        (g) => g.studentId === studentId && g.curso === curso,
      );
      const notasCalc: Record<string, number | null> = {};

      for (const comp of formula.componentes) {
        const match = studentGrades.find(
          (g) =>
            g.componenteCodigo === comp.codigo ||
            (!g.componenteCodigo && g.tipo === mapTipoFromCodigo(comp.codigo)),
        );
        notasCalc[comp.codigo] = match?.nota ?? null;
      }

      return {
        nota: calcNotaPonderada(formula.componentes, notasCalc),
        escala: formula.escalaLogro,
      };
    };

    for (const student of students) {
      const notas: Record<string, number | null> = {};
      const courseAvgs: number[] = [];
      let escalaReferencia: Awaited<
        ReturnType<FormulasEvaluacionMaestrosService['resolve']>
      >['escalaLogro'] | null = null;

      for (const curso of cursos) {
        const { nota, escala } = await calcCursoPonderado(student.id, curso);
        notas[curso] = nota;
        if (nota !== null) {
          courseAvgs.push(nota);
          escalaReferencia ??= escala;
        }
      }

      const promedio = avgNumbers(courseAvgs);
      const nivelLogro =
        promedio !== null && escalaReferencia
          ? nivelFromNota(promedio, escalaReferencia)
          : null;
      let situacion: ActaAlumnoRow['situacion'] = 'sin_notas';
      if (promedio !== null) {
        situacion = promedio >= 11 ? 'aprobado' : 'desaprobado';
      }

      alumnos.push({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        notas,
        promedio,
        nivel: nivelLogro,
        situacion,
      });
    }

    alumnos.sort((a, b) => a.estudiante.localeCompare(b.estudiante, 'es'));

    const promedios = alumnos
      .map((a) => a.promedio)
      .filter((v): v is number => v !== null);

    return {
      cursos,
      alumnos,
      resumen: {
        total: alumnos.length,
        aprobados: alumnos.filter((a) => a.situacion === 'aprobado').length,
        desaprobados: alumnos.filter((a) => a.situacion === 'desaprobado').length,
        promedioAula: avgNumbers(promedios),
      },
    };
  }

  private toListItem(acta: EvaluationActa): ActaListItem {
    const snap = acta.snapshot;
    return {
      id: acta.id,
      nivel: acta.nivel,
      grado: acta.grado,
      seccion: acta.seccion,
      bimestre: acta.bimestre,
      anio: acta.anio,
      estado: acta.estado,
      docente: acta.docente,
      aprobadoPor: acta.aprobadoPor,
      totalAlumnos: snap?.alumnos?.length ?? snap?.resumen.total ?? 0,
      aprobados: snap?.resumen.aprobados ?? 0,
      desaprobados: snap?.resumen.desaprobados ?? 0,
      promedioAula: snap?.resumen.promedioAula ?? null,
      fechaGeneracion: this.formatDateTime(acta.createdAt),
      fechaAprobacion: acta.approvedAt
        ? this.formatDateTime(acta.approvedAt)
        : null,
    };
  }

  private async toDetail(acta: EvaluationActa): Promise<ActaDetail> {
    const base = this.toListItem(acta);
    const snap = acta.snapshot ?? {
      cursos: [],
      alumnos: [],
      resumen: { total: 0, aprobados: 0, desaprobados: 0, promedioAula: null },
    };
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const bimestresTerminados =
      await this.periodosService.resolveBimestresTerminados(+acta.anio);
    return {
      ...base,
      observaciones: acta.observaciones,
      snapshot: snap,
      cursos: snap.cursos,
      alumnos: snap.alumnos,
      bimestreActual,
      bimestresTerminados,
    };
  }

  private async getOrFail(id: number): Promise<EvaluationActa> {
    const acta = await this.actaRepo.findOneBy({ id });
    if (!acta) throw new NotFoundException(`Acta ${id} no encontrada`);
    return acta;
  }

  private formatDateTime(value: Date): string {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

function avgNumbers(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function mapTipoFromCodigo(codigo: string): Grade['tipo'] {
  const lower = codigo.toLowerCase();
  if (lower.includes('final')) return 'final';
  if (lower.includes('parcial') || lower.includes('examen')) return 'partial';
  return 'daily';
}
