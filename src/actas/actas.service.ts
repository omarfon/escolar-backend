import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from '../grades/entities/grade.entity';
import { StudentsService } from '../students/students.service';
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
}

@Injectable()
export class ActasService {
  constructor(
    @InjectRepository(EvaluationActa)
    private readonly actaRepo: Repository<EvaluationActa>,
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    private readonly studentsService: StudentsService,
  ) {}

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
    return this.toDetail(acta);
  }

  async generate(dto: GenerateActaDto): Promise<ActaDetail> {
    const anio = dto.anio?.trim() || '2026';

    const existing = await this.actaRepo.findOne({
      where: {
        nivel: dto.nivel,
        grado: dto.grado,
        seccion: dto.seccion,
        bimestre: dto.bimestre,
        anio,
      },
    });

    if (existing && existing.estado !== 'borrador') {
      throw new BadRequestException(
        'Ya existe un acta generada para esta seccion y bimestre',
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
        'No hay alumnos con notas para generar el acta',
      );
    }

    if (existing) {
      existing.estado = 'generada';
      existing.docente = dto.docente?.trim() || 'Docente titular';
      existing.observaciones = dto.observaciones?.trim() || '';
      existing.snapshot = snapshot;
      existing.approvedAt = null;
      existing.closedAt = null;
      existing.aprobadoPor = '';
      const saved = await this.actaRepo.save(existing);
      return this.toDetail(saved);
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

    return this.toDetail(saved);
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
    return this.toDetail(saved);
  }

  async close(id: number): Promise<ActaDetail> {
    const acta = await this.getOrFail(id);
    if (acta.estado !== 'aprobada') {
      throw new BadRequestException('Solo se pueden cerrar actas aprobadas');
    }
    acta.estado = 'cerrada';
    acta.closedAt = new Date();
    const saved = await this.actaRepo.save(acta);
    return this.toDetail(saved);
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
    const students = (await this.studentsService.findAll()).filter(
      (s) =>
        s.activo &&
        s.nivel === nivel &&
        s.grado === grado &&
        s.seccion === seccion,
    );

    const allGrades = await this.gradesRepo.find({ where: { bimestre } });
    const cursosSet = new Set<string>();
    const alumnos: ActaAlumnoRow[] = [];

    for (const student of students) {
      const studentGrades = allGrades.filter((g) => g.studentId === student.id);
      const byCurso = new Map<string, Grade[]>();

      for (const g of studentGrades) {
        cursosSet.add(g.curso);
        const list = byCurso.get(g.curso) ?? [];
        list.push(g);
        byCurso.set(g.curso, list);
      }

      const notas: Record<string, number | null> = {};
      const courseAvgs: number[] = [];

      for (const [curso, items] of byCurso) {
        const avg = avgNumbers(items.map((i) => i.nota));
        notas[curso] = avg;
        if (avg !== null) courseAvgs.push(avg);
      }

      const promedio = avgNumbers(courseAvgs);
      const nivelLogro = promedio !== null ? nivelFromNota(promedio) : null;
      let situacion: ActaAlumnoRow['situacion'] = 'sin_notas';
      if (promedio !== null) {
        situacion = promedio >= 11 ? 'aprobado' : 'desaprobado';
      }

      if (Object.keys(notas).length === 0) continue;

      alumnos.push({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        notas,
        promedio,
        nivel: nivelLogro,
        situacion,
      });
    }

    alumnos.sort((a, b) => a.estudiante.localeCompare(b.estudiante));
    const cursos = [...cursosSet].sort();

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
      totalAlumnos: snap?.resumen.total ?? 0,
      aprobados: snap?.resumen.aprobados ?? 0,
      desaprobados: snap?.resumen.desaprobados ?? 0,
      promedioAula: snap?.resumen.promedioAula ?? null,
      fechaGeneracion: this.formatDateTime(acta.createdAt),
      fechaAprobacion: acta.approvedAt
        ? this.formatDateTime(acta.approvedAt)
        : null,
    };
  }

  private toDetail(acta: EvaluationActa): ActaDetail {
    const base = this.toListItem(acta);
    const snap = acta.snapshot ?? {
      cursos: [],
      alumnos: [],
      resumen: { total: 0, aprobados: 0, desaprobados: 0, promedioAula: null },
    };
    return {
      ...base,
      observaciones: acta.observaciones,
      snapshot: snap,
      cursos: snap.cursos,
      alumnos: snap.alumnos,
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

function nivelFromNota(nota: number): string {
  if (nota >= 17.5) return 'AD';
  if (nota >= 14) return 'A';
  if (nota >= 11) return 'B';
  return 'C';
}
