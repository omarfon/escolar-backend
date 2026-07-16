import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendancesService } from '../attendances/attendances.service';
import { Grade } from '../grades/entities/grade.entity';
import { StudentsService } from '../students/students.service';
import { TasksService } from '../tasks/tasks.service';
import { ParentStudent } from './entities/parent-student.entity';

export interface HijoResumen {
  studentId: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  nivel: string;
  grado: string;
  seccion: string;
  aulaLabel: string;
  parentesco: string;
}

export interface CursoSeguimiento {
  curso: string;
  promedio: number | null;
  nivel: string | null;
  b1: number | null;
  b2: number | null;
  b3: number | null;
  b4: number | null;
  ultimasNotas: {
    id: number;
    descripcion: string;
    nota: number;
    fecha: string;
    bimestre: number;
    tipo: string;
  }[];
}

export interface AsistenciaSeguimiento {
  asistenciaPct: number;
  totalDias: number;
  presentes: number;
  faltas: number;
  tardanzas: number;
  justificadas: number;
  inasistenciasNetas: number;
  reciente: {
    id: number;
    fecha: string;
    estado: string;
    observacion?: string;
  }[];
}

export interface TareaSeguimiento {
  id: number;
  titulo: string;
  curso: string;
  fechaEntrega: string;
  estado: string;
  prioridad: string;
}

export interface SeguimientoAcademico {
  estudiante: HijoResumen;
  promedioGeneral: number | null;
  nivelGeneral: string | null;
  asistencia: AsistenciaSeguimiento;
  tareasPendientes: number;
  tareasVencidas: number;
  tareasEntregadas: number;
  cursos: CursoSeguimiento[];
  tareas: TareaSeguimiento[];
}

