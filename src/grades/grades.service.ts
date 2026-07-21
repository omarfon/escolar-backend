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

export interface CursoPromedio {
  curso: string;
  b1: number | null;
  b2: number | null;
  b3: number | null;
  b4: number | null;
  promedioAnual: number | null;
  nivel: string | null;
}

export interface AlumnoPromedio {
  studentId: number;
  estudiante: string;
  nivel: string;
  grado: string;
  seccion: string;
  cursos: CursoPromedio[];
  promedioGeneral: number | null;
  nivelGeneral: string | null;
}

export interface PromediosResumen {
  totalAlumnos: number;
  promedioAula: number | null;
  aprobados: number;
  desaprobados: number;
  enRiesgo: number;
  destacados: number;
}

export interface PromediosResponse {
  resumen: PromediosResumen;
  alumnos: AlumnoPromedio[];
  cursosDisponibles: string[];
  bimestreActual: number;
}

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

    return {
      saved,
      registry: await this.getRegistry({
        nivel: dto.nivel ?? '',
        grado: dto.grado ?? '',
        seccion: dto.seccion ?? '',
        curso: dto.curso,
        bimestre: dto.bimestre,
      }),
    };
  }

  async computeAverages(query?: {
    nivel?: string;
    grado?: string;
    seccion?: string;
    curso?: string;
    busqueda?: string;
  }): Promise<PromediosResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const students = await this.studentsService.findAll();
    let filtered = students.filter(isStudentMatriculaActiva);

    if (query?.nivel) filtered = filtered.filter((s) => s.nivel === query.nivel);
    if (query?.grado) filtered = filtered.filter((s) => s.grado === query.grado);
    if (query?.seccion) {
      filtered = filtered.filter((s) =>
        matchesStudentSection(s, query.seccion!),
      );
    }
    filtered = dedupeStudentsByPerson(filtered);

    if (query?.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        `${s.apellido} ${s.nombre} ${s.grado}`.toLowerCase().includes(q),
      );
    }

    const allGrades = await this.gradesRepository.find();
    const formulaCache = new Map<string, Awaited<ReturnType<FormulasEvaluacionMaestrosService['resolve']>>>();
    const cursosSet = new Set<string>();
    const alumnos: AlumnoPromedio[] = [];

    const resolveFormula = async (
      nivel: string,
      grado: string,
      curso: string,
      bimestre: number,
    ) => {
      const key = `${nivel}|${grado}|${curso}|${bimestre}`;
      if (!formulaCache.has(key)) {
        formulaCache.set(
          key,
          await this.formulasService.resolve({ nivel, grado, curso, bimestre }),
        );
      }
      return formulaCache.get(key)!;
    };

    const calcBimestrePonderado = async (
      student: (typeof filtered)[number],
      curso: string,
      bimestre: number,
    ): Promise<number | null> => {
      if (bimestre > bimestreActual) return null;
      const formula = await resolveFormula(
        student.nivel,
        student.grado,
        curso,
        bimestre,
      );
      const studentGrades = allGrades.filter(
        (g) =>
          g.studentId === student.id &&
          g.curso === curso &&
          g.bimestre === bimestre,
      );
      const notasCalc: Record<string, number | null> = {};
      for (const comp of formula.componentes) {
        const match = studentGrades.find(
          (g) =>
            g.componenteCodigo === comp.codigo ||
            (!g.componenteCodigo &&
              g.tipo === mapTipoFromCodigo(comp.codigo)),
        );
        notasCalc[comp.codigo] = match?.nota ?? null;
      }
      return calcNotaPonderada(formula.componentes, notasCalc);
    };

    for (const student of filtered) {
      const studentGrades = allGrades.filter((g) => g.studentId === student.id);
      const byCurso = new Map<string, Grade[]>();

      for (const grade of studentGrades) {
        cursosSet.add(grade.curso);
        const list = byCurso.get(grade.curso) ?? [];
        list.push(grade);
        byCurso.set(grade.curso, list);
      }

      let cursosToProcess = [...byCurso.keys()];
      if (query?.curso) {
        cursosToProcess = cursosToProcess.filter((c) => c === query.curso);
      }

      const cursos: CursoPromedio[] = [];
      for (const curso of cursosToProcess) {
        const b1 = await calcBimestrePonderado(student, curso, 1);
        const b2 = await calcBimestrePonderado(student, curso, 2);
        const b3 = await calcBimestrePonderado(student, curso, 3);
        const b4 = await calcBimestrePonderado(student, curso, 4);
        const bimAvgs = [b1, b2, b3, b4]
          .slice(0, bimestreActual)
          .filter((v): v is number => v !== null);
        const promedioAnual = avgNumbers(bimAvgs);
        const formula = await resolveFormula(
          student.nivel,
          student.grado,
          curso,
          bimestreActual,
        );
        cursos.push({
          curso,
          b1,
          b2,
          b3,
          b4,
          promedioAnual,
          nivel:
            promedioAnual !== null
              ? nivelFromNota(promedioAnual, formula.escalaLogro)
              : null,
        });
      }

      const courseAvgs = cursos
        .map((c) => c.promedioAnual)
        .filter((v): v is number => v !== null);
      const promedioGeneral = avgNumbers(courseAvgs);

      if (query?.curso && cursos.length === 0) continue;

      alumnos.push({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        nivel: student.nivel,
        grado: student.grado,
        seccion: student.seccion.trim().toUpperCase(),
        cursos,
        promedioGeneral,
        nivelGeneral:
          promedioGeneral !== null ? nivelFromNotaLocal(promedioGeneral) : null,
      });
    }

    alumnos.sort((a, b) =>
      (b.promedioGeneral ?? 0) - (a.promedioGeneral ?? 0),
    );

    const promediosGenerales = alumnos
      .map((a) => a.promedioGeneral)
      .filter((v): v is number => v !== null);

    const resumen: PromediosResumen = {
      totalAlumnos: alumnos.length,
      promedioAula: avgNumbers(promediosGenerales),
      aprobados: alumnos.filter((a) => (a.promedioGeneral ?? 0) >= 11).length,
      desaprobados: alumnos.filter(
        (a) => a.promedioGeneral !== null && a.promedioGeneral < 11,
      ).length,
      enRiesgo: alumnos.filter(
        (a) => a.promedioGeneral !== null && a.promedioGeneral < 11,
      ).length,
      destacados: alumnos.filter(
        (a) => a.promedioGeneral !== null && a.promedioGeneral >= 17.5,
      ).length,
    };

    let cursosDisponibles = [...cursosSet].sort();
    if (query?.curso) cursosDisponibles = [query.curso];

    return { resumen, alumnos, cursosDisponibles, bimestreActual };
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

function avgNumbers(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function nivelFromNotaLocal(nota: number): string {
  if (nota >= 17.5) return 'AD';
  if (nota >= 14) return 'A';
  if (nota >= 11) return 'B';
  return 'C';
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
