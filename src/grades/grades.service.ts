import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { FormulasEvaluacionMaestrosService } from '../maestros/formulas-evaluacion/formulas-evaluacion.service';
import { CursosMaestrosService } from '../maestros/cursos/cursos.service';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import {
  calcNotaPonderada,
  nivelFromNota,
} from '../maestros/formulas-evaluacion/evaluation-formula.util';
import { GradingConfigService } from '../grading/grading-config.service';
import { PromediosService } from '../promedios/promedios.service';
import type { PromediosResponse } from '../promedios/promedios.types';
export type {
  AlumnoPromedio,
  CursoPromedio,
  PromediosResumen,
  PromediosResponse,
} from '../promedios/promedios.types';
import { StudentsService } from '../students/students.service';
import {
  dedupeStudentsByPerson,
  isStudentMatriculaActiva,
  listStudentsForAula,
  matchesStudentSection,
} from '../students/students-dedupe.util';
import { CreateGradeDto } from './dto/create-grade.dto';
import { SaveGradeRegistryDto } from './dto/grade-registry.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Grade } from './entities/grade.entity';
import {
  REGISTRO_NOTAS_COMPONENTES,
  REGISTRO_NOTAS_DEMO_COMBOS,
  registroNotasDemoNota,
  registroNotasFechaEvaluacion,
  registroNotasOmitirComponente,
} from './registro-notas-seed.data';

export interface RegistryComponenteNota {
  gradeId?: number;
  nota: number | null;
}

export interface RegistryAlumnoRow {
  studentId: number;
  nombre: string;
  apellido: string;
  codigo: string;
  componentes: Record<string, RegistryComponenteNota>;
  promedioBimestre: number | null;
  nivel: string | null;
}

export interface GradeRegistryResponse {
  formula: Awaited<ReturnType<FormulasEvaluacionMaestrosService['resolve']>>;
  bimestre: number;
  curso: string;
  nivel: string;
  grado: string;
  seccion: string;
  alumnos: RegistryAlumnoRow[];
  bimestreActual: number;
  bimestreHabilitado: boolean;
}

export interface RegistryContextCurso {
  nombre: string;
  conNotas: boolean;
}

export interface RegistryContextItem {
  id: string;
  nivel: string;
  grado: string;
  seccion: string;
  label: string;
  alumnosCount: number;
  cursos: RegistryContextCurso[];
  cursoSugerido: string;
}