@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(ParentStudent)
    private readonly parentStudentsRepo: Repository<ParentStudent>,
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    private readonly studentsService: StudentsService,
    private readonly attendancesService: AttendancesService,
    private readonly tasksService: TasksService,
  ) {}

  async getChildren(parentEmail: string): Promise<HijoResumen[]> {
    const links = await this.parentStudentsRepo.find({
      where: { parentEmail: parentEmail.toLowerCase() },
    });

    const children: HijoResumen[] = [];
    for (const link of links) {
      const student = await this.studentsService.findOne(link.studentId);
      children.push(this.toHijoResumen(student, link.parentesco));
    }

    return children.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }

  async getAcademicTracking(
    studentId: number,
    parentEmail?: string,
  ): Promise<SeguimientoAcademico> {
    if (parentEmail) {
      const allowed = await this.parentStudentsRepo.findOne({
        where: { parentEmail: parentEmail.toLowerCase(), studentId },
      });
      if (!allowed) {
        throw new NotFoundException('El estudiante no está vinculado a este apoderado');
      }
    }

    const student = await this.studentsService.findOne(studentId);
    const link = parentEmail
      ? await this.parentStudentsRepo.findOne({
          where: { parentEmail: parentEmail.toLowerCase(), studentId },
        })
      : null;

    const grades = await this.gradesRepo.find({
      where: { studentId },
      order: { fechaEvaluacion: 'DESC' },
    });

    const attendances = await this.attendancesService.findAll({ studentId });
    const tasks = await this.tasksService.findAll(studentId);

    const cursos = this.buildCursosSeguimiento(grades);
    const promediosCursos = cursos
      .map(c => c.promedio)
      .filter((v): v is number => v !== null);
    const promedioGeneral = promediosCursos.length
      ? round2(promediosCursos.reduce((s, v) => s + v, 0) / promediosCursos.length)
      : null;

    const presentes = attendances.filter(a => a.estado === 'P').length;
    const faltas = attendances.filter(a => a.estado === 'F').length;
    const tardanzas = attendances.filter(a => a.estado === 'T').length;
    const justificadas = attendances.filter(a => a.estado === 'J').length;
    const totalDias = attendances.length;
    const inasistenciasNetas = Math.max(faltas - justificadas, 0);

    return {
      estudiante: this.toHijoResumen(student, link?.parentesco ?? 'apoderado'),
      promedioGeneral,
      nivelGeneral: promedioGeneral !== null ? nivelFromNota(promedioGeneral) : null,
      asistencia: {
        asistenciaPct: totalDias ? Math.round((presentes / totalDias) * 100) : 0,
        totalDias,
        presentes,
        faltas,
        tardanzas,
        justificadas,
        inasistenciasNetas,
        reciente: attendances
          .slice()
          .sort((a, b) => b.fecha.localeCompare(a.fecha))
          .slice(0, 8)
          .map(a => ({
            id: a.id,
            fecha: a.fecha,
            estado: a.estado,
            observacion: a.observacion,
          })),
      },
      tareasPendientes: tasks.filter(t => t.estado === 'PENDING').length,
      tareasVencidas: tasks.filter(t => t.estado === 'OVERDUE').length,
      tareasEntregadas: tasks.filter(t => t.estado === 'SUBMITTED').length,
      cursos,
      tareas: tasks.map(t => ({
        id: t.id,
        titulo: t.titulo,
        curso: t.curso,
        fechaEntrega: t.fechaEntrega,
        estado: t.estado,
        prioridad: t.prioridad,
      })),
    };
  }

  private buildCursosSeguimiento(grades: Grade[]): CursoSeguimiento[] {
    const byCurso = new Map<string, Grade[]>();
    for (const grade of grades) {
      const list = byCurso.get(grade.curso) ?? [];
      list.push(grade);
      byCurso.set(grade.curso, list);
    }

    return [...byCurso.entries()].map(([curso, items]) => {
      const b1 = avgBimestre(items, 1);
      const b2 = avgBimestre(items, 2);
      const b3 = avgBimestre(items, 3);
      const b4 = avgBimestre(items, 4);
      const bimAvgs = [b1, b2, b3, b4].filter((v): v is number => v !== null);
      const promedio = bimAvgs.length
        ? round2(bimAvgs.reduce((s, v) => s + v, 0) / bimAvgs.length)
        : null;

      return {
        curso,
        promedio,
        nivel: promedio !== null ? nivelFromNota(promedio) : null,
        b1,
        b2,
        b3,
        b4,
        ultimasNotas: items
          .slice()
          .sort((a, b) => b.fechaEvaluacion.localeCompare(a.fechaEvaluacion))
          .slice(0, 5)
          .map(g => ({
            id: g.id,
            descripcion: g.descripcion ?? g.tipo,
            nota: g.nota,
            fecha: g.fechaEvaluacion,
            bimestre: g.bimestre,
            tipo: g.tipo,
          })),
      };
    });
  }

  private toHijoResumen(
    student: {
      id: number;
      nombre: string;
      apellido: string;
      nivel: string;
      grado: string;
      seccion: string;
    },
    parentesco: string,
  ): HijoResumen {
    return {
      studentId: student.id,
      nombre: student.nombre,
      apellido: student.apellido,
      nombreCompleto: `${student.nombre} ${student.apellido}`,
      nivel: student.nivel,
      grado: student.grado,
      seccion: student.seccion,
      aulaLabel: `${student.nivel} · ${student.grado} ${student.seccion}`,
      parentesco,
    };
  }
}

function avgBimestre(items: Grade[], bimestre: number): number | null {
  const filtered = items.filter(g => g.bimestre === bimestre);
  if (!filtered.length) return null;
  return round2(filtered.reduce((s, g) => s + Number(g.nota), 0) / filtered.length);
}

function round2(value: number): number {
  return Math.round(value * 10) / 10;
}

function nivelFromNota(nota: number): string {
  if (nota >= 17.5) return 'AD';
  if (nota >= 14) return 'A';
  if (nota >= 11) return 'B';
  return 'C';
}
