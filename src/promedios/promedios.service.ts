import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { calcPromedioNivel } from '../competency-evaluations/competency-evaluations.util';
import { GradingConfigService } from '../grading/grading-config.service';
import type { GradingConfigDto } from '../grading/grading-config.types';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import {
  dedupeStudentsByPerson,
  isStudentMatriculaActiva,
  matchesStudentSection,
} from '../students/students-dedupe.util';
import { StudentsService } from '../students/students.service';
import { Promedio, PromedioNivelLogro, PromedioTipo } from './entities/promedio.entity';
import { buildPromediosSeedRows } from './promedios-seed.data';
import {
  AlumnoPromedio,
  CursoPromedio,
  PromediosQuery,
  PromediosResumen,
  PromediosResponse,
} from './promedios.types';

function avgNumbers(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

@Injectable()
export class PromediosService {
  constructor(
    @InjectRepository(Promedio)
    private readonly promediosRepo: Repository<Promedio>,
    private readonly studentsService: StudentsService,
    private readonly gradingConfigService: GradingConfigService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
  ) {}

  /** Lectura en vivo desde tabla `promedios` (sin seed ni cálculo desde notas sueltas). */
  async getForStudent(
    studentId: number,
    anio?: number,
  ): Promise<{
    cursos: CursoPromedio[];
    promedioGeneral: number | null;
    nivelGeneral: string | null;
  }> {
    const cfg = this.gradingConfigService.getConfig();
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const year = anio ?? (await this.periodosService.resolveAnioEscolarActual());

    const rows = await this.promediosRepo.find({
      where: { studentId, anio: year },
    });

    // Siempre leer ambos tipos de la tabla `promedios` (numérico y competencia).
    const numericRows = rows.filter((r) => r.tipo === 'numerico');
    const competencyRows = rows.filter((r) => r.tipo === 'competencia');

    const numericCursos = this.buildCursoPromedios(
      numericRows,
      'numerico',
      bimestreActual,
      undefined,
      cfg,
    );
    const competencyCursos = this.buildCursoPromedios(
      competencyRows,
      'competencia',
      bimestreActual,
      undefined,
      cfg,
    );

    const cursos = this.mergeCursoPromedios(numericCursos, competencyCursos);

    const promedioGeneral = avgNumbers(
      numericCursos
        .map((c) => c.promedioAnual)
        .filter((v): v is number => v !== null),
    );

    const allNiveles = competencyCursos.flatMap((c) =>
      [c.b1Nivel, c.b2Nivel, c.b3Nivel, c.b4Nivel]
        .slice(0, bimestreActual)
        .filter(Boolean),
    ) as PromedioNivelLogro[];

    return {
      cursos,
      promedioGeneral,
      nivelGeneral: calcPromedioNivel(allNiveles),
    };
  }

  async getAverages(query?: PromediosQuery): Promise<PromediosResponse> {
    const cfg = this.gradingConfigService.getConfig();
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const anio = await this.periodosService.resolveAnioEscolarActual();

    const empty: PromediosResponse = {
      resumen: {
        totalAlumnos: 0,
        promedioAula: null,
        promedioAulaNivel: null,
        aprobados: 0,
        desaprobados: 0,
        enRiesgo: 0,
        destacados: 0,
      },
      alumnos: [],
      cursosDisponibles: [],
      areasDisponibles: [],
      bimestreActual,
      gradingConfig: cfg,
    };

    if (!query?.nivel || !query?.grado || !query?.seccion) {
      return empty;
    }

    const students = await this.filterStudents(query);
    if (!students.length) return empty;

    const studentIds = students.map((s) => s.id);
    const rows = await this.promediosRepo.find({
      where: { studentId: In(studentIds), anio },
    });

    const numericRows = rows.filter((r) => r.tipo === 'numerico');
    const competencyRows = rows.filter((r) => r.tipo === 'competencia');

    const cursosSet = new Set<string>();
    const areasSet = new Set<string>();
    for (const r of numericRows) cursosSet.add(r.curso);
    for (const r of competencyRows) areasSet.add(r.curso);

    let cursosDisponibles = [...cursosSet].sort();
    let areasDisponibles = [...areasSet].sort();
    if (query.curso) {
      if (cursosDisponibles.includes(query.curso)) {
        cursosDisponibles = [query.curso];
      }
      if (areasDisponibles.includes(query.curso)) {
        areasDisponibles = [query.curso];
      }
    }

    const alumnos: AlumnoPromedio[] = [];

    for (const student of students) {
      const numericCursos = this.buildCursoPromedios(
        numericRows.filter((r) => r.studentId === student.id),
        'numerico',
        bimestreActual,
        query.curso,
        cfg,
      );
      const competencyCursos = this.buildCursoPromedios(
        competencyRows.filter((r) => r.studentId === student.id),
        'competencia',
        bimestreActual,
        query.curso,
        cfg,
      );

      const cursos = this.mergeCursoPromedios(numericCursos, competencyCursos);
      if (query.curso && !cursos.length) continue;

      const promedioGeneral = avgNumbers(
        numericCursos
          .map((c) => c.promedioAnual)
          .filter((v): v is number => v !== null),
      );

      const allNiveles = competencyCursos.flatMap((c) =>
        [c.b1Nivel, c.b2Nivel, c.b3Nivel, c.b4Nivel]
          .slice(0, bimestreActual)
          .filter(Boolean),
      ) as PromedioNivelLogro[];

      alumnos.push({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        nivel: student.nivel,
        grado: student.grado,
        seccion: student.seccion.trim().toUpperCase(),
        cursos,
        promedioGeneral,
        nivelGeneral: calcPromedioNivel(allNiveles),
      });
    }

    alumnos.sort((a, b) => (b.promedioGeneral ?? 0) - (a.promedioGeneral ?? 0));

    const resumen = this.buildResumen(alumnos, cfg);

    return {
      resumen,
      alumnos,
      cursosDisponibles,
      areasDisponibles,
      bimestreActual,
      gradingConfig: cfg,
    };
  }

  /** Solo para scripts manuales de demo (`npm run db:promedios-data`). No se ejecuta al iniciar el servidor. */
  async seedIfEmpty(): Promise<number> {
    const count = await this.promediosRepo.count();
    if (count > 0) return 0;

    const anio = await this.periodosService.resolveAnioEscolarActual();
    const students = (await this.studentsService.findAll())
      .filter(isStudentMatriculaActiva)
      .filter(
        (s) =>
          (s.nivel === 'Primaria' && s.grado === '5°') ||
          (s.nivel === 'Primaria' && s.grado === '4°' && s.seccion.toUpperCase() === 'A'),
      );

    const ids = dedupeStudentsByPerson(students).map((s) => s.id);
    if (!ids.length) return 0;

    const rows = buildPromediosSeedRows(ids, anio, [1, 2]);
    await this.promediosRepo.save(rows.map((r) => this.promediosRepo.create(r)));
    return rows.length;
  }

  async seedDemo(force = false): Promise<number> {
    const anio = await this.periodosService.resolveAnioEscolarActual();
    if (force) {
      await this.promediosRepo.delete({ anio });
    } else if (await this.promediosRepo.count()) {
      return 0;
    }

    const students = (await this.studentsService.findAll())
      .filter(isStudentMatriculaActiva)
      .filter((s) => s.nivel === 'Primaria' && s.grado === '5°');

    const ids = dedupeStudentsByPerson(students).map((s) => s.id);
    if (!ids.length) return 0;

    const rows = buildPromediosSeedRows(ids, anio, [1, 2]);
    await this.promediosRepo.save(rows.map((r) => this.promediosRepo.create(r)));
    return rows.length;
  }

  /** Persiste/actualiza promedios oficiales en BD (fuente de verdad para portal padre y reportes). */
  async upsertPromedio(row: {
    studentId: number;
    curso: string;
    tipo: PromedioTipo;
    bimestre: number;
    anio: number;
    valorNumerico: number | null;
    nivelLogro: PromedioNivelLogro | null;
  }): Promise<void> {
    const existing = await this.promediosRepo.findOne({
      where: {
        studentId: row.studentId,
        curso: row.curso,
        tipo: row.tipo,
        bimestre: row.bimestre,
        anio: row.anio,
      },
    });

    if (existing) {
      existing.valorNumerico = row.valorNumerico;
      existing.nivelLogro = row.nivelLogro;
      await this.promediosRepo.save(existing);
      return;
    }

    await this.promediosRepo.save(this.promediosRepo.create(row));
  }

  /** Sincroniza tabla `promedios` tras guardar el registro de notas por bimestre/curso. */
  async syncRegistryPromedios(registry: {
    curso: string;
    bimestre: number;
    alumnos: Array<{
      studentId: number;
      promedioBimestre: number | null;
      nivel: string | null;
    }>;
  }): Promise<number> {
    const anio = await this.periodosService.resolveAnioEscolarActual();
    let synced = 0;

    for (const alumno of registry.alumnos) {
      if (alumno.promedioBimestre !== null) {
        await this.upsertPromedio({
          studentId: alumno.studentId,
          curso: registry.curso,
          tipo: 'numerico',
          bimestre: registry.bimestre,
          anio,
          valorNumerico: alumno.promedioBimestre,
          nivelLogro: null,
        });
        synced++;
      }

      if (alumno.nivel) {
        await this.upsertPromedio({
          studentId: alumno.studentId,
          curso: registry.curso,
          tipo: 'competencia',
          bimestre: registry.bimestre,
          anio,
          valorNumerico: null,
          nivelLogro: alumno.nivel as PromedioNivelLogro,
        });
        synced++;
      }
    }

    return synced;
  }

  private async filterStudents(query: PromediosQuery) {
    let filtered = (await this.studentsService.findAll()).filter(
      isStudentMatriculaActiva,
    );
    if (query.nivel) filtered = filtered.filter((s) => s.nivel === query.nivel);
    if (query.grado) filtered = filtered.filter((s) => s.grado === query.grado);
    if (query.seccion) {
      filtered = filtered.filter((s) =>
        matchesStudentSection(s, query.seccion!),
      );
    }
    filtered = dedupeStudentsByPerson(filtered);
    if (query.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        `${s.apellido} ${s.nombre} ${s.grado}`.toLowerCase().includes(q),
      );
    }
    return filtered.sort((a, b) =>
      `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`),
    );
  }

  private mergeCursoPromedios(
    numeric: CursoPromedio[],
    competency: CursoPromedio[],
  ): CursoPromedio[] {
    const byCurso = new Map<string, CursoPromedio>();

    for (const cp of competency) {
      byCurso.set(cp.curso, { ...cp });
    }

    for (const cp of numeric) {
      const existing = byCurso.get(cp.curso);
      if (!existing) {
        byCurso.set(cp.curso, { ...cp });
        continue;
      }
      byCurso.set(cp.curso, {
        ...existing,
        tipo: 'numerico',
        b1: cp.b1 ?? existing.b1,
        b2: cp.b2 ?? existing.b2,
        b3: cp.b3 ?? existing.b3,
        b4: cp.b4 ?? existing.b4,
        promedioAnual: cp.promedioAnual ?? existing.promedioAnual,
        nivel: cp.nivel ?? existing.nivel,
        b1Nivel: existing.b1Nivel,
        b2Nivel: existing.b2Nivel,
        b3Nivel: existing.b3Nivel,
        b4Nivel: existing.b4Nivel,
      });
    }

    return [...byCurso.values()].sort((a, b) =>
      a.curso.localeCompare(b.curso, 'es'),
    );
  }

  private cursoTienePromedioEnBd(c: CursoPromedio): boolean {
    return (
      c.promedioAnual !== null ||
      c.b1 !== null ||
      c.b2 !== null ||
      c.b3 !== null ||
      c.b4 !== null ||
      c.nivel !== null ||
      c.b1Nivel != null ||
      c.b2Nivel != null ||
      c.b3Nivel != null ||
      c.b4Nivel != null
    );
  }

  private buildCursoPromedios(
    rows: Promedio[],
    tipo: 'numerico' | 'competencia',
    bimestreActual: number,
    cursoFilter: string | undefined,
    cfg: GradingConfigDto,
  ): CursoPromedio[] {
    const byCurso = new Map<string, Promedio[]>();
    for (const row of rows) {
      if (cursoFilter && row.curso !== cursoFilter) continue;
      const list = byCurso.get(row.curso) ?? [];
      list.push(row);
      byCurso.set(row.curso, list);
    }

    const result: CursoPromedio[] = [];
    for (const [curso, items] of byCurso) {
      const b1 = items.find((i) => i.bimestre === 1);
      const b2 = items.find((i) => i.bimestre === 2);
      const b3 = items.find((i) => i.bimestre === 3);
      const b4 = items.find((i) => i.bimestre === 4);

      if (tipo === 'numerico') {
        const nums = [b1, b2, b3, b4]
          .slice(0, bimestreActual)
          .map((b) => b?.valorNumerico ?? null)
          .filter((v): v is number => v !== null);
        const promedioAnual = avgNumbers(nums);
        result.push({
          curso,
          tipo,
          b1: b1?.valorNumerico ?? null,
          b2: b2?.valorNumerico ?? null,
          b3: b3?.valorNumerico ?? null,
          b4: b4?.valorNumerico ?? null,
          promedioAnual,
          nivel:
            promedioAnual !== null
              ? this.gradingConfigService.nivelFromNota(promedioAnual)
              : null,
        });
      } else {
        const niveles = [b1, b2, b3, b4]
          .slice(0, bimestreActual)
          .map((b) => b?.nivelLogro ?? null)
          .filter(Boolean) as PromedioNivelLogro[];
        result.push({
          curso,
          tipo,
          b1: null,
          b2: null,
          b3: null,
          b4: null,
          b1Nivel: b1?.nivelLogro ?? null,
          b2Nivel: b2?.nivelLogro ?? null,
          b3Nivel: b3?.nivelLogro ?? null,
          b4Nivel: b4?.nivelLogro ?? null,
          promedioAnual: null,
          nivel: calcPromedioNivel(niveles),
        });
      }
    }

    return result.sort((a, b) => a.curso.localeCompare(b.curso));
  }

  private buildResumen(
    alumnos: AlumnoPromedio[],
    cfg: GradingConfigDto,
  ): PromediosResumen {
    const promediosGenerales = alumnos
      .map((a) => a.promedioGeneral)
      .filter((v): v is number => v !== null);

    const nivelesGlobales = alumnos
      .map((a) => a.nivelGeneral)
      .filter(Boolean) as PromedioNivelLogro[];

    return {
      totalAlumnos: alumnos.length,
      promedioAula: avgNumbers(promediosGenerales),
      promedioAulaNivel: calcPromedioNivel(nivelesGlobales),
      aprobados: alumnos.filter(
        (a) =>
          (a.promedioGeneral !== null && a.promedioGeneral >= cfg.notaMinima) ||
          (a.nivelGeneral !== null && a.nivelGeneral !== 'C'),
      ).length,
      desaprobados: alumnos.filter(
        (a) =>
          (a.promedioGeneral !== null && a.promedioGeneral < cfg.notaMinima) ||
          a.nivelGeneral === 'C',
      ).length,
      enRiesgo: alumnos.filter(
        (a) =>
          (a.promedioGeneral !== null && a.promedioGeneral < cfg.notaMinima) ||
          a.nivelGeneral === 'C',
      ).length,
      destacados: alumnos.filter(
        (a) =>
          (a.promedioGeneral !== null &&
            a.promedioGeneral >= cfg.escalaLogro.AD) ||
          a.nivelGeneral === 'AD',
      ).length,
    };
  }
}
