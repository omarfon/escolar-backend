import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StudentsService } from '../students/students.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateJustificationDto } from './dto/justification.dto';
import { UpdateAlertSettingsDto } from './dto/alert-settings.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AttendanceAlertSettings } from './entities/attendance-alert-settings.entity';
import { AttendanceJustification } from './entities/attendance-justification.entity';
import { Attendance } from './entities/attendance.entity';

export interface JustificationResponse {
  id: number;
  studentId: number;
  estudiante: string;
  nivel: string;
  grado: string;
  seccion: string;
  cantidad: number;
  motivo: string;
  observacion: string;
  fechas: string[];
  registradoPor: string;
  fechaRegistro: string;
}

export interface PendingJustificationResponse {
  studentId: number;
  estudiante: string;
  nivel: string;
  grado: string;
  seccion: string;
  faltasSinJustificar: number;
  faltasJustificadas: number;
  totalFaltas: number;
  ultimaFalta: string | null;
}

export interface AlertSettingsResponse {
  diasAlertaAusentismo: number;
  diasAlertaCritica: number;
}

export interface AbsenceAlertResponse {
  studentId: number;
  estudiante: string;
  nivel: string;
  grado: string;
  seccion: string;
  faltasInjustificadas: number;
  faltasJustificadas: number;
  diasConsecutivos: number;
  ultimaFalta: string | null;
  nivelAlerta: 'alerta' | 'critico';
  motivoAlerta: string;
}

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendancesRepository: Repository<Attendance>,
    @InjectRepository(AttendanceJustification)
    private readonly justificationRepository: Repository<AttendanceJustification>,
    @InjectRepository(AttendanceAlertSettings)
    private readonly alertSettingsRepository: Repository<AttendanceAlertSettings>,
    private readonly studentsService: StudentsService,
  ) {}

  create(createAttendanceDto: CreateAttendanceDto) {
    const entity = this.attendancesRepository.create(createAttendanceDto);
    return this.attendancesRepository.save(entity);
  }

  findAll(query?: {
    studentId?: number;
    estado?: string;
    mes?: string;
  }) {
    const qb = this.attendancesRepository
      .createQueryBuilder('a')
      .orderBy('a.fecha', 'DESC');

    if (query?.studentId) {
      qb.andWhere('a.studentId = :studentId', { studentId: query.studentId });
    }
    if (query?.estado) {
      qb.andWhere('a.estado = :estado', { estado: query.estado });
    }
    if (query?.mes) {
      qb.andWhere("TO_CHAR(a.fecha, 'YYYY-MM') = :mes", { mes: query.mes });
    }

    return qb.getMany();
  }

  findOne(id: number) {
    return this.getOrFail(id);
  }

  async update(id: number, updateAttendanceDto: UpdateAttendanceDto) {
    const current = await this.getOrFail(id);
    const merged = this.attendancesRepository.merge(
      current,
      updateAttendanceDto,
    );
    return this.attendancesRepository.save(merged);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.attendancesRepository.remove(current);
    return { deleted: true, id };
  }

  async findJustifications(query?: {
    nivel?: string;
    grado?: string;
    mes?: string;
    busqueda?: string;
  }): Promise<JustificationResponse[]> {
    const rows = await this.justificationRepository.find({
      order: { createdAt: 'DESC' },
    });

    const students = await this.studentsService.findAll();
    const studentMap = new Map(students.map((s) => [s.id, s]));

    let result = rows.map((row) => {
      const student = studentMap.get(row.studentId);
      return {
        id: row.id,
        studentId: row.studentId,
        estudiante: student
          ? `${student.apellido}, ${student.nombre}`
          : `Estudiante #${row.studentId}`,
        nivel: student?.nivel ?? '',
        grado: student?.grado ?? '',
        seccion: student?.seccion ?? '',
        cantidad: row.cantidad,
        motivo: row.motivo,
        observacion: row.observacion,
        fechas: row.fechas.map((f) => this.formatDate(f)),
        registradoPor: row.registradoPor,
        fechaRegistro: this.formatDateTime(row.createdAt),
      };
    });

    if (query?.nivel) {
      result = result.filter((r) => r.nivel === query.nivel);
    }
    if (query?.grado) {
      result = result.filter((r) => r.grado === query.grado);
    }
    if (query?.mes) {
      result = result.filter((r) =>
        rowMatchesMonth(r.fechas, query.mes!),
      );
    }
    if (query?.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.estudiante.toLowerCase().includes(q) ||
          r.motivo.toLowerCase().includes(q),
      );
    }

    return result;
  }

  async findPending(query?: {
    nivel?: string;
    grado?: string;
    mes?: string;
    busqueda?: string;
  }): Promise<PendingJustificationResponse[]> {
    const students = await this.studentsService.findAll();
    let filtered = students.filter((s) => s.activo);

    if (query?.nivel) filtered = filtered.filter((s) => s.nivel === query.nivel);
    if (query?.grado) filtered = filtered.filter((s) => s.grado === query.grado);
    if (query?.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        `${s.apellido} ${s.nombre} ${s.grado} ${s.nivel}`
          .toLowerCase()
          .includes(q),
      );
    }

    const result: PendingJustificationResponse[] = [];

    for (const student of filtered) {
      const attendances = await this.getStudentAttendances(student.id, query?.mes);
      const faltasSinJustificar = attendances.filter((a) => a.estado === 'F').length;
      const faltasJustificadas = attendances.filter((a) => a.estado === 'J').length;

      if (faltasSinJustificar === 0) continue;

      const ultimaFalta = attendances
        .filter((a) => a.estado === 'F')
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.fecha;

      result.push({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        nivel: student.nivel,
        grado: student.grado,
        seccion: student.seccion,
        faltasSinJustificar,
        faltasJustificadas,
        totalFaltas: faltasSinJustificar + faltasJustificadas,
        ultimaFalta: ultimaFalta ? this.formatDate(ultimaFalta) : null,
      });
    }

    return result.sort((a, b) => b.faltasSinJustificar - a.faltasSinJustificar);
  }

  async getAlertSettings(): Promise<AlertSettingsResponse> {
    const settings = await this.ensureAlertSettings();
    return {
      diasAlertaAusentismo: settings.diasAlertaAusentismo,
      diasAlertaCritica: settings.diasAlertaCritica,
    };
  }

  async updateAlertSettings(
    dto: UpdateAlertSettingsDto,
  ): Promise<AlertSettingsResponse> {
    const settings = await this.ensureAlertSettings();

    if (dto.diasAlertaAusentismo !== undefined) {
      settings.diasAlertaAusentismo = dto.diasAlertaAusentismo;
    }
    if (dto.diasAlertaCritica !== undefined) {
      settings.diasAlertaCritica = dto.diasAlertaCritica;
    }

    if (settings.diasAlertaCritica <= settings.diasAlertaAusentismo) {
      throw new BadRequestException(
        'Los dias de alerta critica deben ser mayores que los de alerta temprana',
      );
    }

    const saved = await this.alertSettingsRepository.save(settings);
    return {
      diasAlertaAusentismo: saved.diasAlertaAusentismo,
      diasAlertaCritica: saved.diasAlertaCritica,
    };
  }

  async findAlerts(query?: {
    nivel?: string;
    grado?: string;
    mes?: string;
    busqueda?: string;
    soloCriticos?: boolean;
  }): Promise<{ settings: AlertSettingsResponse; alerts: AbsenceAlertResponse[] }> {
    const settings = await this.getAlertSettings();
    const students = await this.studentsService.findAll();
    let filtered = students.filter((s) => s.activo);

    if (query?.nivel) filtered = filtered.filter((s) => s.nivel === query.nivel);
    if (query?.grado) filtered = filtered.filter((s) => s.grado === query.grado);
    if (query?.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        `${s.apellido} ${s.nombre} ${s.grado} ${s.nivel}`
          .toLowerCase()
          .includes(q),
      );
    }

    const alerts: AbsenceAlertResponse[] = [];

    for (const student of filtered) {
      const attendances = await this.getStudentAttendances(student.id, query?.mes);
      const faltasInjustificadas = attendances.filter((a) => a.estado === 'F').length;
      const faltasJustificadas = attendances.filter((a) => a.estado === 'J').length;

      const fechasFaltas = attendances
        .filter((a) => a.estado === 'F')
        .map((a) => a.fecha)
        .sort();
      const diasConsecutivos = calcMaxConsecutiveDays(fechasFaltas);

      const superaAlerta =
        faltasInjustificadas > settings.diasAlertaAusentismo ||
        diasConsecutivos > settings.diasAlertaAusentismo;
      if (!superaAlerta) continue;

      const esCritico =
        faltasInjustificadas > settings.diasAlertaCritica ||
        diasConsecutivos > settings.diasAlertaCritica;
      const nivelAlerta = esCritico ? 'critico' : 'alerta';

      if (query?.soloCriticos && nivelAlerta !== 'critico') continue;

      const ultimaFalta = fechasFaltas.length
        ? this.formatDate(fechasFaltas[fechasFaltas.length - 1])
        : null;

      const motivos: string[] = [];
      if (faltasInjustificadas > settings.diasAlertaAusentismo) {
        motivos.push(`${faltasInjustificadas} faltas injustificadas`);
      }
      if (diasConsecutivos > settings.diasAlertaAusentismo) {
        motivos.push(`${diasConsecutivos} dias consecutivos`);
      }

      alerts.push({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        nivel: student.nivel,
        grado: student.grado,
        seccion: student.seccion,
        faltasInjustificadas,
        faltasJustificadas,
        diasConsecutivos,
        ultimaFalta,
        nivelAlerta,
        motivoAlerta: motivos.join(' · '),
      });
    }

    alerts.sort((a, b) => {
      if (a.nivelAlerta !== b.nivelAlerta) {
        return a.nivelAlerta === 'critico' ? -1 : 1;
      }
      return b.faltasInjustificadas - a.faltasInjustificadas;
    });

    return { settings, alerts };
  }

  async createJustification(
    dto: CreateJustificationDto,
  ): Promise<JustificationResponse> {
    const students = await this.studentsService.findAll();
    const student = students.find((s) => s.id === dto.studentId);
    if (!student) {
      throw new NotFoundException(`Estudiante ${dto.studentId} no encontrado`);
    }

    const absences = await this.attendancesRepository.find({
      where: { studentId: dto.studentId, estado: 'F' },
      order: { fecha: 'DESC' },
      take: dto.cantidad,
    });

    if (absences.length < dto.cantidad) {
      throw new BadRequestException(
        `Solo hay ${absences.length} falta(s) sin justificar para este estudiante`,
      );
    }

    const attendanceIds = absences.map((a) => a.id);
    const fechas = absences.map((a) => a.fecha);
    const observacionTexto = dto.observacion?.trim() ?? '';
    const observacionAttendance = observacionTexto
      ? `${dto.motivo} — ${observacionTexto}`
      : dto.motivo;

    for (const att of absences) {
      att.estado = 'J';
      att.observacion = observacionAttendance;
      await this.attendancesRepository.save(att);
    }

    const saved = await this.justificationRepository.save(
      this.justificationRepository.create({
        studentId: dto.studentId,
        cantidad: dto.cantidad,
        motivo: dto.motivo.trim(),
        observacion: observacionTexto,
        attendanceIds,
        fechas,
        registradoPor: dto.registradoPor?.trim() || 'Administración',
      }),
    );

    return {
      id: saved.id,
      studentId: saved.studentId,
      estudiante: `${student.apellido}, ${student.nombre}`,
      nivel: student.nivel,
      grado: student.grado,
      seccion: student.seccion,
      cantidad: saved.cantidad,
      motivo: saved.motivo,
      observacion: saved.observacion,
      fechas: saved.fechas.map((f) => this.formatDate(f)),
      registradoPor: saved.registradoPor,
      fechaRegistro: this.formatDateTime(saved.createdAt),
    };
  }

  async removeJustification(id: number) {
    const current = await this.justificationRepository.findOneBy({ id });
    if (!current) {
      throw new NotFoundException(`Justificación ${id} no encontrada`);
    }

    if (current.attendanceIds?.length) {
      const records = await this.attendancesRepository.find({
        where: { id: In(current.attendanceIds) },
      });
      for (const att of records) {
        att.estado = 'F';
        att.observacion = 'Inasistencia sin justificar';
        await this.attendancesRepository.save(att);
      }
    }

    await this.justificationRepository.remove(current);
    return { deleted: true, id };
  }

  private async ensureAlertSettings(): Promise<AttendanceAlertSettings> {
    let settings = await this.alertSettingsRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!settings) {
      settings = await this.alertSettingsRepository.save(
        this.alertSettingsRepository.create({
          diasAlertaAusentismo: 2,
          diasAlertaCritica: 5,
        }),
      );
    }
    return settings;
  }

  private async getStudentAttendances(studentId: number, mes?: string) {
    const qb = this.attendancesRepository
      .createQueryBuilder('a')
      .where('a.studentId = :studentId', { studentId });

    if (mes) {
      qb.andWhere("TO_CHAR(a.fecha, 'YYYY-MM') = :mes", { mes });
    }

    return qb.getMany();
  }

  private async getOrFail(id: number): Promise<Attendance> {
    const attendance = await this.attendancesRepository.findOneBy({ id });
    if (!attendance) throw new NotFoundException(`Attendance ${id} no encontrado`);
    return attendance;
  }

  private formatDate(value: string | Date): string {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }

  private formatDateTime(value: Date): string {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

function rowMatchesMonth(fechas: string[], mes: string): boolean {
  return fechas.some((f) => {
    const parts = f.split('/');
    if (parts.length !== 3) return false;
    const iso = `${parts[2]}-${parts[1]}`;
    return iso === mes;
  });
}

function calcMaxConsecutiveDays(dates: string[]): number {
  if (!dates.length) return 0;

  const unique = [...new Set(dates)].sort();
  let max = 1;
  let current = 1;

  for (let i = 1; i < unique.length; i++) {
    const prev = parseIsoDate(unique[i - 1]);
    const curr = parseIsoDate(unique[i]);
    const diffDays = Math.round((curr - prev) / 86_400_000);

    if (diffDays === 1) {
      current++;
      max = Math.max(max, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }

  return max;
}

function parseIsoDate(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