export interface RegistryContextsResponse {
  bimestreActual: number;
  contexts: RegistryContextItem[];
}

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradesRepository: Repository<Grade>,
    private readonly studentsService: StudentsService,
    private readonly formulasService: FormulasEvaluacionMaestrosService,
    private readonly cursosMaestrosService: CursosMaestrosService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly gradingConfigService: GradingConfigService,
    private readonly promediosService: PromediosService,
  ) {}

  create(createGradeDto: CreateGradeDto) {
    const entity = this.gradesRepository.create({
      ...createGradeDto,
      componenteCodigo:
        createGradeDto.componenteCodigo?.trim() ??
        mapLegacyComponente(createGradeDto.tipo),
    });
    return this.gradesRepository.save(entity);
  }

  findAll(query?: {
    studentId?: number;
    curso?: string;
    bimestre?: number;
  }) {
    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .orderBy('g.fechaEvaluacion', 'DESC');

    if (query?.studentId) {
      qb.andWhere('g.studentId = :studentId', { studentId: query.studentId });
    }
    if (query?.curso) {
      qb.andWhere('g.curso = :curso', { curso: query.curso });
    }
    if (query?.bimestre) {
      qb.andWhere('g.bimestre = :bimestre', { bimestre: query.bimestre });
    }

    return qb.getMany();
  }

  findOne(id: number) {
    return this.getOrFail(id);
  }

  async update(id: number, updateGradeDto: UpdateGradeDto) {
    const current = await this.getOrFail(id);
    const merged = this.gradesRepository.merge(current, updateGradeDto);
    return this.gradesRepository.save(merged);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.gradesRepository.remove(current);
    return { deleted: true, id };
  }

  async listRegistryContexts(bimestre = 2): Promise<RegistryContextsResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const students = await this.studentsService.findAll();
    const grades = await this.gradesRepository.find();
    const cursosMaestros = await this.cursosMaestrosService.findAll({
      activo: true,
    });

    const activos = students.filter(
      (s) => isStudentMatriculaActiva(s),
    );

    const groups = new Map<
      string,
      {
        nivel: string;
        grado: string;
        seccion: string;
        studentIds: number[];
      }
    >();

    const processedKeys = new Set<string>();
    for (const student of activos) {
      const seccion = student.seccion.trim().toUpperCase();
      const key = `${student.nivel}|${student.grado}|${seccion}`;
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);

      const personas = dedupeStudentsByPerson(
        activos.filter(
          (s) =>
            s.nivel === student.nivel &&
            s.grado === student.grado &&
            matchesStudentSection(s, seccion),
        ),
      );
      groups.set(key, {
        nivel: student.nivel,
        grado: student.grado,
        seccion,
        studentIds: personas.map((s) => s.id),
      });
    }

    const contexts: RegistryContextItem[] = [];

    for (const group of groups.values()) {
      const studentSet = new Set(group.studentIds);
      const gradesSection = grades.filter((g) => studentSet.has(g.studentId));

      const catalog = cursosMaestros
        .filter(
          (c) =>
            c.nivel === group.nivel && (c.grados ?? []).includes(group.grado),
        )
        .map((c) => c.nombre);

      const fromGrades = [
        ...new Set(gradesSection.map((g) => g.curso).filter(Boolean)),
      ];

      const nombres = [...new Set([...catalog, ...fromGrades])].sort((a, b) =>
        a.localeCompare(b, 'es'),
      );

      const cursosConNotas = new Set(
        gradesSection
          .filter(
            (g) =>
              g.bimestre === bimestre && g.bimestre <= bimestreActual,
          )
          .map((g) => g.curso),
      );

      const cursos: RegistryContextCurso[] = nombres.map((nombre) => ({
        nombre,
        conNotas: cursosConNotas.has(nombre),
      }));

      const cursoSugerido =
        cursos.find((c) => c.conNotas)?.nombre ??
        cursos.find((c) => c.nombre === 'Matemática')?.nombre ??
        cursos[0]?.nombre ??
        '';

      contexts.push({
        id: `${group.nivel}|${group.grado}|${group.seccion}`,
        nivel: group.nivel,
        grado: group.grado,
        seccion: group.seccion,
        label: `${group.nivel} · ${group.grado} · ${group.seccion}`,
        alumnosCount: group.studentIds.length,
        cursos,
        cursoSugerido,
      });
    }

    return {
      bimestreActual,
      contexts: contexts.sort((a, b) => {
      const byNivel = a.nivel.localeCompare(b.nivel, 'es');
      if (byNivel !== 0) return byNivel;
      const byGrado = a.grado.localeCompare(b.grado, 'es', { numeric: true });
      if (byGrado !== 0) return byGrado;
      return a.seccion.localeCompare(b.seccion, 'es');
    }),
    };
  }

  async getRegistry(query: {
    nivel: string;
    grado: string;
    seccion: string;
    curso: string;
    bimestre: number;
  }): Promise<GradeRegistryResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const students = await this.studentsService.findAll();
    const filtered = listStudentsForAula(
      students,
      query.nivel,
      query.grado,
      query.seccion,
    );

    const formula = await this.formulasService.resolve({
      nivel: query.nivel,
      grado: query.grado,
      curso: query.curso,
      bimestre: query.bimestre,
    });

    const grades =
      query.bimestre <= bimestreActual
        ? await this.gradesRepository.find({
            where: {
              curso: query.curso,
              bimestre: query.bimestre,
            },
          })
        : [];

    const alumnos: RegistryAlumnoRow[] = filtered.map((student) => {
      const studentGrades = grades.filter((g) => g.studentId === student.id);
      const componentes: Record<string, RegistryComponenteNota> = {};
      const notasCalc: Record<string, number | null> = {};

      for (const comp of formula.componentes) {
        const match = studentGrades.find(
          (g) =>
            g.componenteCodigo === comp.codigo ||
            (!g.componenteCodigo && g.tipo === mapTipoFromCodigo(comp.codigo)),
        );
        const nota = match?.nota ?? null;
        componentes[comp.codigo] = {
          gradeId: match?.id,
          nota,
        };
        notasCalc[comp.codigo] = nota;
      }

      const promedioBimestre = calcNotaPonderada(formula.componentes, notasCalc);

      return {
        studentId: student.id,
        nombre: student.nombre,
        apellido: student.apellido,
        codigo: student.codigo || `2026-${String(student.id).padStart(3, '0')}`,
        componentes,
        promedioBimestre,
        nivel:
          promedioBimestre !== null
            ? nivelFromNota(promedioBimestre, formula.escalaLogro)
            : null,
      };
    });

    return {
      formula,
      bimestre: query.bimestre,
      curso: query.curso,
      nivel: query.nivel,
      grado: query.grado,
      seccion: query.seccion,
      alumnos,
      bimestreActual,
      bimestreHabilitado: query.bimestre <= bimestreActual,
    };
  }

  async saveRegistryBulk(dto: SaveGradeRegistryDto) {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    if (dto.bimestre > bimestreActual) {
      throw new BadRequestException(
        `El bimestre ${dto.bimestre} aún no está habilitado. Periodo actual: ${bimestreActual}° bimestre.`,
      );
    }

    let saved = 0;
    for (const entry of dto.entries) {
      const existing = entry.gradeId
        ? await this.gradesRepository.findOneBy({ id: entry.gradeId })
        : await this.gradesRepository.findOne({
            where: {
              studentId: entry.studentId,
              curso: dto.curso,
              bimestre: dto.bimestre,
              componenteCodigo: entry.componenteCodigo,
            },
          });

      if (existing) {
        existing.nota = entry.nota;
        existing.fechaEvaluacion = dto.fechaEvaluacion;
        await this.gradesRepository.save(existing);
      } else {
        await this.gradesRepository.save(
          this.gradesRepository.create({
            studentId: entry.studentId,
            curso: dto.curso,
            bimestre: dto.bimestre,
            nota: entry.nota,
            fechaEvaluacion: dto.fechaEvaluacion,
            componenteCodigo: entry.componenteCodigo,
            tipo: mapTipoFromCodigo(entry.componenteCodigo),
          }),
        );
      }
      saved++;
    }

    const registry = await this.getRegistry({
      nivel: dto.nivel ?? '',
      grado: dto.grado ?? '',
      seccion: dto.seccion ?? '',
      curso: dto.curso,
      bimestre: dto.bimestre,
    });

    await this.promediosService.syncRegistryPromedios(registry);

    return {
      saved,
      registry,
    };
  }

  async computeAverages(query?: {
    nivel?: string;
    grado?: string;
    seccion?: string;
    curso?: string;
    busqueda?: string;
  }): Promise<PromediosResponse> {
    return this.promediosService.getAverages(query);
  }

  getGradingConfig() {
    return this.gradingConfigService.getConfig();
  }

  private async getOrFail(id: number): Promise<Grade> {
    const grade = await this.gradesRepository.findOneBy({ id });
    if (!grade) throw new NotFoundException(`Grade ${id} no encontrado`);
    return grade;
  }

  /** Notas por componente (componenteCodigo) para el registro de evaluación. */
  async seedRegistroNotasDemo(): Promise<void> {
    await this.backfillComponenteCodigoLegacy();

    const minConComponente = 60;
    const existentes = await this.gradesRepository.count({
      where: { componenteCodigo: Not('') },
    });
    if (existentes >= minConComponente) return;

    const students = await this.studentsService.findAll();
    const activos = students.filter(
      (s) => isStudentMatriculaActiva(s),
    );

    for (const combo of REGISTRO_NOTAS_DEMO_COMBOS) {
      const alumnos = activos
        .filter(
          (s) =>
            s.nivel === combo.nivel &&
            s.grado === combo.grado &&
            s.seccion.toUpperCase() === combo.seccion.toUpperCase(),
        )
        .sort((a, b) =>
          `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`),
        );

      if (!alumnos.length) continue;

      for (const alumno of alumnos) {
        for (const [compIdx, comp] of REGISTRO_NOTAS_COMPONENTES.entries()) {
          if (registroNotasOmitirComponente(alumno.id, compIdx)) continue;

          const duplicado = await this.gradesRepository.findOne({
            where: {
              studentId: alumno.id,
              curso: combo.curso,
              bimestre: combo.bimestre,
              componenteCodigo: comp.codigo,
            },
          });
          if (duplicado) continue;

          await this.gradesRepository.save(
            this.gradesRepository.create({
              studentId: alumno.id,
              curso: combo.curso,
              bimestre: combo.bimestre,
              componenteCodigo: comp.codigo,
              tipo: comp.tipo,
              nota: registroNotasDemoNota(
                alumno.id,
                combo.bimestre,
                compIdx,
                combo.curso,
              ),
              fechaEvaluacion: registroNotasFechaEvaluacion(
                combo.bimestre,
                comp.dia,
              ),
              descripcion: `${combo.grado} ${combo.seccion} — ${comp.codigo} B${combo.bimestre}`,
            }),
          );
        }
      }
    }
  }

  /** Asigna componenteCodigo a notas antiguas (tipo daily/partial/final). */
  private async backfillComponenteCodigoLegacy(): Promise<void> {
    const legacy = await this.gradesRepository
      .createQueryBuilder('g')
      .where(`COALESCE(g."componenteCodigo", '') = ''`)
      .getMany();

    for (const row of legacy) {
      row.componenteCodigo = mapLegacyComponente(row.tipo);
      await this.gradesRepository.save(row);
    }
  }
}

function mapTipoFromCodigo(codigo: string): Grade['tipo'] {
  const lower = codigo.toLowerCase();
  if (lower.includes('final')) return 'final';
  if (lower.includes('parcial') || lower.includes('examen')) return 'partial';
  return 'daily';
}

function mapLegacyComponente(tipo: Grade['tipo']): string {
  if (tipo === 'final') return 'examen_final';
  if (tipo === 'partial') return 'examen_parcial';
  return 'trabajo_exposicion';
}
