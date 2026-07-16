import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentsService } from '../students/students.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Grade } from './entities/grade.entity';

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
}

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradesRepository: Repository<Grade>,
    private readonly studentsService: StudentsService,
  ) {}

  create(createGradeDto: CreateGradeDto) {
    const entity = this.gradesRepository.create(createGradeDto);
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

  async computeAverages(query?: {
    nivel?: string;
    grado?: string;
    seccion?: string;
    curso?: string;
    busqueda?: string;
  }): Promise<PromediosResponse> {
    const students = await this.studentsService.findAll();
    let filtered = students.filter((s) => s.activo);

    if (query?.nivel) filtered = filtered.filter((s) => s.nivel === query.nivel);
    if (query?.grado) filtered = filtered.filter((s) => s.grado === query.grado);
    if (query?.seccion) filtered = filtered.filter((s) => s.seccion === query.seccion);
    if (query?.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        `${s.apellido} ${s.nombre} ${s.grado}`.toLowerCase().includes(q),
      );
    }

    const allGrades = await this.gradesRepository.find();
    const cursosSet = new Set<string>();
    const alumnos: AlumnoPromedio[] = [];

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

      const cursos: CursoPromedio[] = cursosToProcess.map((curso) => {
        const items = byCurso.get(curso) ?? [];
        const b1 = avgBimestre(items, 1);
        const b2 = avgBimestre(items, 2);
        const b3 = avgBimestre(items, 3);
        const b4 = avgBimestre(items, 4);
        const bimAvgs = [b1, b2, b3, b4].filter((v): v is number => v !== null);
        const promedioAnual = avgNumbers(bimAvgs);
        return {
          curso,
          b1,
          b2,
          b3,
          b4,
          promedioAnual,
          nivel: promedioAnual !== null ? nivelFromNota(promedioAnual) : null,
        };
      });

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
        seccion: student.seccion,
        cursos,
        promedioGeneral,
        nivelGeneral:
          promedioGeneral !== null ? nivelFromNota(promedioGeneral) : null,
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

    return { resumen, alumnos, cursosDisponibles };
  }

  private async getOrFail(id: number): Promise<Grade> {
    const grade = await this.gradesRepository.findOneBy({ id });
    if (!grade) throw new NotFoundException(`Grade ${id} no encontrado`);
    return grade;
  }
}

function avgBimestre(grades: Grade[], bimestre: number): number | null {
  const items = grades.filter((g) => g.bimestre === bimestre);
  return avgNumbers(items.map((g) => g.nota));
}

function avgNumbers(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function nivelFromNota(nota: number): string {
  if (nota >= 17.5) return 'AD';
  if (nota >= 14) return 'A';
  if (nota >= 11) return 'B';
  return 'C';
}
