import {
  BadRequestException,
  Injectable,
  Logger,
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
import { AttendanceAlertNotification } from './entities/attendance-alert-notification.entity';
import { AttendanceJustification } from './entities/attendance-justification.entity';
import { Attendance } from './entities/attendance.entity';
import {
  FeriadosMaestrosService,
  formatIsoDate,
  isWeekday,
  parseIsoDate as parseCalendarDate,
} from '../maestros/feriados/feriados.service';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { SaveDailyRegisterDto } from './dto/daily-register.dto';
import { NotifyApoderadoDto } from './dto/notify-apoderado.dto';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';
import { gradoLabelFromParts } from '../students/students.mapper';
import { Student } from '../students/entities/student.entity';
import {
  JustificacionAdjuntoMeta,
  saveJustificationFiles,
} from './justifications-upload.util';
import { existsSync, unlinkSync } from 'fs';
import { join, sep } from 'path';
import { MailService } from '../mail/mail.service';

export interface DailyRegisterRowResponse {
  studentId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  attendanceId: number | null;
  estado: 'P' | 'F' | 'T' | 'J' | null;
  observacion: string | null;
}

export interface DailyRegisterNavigation {
  hoy: string;
  anterior: string | null;
  siguiente: string | null;
  esHoy: boolean;
  esFinDeSemana: boolean;
  esDiaClase: boolean;
  fueraDePeriodo: boolean;
  periodoActual: {
    id: number;
    nombre: string;
    inicio: string;
    fin: string;
  } | null;
}

export interface DailyRegisterResponse {
  fecha: string;
  nivel: string;
  grado: string;
  seccion: string;
  gradoLabel: string;
  feriado: { nombre: string; tipo: string } | null;
  totalAlumnos: number;
  registros: DailyRegisterRowResponse[];
  navegacion: DailyRegisterNavigation;
}

export interface DailyRegisterCalendarDay {
  fecha: string;
  dia: number;
  esMesActual: boolean;
  esHoy: boolean;
  esSeleccionado: boolean;
  esFinDeSemana: boolean;
  esDiaClase: boolean;
  fueraDePeriodo: boolean;
  feriado: { nombre: string; tipo: string } | null;
  registrado: boolean;
  registrosCount: number;
  totalAlumnos: number;
}

export interface DailyRegisterCalendarResponse {
  mes: string;
  mesLabel: string;
  fechaHoy: string;
  fechaSeleccionada: string;
  periodoActual: {
    id: number;
    nombre: string;
    inicio: string;
    fin: string;
  } | null;
  totalAlumnos: number;
  mesAnterior: string;
  mesSiguiente: string;
  dias: DailyRegisterCalendarDay[];
}

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
  attendanceIds: number[];
  adjuntos: JustificacionAdjuntoMeta[];
  registradoPor: string;
  fechaRegistro: string;
}

export interface FaltaPendienteDetalle {
  id: number;
  fecha: string;
  fechaLabel: string;
  observacion?: string;
  /** Días restantes para justificar (0 = último día de plazo). */
  diasRestantes: number;
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
  /** Faltas injustificadas cuyo plazo de 5 días ya venció. */
  faltasFueraDePlazo: number;
  faltasPendientes: FaltaPendienteDetalle[];
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
  nivelAlerta: 'normal' | 'alerta' | 'critico';
  motivoAlerta: string;
  /** Total de registros de asistencia en el periodo consultado (tabla attendances). */
  totalRegistrosBd: number;
  /** Fechas ISO (YYYY-MM-DD) de faltas injustificadas registradas en BD. */
  fechasInasistencia: string[];
  apoderadoNotificado: boolean;
  notificadoAt: string | null;
  notificadoPor: string | null;
}

export interface ParentAbsenceAlertResponse {
  id: number;
  mes: string;
  mesLabel: string;
  faltasInjustificadas: number;
  diasConsecutivos: number;
  nivelAlerta: string;
  motivoAlerta: string;
  notificadoAt: string;
  notificadoPor: string;
  correoEnviado: boolean;
  leidoEnPortal: boolean;
}

export interface NotifyApoderadoResult {
  studentId: number;
  mes: string;
  apoderadoNotificado: boolean;
  notificadoAt: string;
  notificadoPor: string;
  correoEnviado: boolean;
  correoDestino: string | null;
  correoSimulado: boolean;
  previewUrl?: string;
}

export interface AbsenceAlertsResumen {
  totalAlumnos: number;
  alumnosConFaltasInjustificadas: number;
  totalFaltasInjustificadas: number;
  totalRegistrosAsistencia: number;
  alumnosEnAlerta: number;
  alumnosEnCritico: number;
}

export interface ControlReportDiaEscolar {
  fecha: string;
  label: string;
  diaSemana: string;
  esHoy: boolean;
  esFuturo: boolean;
}

export interface ControlReportAlumno {
  studentId: number;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  dni: string;
  nivel: string;
  grado: string;
  seccion: string;
  gradoLabel: string;
  faltas: number;
  faltasInjustificadas: number;
  tardanzas: number;
  justificadas: number;
  presentes: number;
  totalRegistrado: number;
  totalDiasClase: number;
  asistenciaPct: number;
  ultimaFalta: string | null;
  nivelAlerta: 'normal' | 'alerta' | 'critico';
  calendario: Record<string, 'P' | 'F' | 'T' | 'J' | null>;
}

export interface ControlReportResponse {
  mes: string;
  mesLabel: string;
  fechaHoy: string;
  nivel: string | null;
  grado: string | null;
  seccion: string | null;
  diasEscolares: ControlReportDiaEscolar[];
  alumnos: ControlReportAlumno[];
  resumenPorDia: Record<string, { F: number; T: number; J: number }>;
  kpis: {
    totalAlumnos: number;
    conFaltas: number;
    totalFaltas: number;
    totalTardanzas: number;
    alerta: number;
    critico: number;
  };
  alertSettings: AlertSettingsResponse;
}

@Injectable()
export class AttendancesService {
  /** Plazo máximo (días calendario) para justificar una falta después de ocurrida. */
  static readonly DIAS_PLAZO_JUSTIFICACION = 5;
  private readonly logger = new Logger(AttendancesService.name);

  constructor(
    @InjectRepository(Attendance)
    private readonly attendancesRepository: Repository<Attendance>,
    @InjectRepository(AttendanceJustification)
    private readonly justificationRepository: Repository<AttendanceJustification>,
    @InjectRepository(AttendanceAlertSettings)
    private readonly alertSettingsRepository: Repository<AttendanceAlertSettings>,
    @InjectRepository(AttendanceAlertNotification)
    private readonly alertNotificationRepository: Repository<AttendanceAlertNotification>,
    private readonly studentsService: StudentsService,
    private readonly feriadosService: FeriadosMaestrosService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly mailService: MailService,
  ) {}

  async getDailyRegister(query: {
    nivel: string;
    grado: string;
    seccion: string;
    fecha: string;
  }): Promise<DailyRegisterResponse> {
    const { nivel, grado, seccion } = query;
    if (!nivel?.trim() || !grado?.trim() || !seccion?.trim()) {
      throw new BadRequestException('Nivel, grado y sección son obligatorios');
    }

    const fecha = query.fecha?.slice(0, 10);
    if (!fecha) {
      throw new BadRequestException('La fecha es obligatoria');
    }

    const hoy = this.todayIso();
    const anio = parseCalendarDate(fecha).getUTCFullYear();
    const periodo = await this.getPeriodoActual(anio);
    const feriado = await this.feriadosService.getFeriadoEnFecha(fecha, anio);
    const seccionNorm = seccion.trim().toUpperCase();
    const students = await this.findStudentsBySection(nivel, grado, seccionNorm);

    const studentIds = students.map((s) => s.id);
    const attendances =
      studentIds.length === 0
        ? []
        : await this.attendancesRepository
            .createQueryBuilder('a')
            .where('a.fecha = :fecha', { fecha })
            .andWhere('a.studentId IN (:...studentIds)', { studentIds })
            .getMany();

    const attMap = new Map(attendances.map((a) => [a.studentId, a]));

    return {
      fecha,
      nivel: nivel.trim(),
      grado: grado.trim(),
      seccion: seccionNorm,
      gradoLabel: gradoLabelFromParts(
        nivel.trim(),
        normalizeGradoMatricula(grado),
      ),
      feriado: feriado ? { nombre: feriado.nombre, tipo: feriado.tipo } : null,
      totalAlumnos: students.length,
      registros: students.map((s) => {
        const att = attMap.get(s.id);
        return {
          studentId: s.id,
          nombres: s.nombre,
          apellidos: s.apellido,
          dni: s.dni,
          attendanceId: att?.id ?? null,
          estado: att?.estado ?? null,
          observacion: att?.observacion ?? null,
        };
      }),
      navegacion: this.buildNavigation(fecha, hoy, feriado, periodo),
    };
  }

  async getDailyRegisterCalendar(query: {
    nivel: string;
    grado: string;
    seccion: string;
    mes: string;
    fecha?: string;
  }): Promise<DailyRegisterCalendarResponse> {
    const { nivel, grado, seccion } = query;
    if (!nivel?.trim() || !grado?.trim() || !seccion?.trim()) {
      throw new BadRequestException('Nivel, grado y sección son obligatorios');
    }

    const mes = query.mes?.slice(0, 7);
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      throw new BadRequestException('El mes debe tener formato YYYY-MM');
    }

    const [yearStr, monthStr] = mes.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (month < 1 || month > 12) {
      throw new BadRequestException('Mes inválido');
    }

    const hoy = this.todayIso();
    const fechaSeleccionada = query.fecha?.slice(0, 10) ?? hoy;
    const seccionNorm = seccion.trim().toUpperCase();
    const students = await this.findStudentsBySection(nivel, grado, seccionNorm);
    const studentIds = students.map((s) => s.id);
    const periodo = await this.getPeriodoActual(year);
    const grid = this.buildMonthGrid(year, month);
    const desde = grid[0].fecha;
    const hasta = grid[grid.length - 1].fecha;

    const feriados = await this.feriadosService.findAll({
      anioEscolar: year,
      activo: true,
      desde,
      hasta,
    });
    const feriadoMap = new Map(
      feriados.map((f) => [f.fecha, { nombre: f.nombre, tipo: f.tipo }]),
    );

    const countMap = new Map<string, number>();
    if (studentIds.length > 0) {
      const rows = await this.attendancesRepository
        .createQueryBuilder('a')
        .select("TO_CHAR(a.fecha, 'YYYY-MM-DD')", 'fecha')
        .addSelect('COUNT(*)', 'count')
        .where('a.studentId IN (:...studentIds)', { studentIds })
        .andWhere('a.fecha >= :desde', { desde })
        .andWhere('a.fecha <= :hasta', { hasta })
        .groupBy("TO_CHAR(a.fecha, 'YYYY-MM-DD')")
        .getRawMany<{ fecha: string; count: string }>();

      for (const row of rows) {
        countMap.set(this.normalizeFechaKey(row.fecha), Number(row.count));
      }
    }

    const totalAlumnos = students.length;
    const dias: DailyRegisterCalendarDay[] = grid.map((cell) => {
      const feriado = feriadoMap.get(cell.fecha) ?? null;
      const esFinDeSemana = !isWeekday(parseCalendarDate(cell.fecha));
      const fueraDePeriodo = !this.isWithinPeriodo(cell.fecha, periodo);
      const esDiaClase =
        cell.esMesActual &&
        !esFinDeSemana &&
        !feriado &&
        !fueraDePeriodo;
      const registrosCount = countMap.get(cell.fecha) ?? 0;

      return {
        fecha: cell.fecha,
        dia: cell.dia,
        esMesActual: cell.esMesActual,
        esHoy: cell.fecha === hoy,
        esSeleccionado: cell.fecha === fechaSeleccionada,
        esFinDeSemana,
        esDiaClase,
        fueraDePeriodo,
        feriado,
        registrado: totalAlumnos > 0 && registrosCount >= totalAlumnos,
        registrosCount,
        totalAlumnos,
      };
    });

    const mesDate = parseCalendarDate(`${mes}-01`);
    const prev = new Date(mesDate);
    prev.setUTCMonth(prev.getUTCMonth() - 1);
    const next = new Date(mesDate);
    next.setUTCMonth(next.getUTCMonth() + 1);

    return {
      mes,
      mesLabel: this.formatMonthLabel(year, month),
      fechaHoy: hoy,
      fechaSeleccionada,
      periodoActual: periodo
        ? {
            id: periodo.id,
            nombre: periodo.nombre,
            inicio: periodo.inicio,
            fin: periodo.fin,
          }
        : null,
      totalAlumnos,
      mesAnterior: `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`,
      mesSiguiente: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`,
      dias,
    };
  }

  async saveDailyRegister(dto: SaveDailyRegisterDto) {
    const fecha = dto.fecha.slice(0, 10);
    const anio = parseCalendarDate(fecha).getUTCFullYear();
    const periodo = await this.getPeriodoActual(anio);

    if (!isWeekday(parseCalendarDate(fecha))) {
      throw new BadRequestException(
        'No se puede registrar asistencia en fin de semana',
      );
    }

    if (!this.isWithinPeriodo(fecha, periodo)) {
      throw new BadRequestException(
        periodo
          ? `La fecha ${fecha} está fuera del periodo académico actual (${periodo.nombre}: ${periodo.inicio} — ${periodo.fin})`
          : `La fecha ${fecha} está fuera del calendario escolar`,
      );
    }

    const feriado = await this.feriadosService.getFeriadoEnFecha(fecha, anio);
    if (feriado) {
      throw new BadRequestException(
        `No se puede registrar asistencia: ${fecha} es feriado (${feriado.nombre})`,
      );
    }

    const seccionNorm = dto.seccion.trim().toUpperCase();
    const students = await this.findStudentsBySection(
      dto.nivel,
      dto.grado,
      seccionNorm,
    );
    const allowedIds = new Set(students.map((s) => s.id));

    for (const entry of dto.registros) {
      if (!allowedIds.has(entry.studentId)) {
        throw new BadRequestException(
          `El estudiante ${entry.studentId} no pertenece a la sección indicada`,
        );
      }
    }

    const saved: Attendance[] = [];
    for (const entry of dto.registros) {
      const existing = await this.attendancesRepository.findOne({
        where: { studentId: entry.studentId, fecha },
      });

      if (existing) {
        existing.estado = entry.estado;
        existing.observacion = entry.observacion?.trim() || undefined;
        saved.push(await this.attendancesRepository.save(existing));
      } else {
        saved.push(
          await this.attendancesRepository.save(
            this.attendancesRepository.create({
              studentId: entry.studentId,
              fecha,
              estado: entry.estado,
              observacion: entry.observacion?.trim() || undefined,
            }),
          ),
        );
      }
    }

    return {
      fecha,
      nivel: dto.nivel.trim(),
      grado: dto.grado.trim(),
      seccion: seccionNorm,
      guardados: saved.length,
    };
  }

  async create(createAttendanceDto: CreateAttendanceDto) {
    const fecha = createAttendanceDto.fecha?.slice(0, 10) ?? createAttendanceDto.fecha;
    const feriado = await this.feriadosService.getFeriadoEnFecha(fecha);
    if (feriado) {
      throw new BadRequestException(
        `No se puede registrar asistencia: ${fecha} es feriado (${feriado.nombre})`,
      );
    }

    const entity = this.attendancesRepository.create(createAttendanceDto);
    return this.attendancesRepository.save(entity);
  }

  findAll(query?: {
    studentId?: number;
    estado?: string;
    mes?: string;
    anioEscolar?: number;
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
    if (query?.anioEscolar) {
      qb.andWhere('a.fecha >= :desde', { desde: `${query.anioEscolar}-01-01` });
      qb.andWhere('a.fecha <= :hasta', { hasta: `${query.anioEscolar}-12-31` });
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
    studentId?: number;
  }): Promise<JustificationResponse[]> {
    let rows = await this.justificationRepository.find({
      order: { createdAt: 'DESC' },
    });

    if (query?.studentId) {
      rows = rows.filter((r) => r.studentId === query.studentId);
    }
    if (query?.mes?.trim()) {
      const mesKey = query.mes.slice(0, 7);
      rows = rows.filter((r) =>
        r.fechas.some((f) => this.normalizeFechaKey(f).startsWith(mesKey)),
      );
    }

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
        attendanceIds: row.attendanceIds ?? [],
        adjuntos: row.adjuntos ?? [],
        registradoPor: row.registradoPor,
        fechaRegistro: this.formatDateTime(row.createdAt),
      };
    });

    if (query?.nivel) {
      result = result.filter((r) => r.nivel === query.nivel);
    }
    if (query?.grado) {
      const gradoNorm = normalizeGradoMatricula(query.grado);
      result = result.filter(
        (r) => normalizeGradoMatricula(r.grado) === gradoNorm,
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
    studentId?: number;
  }): Promise<PendingJustificationResponse[]> {
    let students = await this.filterStudentsForControl(query);
    if (query?.studentId) {
      students = students.filter((s) => s.id === query.studentId);
    }

    const studentIds = students.map((s) => s.id);
    const mesBounds = query?.mes?.trim()
      ? this.resolveMesBounds(query.mes)
      : null;
    const byStudent = await this.loadAttendancesByStudents(
      studentIds,
      mesBounds?.desde,
      mesBounds?.hasta,
    );

    const result: PendingJustificationResponse[] = [];

    for (const student of students) {
      const records = byStudent.get(student.id) ?? [];
      const stats = this.computeAbsenceStats(records);
      const faltasPendientes = this.mapPendingAbsenceDetails(records);
      const faltasFueraDePlazo = records.filter(
        (a) =>
          a.estado === 'F' &&
          !this.isWithinJustificationDeadline(this.normalizeFechaKey(a.fecha)),
      ).length;

      if (faltasPendientes.length === 0) continue;

      result.push({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        nivel: student.nivel,
        grado: student.grado,
        seccion: student.seccion,
        faltasSinJustificar: faltasPendientes.length,
        faltasJustificadas: stats.faltasJustificadas,
        totalFaltas: stats.faltasInjustificadas + stats.faltasJustificadas,
        ultimaFalta:
          faltasPendientes[faltasPendientes.length - 1]?.fechaLabel ??
          stats.ultimaFalta,
        faltasFueraDePlazo,
        faltasPendientes,
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
  }): Promise<{
    settings: AlertSettingsResponse;
    alerts: AbsenceAlertResponse[];
    conFaltas: AbsenceAlertResponse[];
    resumen: AbsenceAlertsResumen;
    mes: string | null;
    mesLabel: string | null;
  }> {
    const settings = await this.getAlertSettings();
    const hoy = this.todayIso();
    const mesKey = query?.mes?.trim()
      ? query.mes.slice(0, 7)
      : hoy.slice(0, 7);
    const mesBounds = this.resolveMesBounds(mesKey);

    const students = await this.filterStudentsForControl(query);
    const studentIds = students.map((s) => s.id);
    const byStudent = await this.loadAttendancesByStudents(
      studentIds,
      mesBounds.desde,
      mesBounds.hasta,
    );
    const notificationMap = await this.loadAlertNotificationMap(studentIds, mesKey);

    const conFaltas: AbsenceAlertResponse[] = [];
    let totalFaltasInjustificadas = 0;
    let totalRegistrosAsistencia = 0;

    for (const student of students) {
      const stats = this.computeAbsenceStats(byStudent.get(student.id) ?? []);
      totalRegistrosAsistencia += stats.totalRegistrosBd;
      if (stats.faltasInjustificadas === 0) continue;

      totalFaltasInjustificadas += stats.faltasInjustificadas;
      const nivelAlerta = this.resolveAbsenceAlertLevel(
        stats.faltasInjustificadas,
        stats.diasConsecutivos,
        settings,
      );

      conFaltas.push(
        this.buildAbsenceAlertRow(student, stats, settings, notificationMap),
      );
    }

    conFaltas.sort((a, b) => {
      const rank = (n: AbsenceAlertResponse['nivelAlerta']) =>
        n === 'critico' ? 0 : n === 'alerta' ? 1 : 2;
      const diff = rank(a.nivelAlerta) - rank(b.nivelAlerta);
      if (diff !== 0) return diff;
      return b.faltasInjustificadas - a.faltasInjustificadas;
    });

    let alerts = conFaltas.filter((a) => a.nivelAlerta !== 'normal');
    if (query?.soloCriticos) {
      alerts = alerts.filter((a) => a.nivelAlerta === 'critico');
    }

    const resumen: AbsenceAlertsResumen = {
      totalAlumnos: students.length,
      alumnosConFaltasInjustificadas: conFaltas.length,
      totalFaltasInjustificadas,
      totalRegistrosAsistencia,
      alumnosEnAlerta: conFaltas.filter((a) => a.nivelAlerta === 'alerta').length,
      alumnosEnCritico: conFaltas.filter((a) => a.nivelAlerta === 'critico').length,
    };

    return {
      settings,
      alerts,
      conFaltas,
      resumen,
      mes: mesKey,
      mesLabel: this.formatMonthLabel(mesBounds.year, mesBounds.month),
    };
  }

  async notifyApoderado(dto: NotifyApoderadoDto): Promise<NotifyApoderadoResult> {
    const mesKey = dto.mes.slice(0, 7);
    const students = await this.studentsService.findAll();
    const student = students.find((s) => s.id === dto.studentId);
    if (!student) {
      throw new NotFoundException(`Estudiante ${dto.studentId} no encontrado`);
    }

    const mesBounds = this.resolveMesBounds(mesKey);
    const mesLabel = this.formatMonthLabel(mesBounds.year, mesBounds.month);
    const records = await this.loadAttendancesByStudents(
      [dto.studentId],
      mesBounds.desde,
      mesBounds.hasta,
    );
    const stats = this.computeAbsenceStats(records.get(dto.studentId) ?? []);
    if (stats.faltasInjustificadas === 0) {
      throw new BadRequestException(
        'No hay faltas injustificadas en BD para notificar en este mes',
      );
    }

    const settings = await this.getAlertSettings();
    const nivelAlerta = this.resolveAbsenceAlertLevel(
      stats.faltasInjustificadas,
      stats.diasConsecutivos,
      settings,
    );
    const motivoAlerta = this.buildMotivoAlerta(stats, settings, nivelAlerta);
    const notificadoPor = dto.notificadoPor?.trim() || 'Administración';
    const parentEmail = this.mailService.resolveParentEmail(student);

    let row = await this.alertNotificationRepository.findOne({
      where: { studentId: dto.studentId, mes: mesKey },
    });

    const payload = {
      studentId: dto.studentId,
      mes: mesKey,
      notificadoPor,
      mesLabel,
      faltasInjustificadas: stats.faltasInjustificadas,
      diasConsecutivos: stats.diasConsecutivos,
      nivelAlerta,
      motivoAlerta,
      correoDestino: parentEmail ?? '',
      leidoEnPortal: false,
    };

    if (row) {
      Object.assign(row, payload);
      row = await this.alertNotificationRepository.save(row);
    } else {
      row = await this.alertNotificationRepository.save(
        this.alertNotificationRepository.create(payload),
      );
    }

    let correoEnviado = false;
    let correoSimulado = false;
    let previewUrl: string | undefined;

    if (parentEmail) {
      try {
        const mailResult = await this.mailService.sendAbsenceAlertParentNotification({
          student,
          mesLabel,
          faltasInjustificadas: stats.faltasInjustificadas,
          diasConsecutivos: stats.diasConsecutivos,
          nivelAlerta,
          motivoAlerta,
          fechasFaltas: stats.fechasFaltas.map((f) => this.formatFechaDisplay(f)),
          notificadoPor,
        });
        if (mailResult) {
          correoEnviado = mailResult.sent;
          correoSimulado = mailResult.simulated;
          previewUrl = mailResult.previewUrl;
          row.correoEnviado = mailResult.sent;
          row = await this.alertNotificationRepository.save(row);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        this.logger.error(
          `No se pudo enviar correo de ausentismo (alumno ${dto.studentId}): ${message}`,
        );
      }
    }

    return {
      studentId: dto.studentId,
      mes: mesKey,
      apoderadoNotificado: true,
      notificadoAt: this.formatDateTime(row.notificadoAt),
      notificadoPor: row.notificadoPor,
      correoEnviado,
      correoDestino: parentEmail,
      correoSimulado,
      previewUrl,
    };
  }

  async findParentAbsenceAlerts(
    studentId: number,
  ): Promise<ParentAbsenceAlertResponse[]> {
    const rows = await this.alertNotificationRepository.find({
      where: { studentId },
      order: { notificadoAt: 'DESC' },
    });
    return rows.map((row) => this.toParentAbsenceAlertResponse(row));
  }

  async markParentAbsenceAlertRead(
    studentId: number,
    alertId: number,
  ): Promise<ParentAbsenceAlertResponse> {
    const row = await this.alertNotificationRepository.findOne({
      where: { id: alertId, studentId },
    });
    if (!row) {
      throw new NotFoundException('Alerta de ausentismo no encontrada');
    }
    if (!row.leidoEnPortal) {
      row.leidoEnPortal = true;
      await this.alertNotificationRepository.save(row);
    }
    return this.toParentAbsenceAlertResponse(row);
  }

  private toParentAbsenceAlertResponse(
    row: AttendanceAlertNotification,
  ): ParentAbsenceAlertResponse {
    return {
      id: row.id,
      mes: row.mes,
      mesLabel: row.mesLabel || row.mes,
      faltasInjustificadas: row.faltasInjustificadas,
      diasConsecutivos: row.diasConsecutivos,
      nivelAlerta: row.nivelAlerta,
      motivoAlerta: row.motivoAlerta,
      notificadoAt: this.formatDateTime(row.notificadoAt),
      notificadoPor: row.notificadoPor,
      correoEnviado: row.correoEnviado,
      leidoEnPortal: row.leidoEnPortal,
    };
  }

  private formatFechaDisplay(iso: string): string {
    if (!iso?.includes('-')) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private buildAbsenceAlertRow(
    student: Student,
    stats: {
      faltasInjustificadas: number;
      faltasJustificadas: number;
      fechasFaltas: string[];
      diasConsecutivos: number;
      ultimaFalta: string | null;
      totalRegistrosBd: number;
    },
    settings: AlertSettingsResponse,
    notificationMap: Map<number, AttendanceAlertNotification>,
  ): AbsenceAlertResponse {
    const nivelAlerta = this.resolveAbsenceAlertLevel(
      stats.faltasInjustificadas,
      stats.diasConsecutivos,
      settings,
    );
    const notification = notificationMap.get(student.id);

    return {
      studentId: student.id,
      estudiante: `${student.apellido}, ${student.nombre}`,
      nivel: student.nivel,
      grado: student.grado,
      seccion: student.seccion,
      faltasInjustificadas: stats.faltasInjustificadas,
      faltasJustificadas: stats.faltasJustificadas,
      diasConsecutivos: stats.diasConsecutivos,
      ultimaFalta: stats.ultimaFalta,
      nivelAlerta,
      motivoAlerta: this.buildMotivoAlerta(stats, settings, nivelAlerta),
      totalRegistrosBd: stats.totalRegistrosBd,
      fechasInasistencia: stats.fechasFaltas,
      apoderadoNotificado: !!notification,
      notificadoAt: notification
        ? this.formatDateTime(notification.notificadoAt)
        : null,
      notificadoPor: notification?.notificadoPor ?? null,
    };
  }

  private async loadAlertNotificationMap(
    studentIds: number[],
    mes: string,
  ): Promise<Map<number, AttendanceAlertNotification>> {
    const map = new Map<number, AttendanceAlertNotification>();
    if (!studentIds.length) return map;

    const rows = await this.alertNotificationRepository
      .createQueryBuilder('n')
      .where('n.studentId IN (:...studentIds)', { studentIds })
      .andWhere('n.mes = :mes', { mes })
      .getMany();

    for (const row of rows) {
      map.set(row.studentId, row);
    }
    return map;
  }

  async createJustification(
    dto: CreateJustificationDto,
    files: Express.Multer.File[] = [],
  ): Promise<JustificationResponse> {
    const students = await this.studentsService.findAll();
    const student = students.find((s) => s.id === dto.studentId);
    if (!student) {
      throw new NotFoundException(`Estudiante ${dto.studentId} no encontrado`);
    }

    const absences = await this.resolveJustifiableAbsences(dto);

    const attendanceIds = absences.map((a) => a.id);
    const fechas = absences.map((a) => this.normalizeFechaKey(a.fecha));
    const cantidad = absences.length;
    const observacionTexto = dto.observacion?.trim() ?? '';
    const observacionAttendance = observacionTexto
      ? `${dto.motivo} — ${observacionTexto}`
      : dto.motivo;

    for (const att of absences) {
      att.estado = 'J';
      att.observacion = observacionAttendance;
      await this.attendancesRepository.save(att);
    }

    let saved = await this.justificationRepository.save(
      this.justificationRepository.create({
        studentId: dto.studentId,
        cantidad,
        motivo: dto.motivo.trim(),
        observacion: observacionTexto,
        attendanceIds,
        fechas,
        adjuntos: [],
        registradoPor: dto.registradoPor?.trim() || 'Administración',
      }),
    );

    const adjuntos = saveJustificationFiles(files, dto.studentId, saved.id);
    if (adjuntos.length) {
      saved.adjuntos = adjuntos;
      saved = await this.justificationRepository.save(saved);
    }

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
      attendanceIds: saved.attendanceIds,
      adjuntos: saved.adjuntos ?? [],
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

    this.deleteJustificationFiles(current.adjuntos ?? []);

    await this.justificationRepository.remove(current);
    return { deleted: true, id };
  }

  async getControlReport(query?: {
    mes?: string;
    nivel?: string;
    grado?: string;
    seccion?: string;
    busqueda?: string;
  }): Promise<ControlReportResponse> {
    const hoy = this.todayIso();
    const mes = query?.mes?.slice(0, 7) ?? hoy.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      throw new BadRequestException('El mes debe tener formato YYYY-MM');
    }

    const [yearStr, monthStr] = mes.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const alertSettings = await this.getAlertSettings();
    const periodo = await this.getPeriodoActual(year);

    const students = await this.filterStudentsForControl(query);
    const studentIds = students.map((s) => s.id);

    const grid = this.buildMonthGrid(year, month);
    const diasMes = grid.filter((c) => c.esMesActual);
    const desde = diasMes[0]?.fecha ?? `${mes}-01`;
    const hasta = diasMes[diasMes.length - 1]?.fecha ?? `${mes}-28`;

    const feriados = await this.feriadosService.findAll({
      anioEscolar: year,
      activo: true,
      desde,
      hasta,
    });
    const feriadoMap = new Map(
      feriados.map((f) => [f.fecha, { nombre: f.nombre, tipo: f.tipo }]),
    );

    const diasEscolares: ControlReportDiaEscolar[] = [];
    for (const cell of diasMes) {
      const esFinDeSemana = !isWeekday(parseCalendarDate(cell.fecha));
      const fueraDePeriodo = !this.isWithinPeriodo(cell.fecha, periodo);
      const feriado = feriadoMap.get(cell.fecha);
      const esDiaClase =
        !esFinDeSemana && !feriado && !fueraDePeriodo;
      if (!esDiaClase) continue;

      const date = parseCalendarDate(cell.fecha);
      diasEscolares.push({
        fecha: cell.fecha,
        label: `${cell.dia} ${this.shortMonthLabel(month)}`,
        diaSemana: this.weekdayShort(date.getTime()),
        esHoy: cell.fecha === hoy,
        esFuturo: cell.fecha > hoy,
      });
    }

    const attendances =
      studentIds.length === 0
        ? []
        : await this.attendancesRepository
            .createQueryBuilder('a')
            .where('a.studentId IN (:...studentIds)', { studentIds })
            .andWhere('a.fecha >= :desde', { desde })
            .andWhere('a.fecha <= :hasta', { hasta })
            .orderBy('a.fecha', 'ASC')
            .getMany();

    const byStudent = new Map<number, Attendance[]>();
    for (const att of attendances) {
      const list = byStudent.get(att.studentId) ?? [];
      list.push(att);
      byStudent.set(att.studentId, list);
    }

    const resumenPorDia: Record<string, { F: number; T: number; J: number }> =
      {};
    for (const dia of diasEscolares) {
      resumenPorDia[dia.fecha] = { F: 0, T: 0, J: 0 };
    }

    for (const att of attendances) {
      if (!resumenPorDia[att.fecha]) continue;
      if (att.estado === 'F') resumenPorDia[att.fecha].F++;
      if (att.estado === 'T') resumenPorDia[att.fecha].T++;
      if (att.estado === 'J') resumenPorDia[att.fecha].J++;
    }

    const diasClaseHastaHoy = diasEscolares.filter((d) => !d.esFuturo).length;

    const alumnos: ControlReportAlumno[] = students.map((student) => {
      const records = byStudent.get(student.id) ?? [];
      const calendario: Record<string, 'P' | 'F' | 'T' | 'J' | null> = {};
      for (const dia of diasEscolares) {
        calendario[dia.fecha] = null;
      }
      for (const rec of records) {
        calendario[rec.fecha] = rec.estado;
      }

      const presentes = records.filter((r) => r.estado === 'P').length;
      const tardanzas = records.filter((r) => r.estado === 'T').length;
      const justificadas = records.filter((r) => r.estado === 'J').length;
      const faltasInjustificadas = records.filter((r) => r.estado === 'F').length;
      const faltas = faltasInjustificadas + justificadas;
      const totalRegistrado = records.length;
      const asistenciaPct =
        totalRegistrado > 0
          ? Math.round(((presentes + tardanzas) / totalRegistrado) * 100)
          : 0;

      const ultimaFaltaRec = records
        .filter((r) => r.estado === 'F')
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

      const nivelAlerta = this.resolveControlAlertLevel(
        faltasInjustificadas,
        alertSettings,
      );

      return {
        studentId: student.id,
        nombres: student.nombre,
        apellidos: student.apellido,
        nombreCompleto: `${student.apellido}, ${student.nombre}`,
        dni: student.dni ?? '',
        nivel: student.nivel,
        grado: student.grado,
        seccion: student.seccion,
        gradoLabel: `${student.grado} ${student.seccion}`.trim(),
        faltas,
        faltasInjustificadas,
        tardanzas,
        justificadas,
        presentes,
        totalRegistrado,
        totalDiasClase: diasClaseHastaHoy,
        asistenciaPct,
        ultimaFalta: ultimaFaltaRec
          ? this.formatDate(ultimaFaltaRec.fecha)
          : null,
        nivelAlerta,
        calendario,
      };
    });

    return {
      mes,
      mesLabel: this.formatMonthLabel(year, month),
      fechaHoy: hoy,
      nivel: query?.nivel?.trim() || null,
      grado: query?.grado?.trim() || null,
      seccion: query?.seccion?.trim()?.toUpperCase() || null,
      diasEscolares,
      alumnos,
      resumenPorDia,
      kpis: {
        totalAlumnos: alumnos.length,
        conFaltas: alumnos.filter((a) => a.faltas > 0).length,
        totalFaltas: alumnos.reduce((s, a) => s + a.faltas, 0),
        totalTardanzas: alumnos.reduce((s, a) => s + a.tardanzas, 0),
        alerta: alumnos.filter((a) => a.nivelAlerta === 'alerta').length,
        critico: alumnos.filter((a) => a.nivelAlerta === 'critico').length,
      },
      alertSettings,
    };
  }

  buildControlReportCsv(report: ControlReportResponse): string {
    const sep = ';';
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? '');
      return s.includes(sep) || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const dayHeaders = report.diasEscolares.map(
      (d) => `${d.diaSemana} ${d.label}`,
    );
    const header = [
      'Alumno',
      'DNI',
      'Nivel',
      'Grado',
      'Sección',
      'Faltas',
      'Faltas injustificadas',
      'Tardanzas',
      'Justificadas',
      'Presentes',
      '% Asistencia',
      'Estado',
      'Última falta',
      ...dayHeaders,
    ];

    const rows = report.alumnos.map((a) => {
      const dayCols = report.diasEscolares.map((d) => {
        const st = a.calendario[d.fecha];
        return st ?? '';
      });
      return [
        a.nombreCompleto,
        a.dni,
        a.nivel,
        a.grado,
        a.seccion,
        a.faltas,
        a.faltasInjustificadas,
        a.tardanzas,
        a.justificadas,
        a.presentes,
        `${a.asistenciaPct}%`,
        a.nivelAlerta,
        a.ultimaFalta ?? '',
        ...dayCols,
      ]
        .map(esc)
        .join(sep);
    });

    return [header.map(esc).join(sep), ...rows].join('\r\n');
  }

  private async filterStudentsForControl(query?: {
    nivel?: string;
    grado?: string;
    seccion?: string;
    busqueda?: string;
  }): Promise<Student[]> {
    let students = await this.studentsService.findAll();
    students = students.filter(
      (s) => s.activo && s.estadoMatricula === 'activo',
    );

    if (query?.nivel?.trim()) {
      students = students.filter((s) => s.nivel === query.nivel!.trim());
    }
    if (query?.grado?.trim()) {
      const gradoNorm = normalizeGradoMatricula(query.grado);
      students = students.filter(
        (s) => normalizeGradoMatricula(s.grado) === gradoNorm,
      );
    }
    if (query?.seccion?.trim()) {
      const sec = query.seccion.trim().toUpperCase();
      students = students.filter((s) => s.seccion.toUpperCase() === sec);
    }
    if (query?.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      students = students.filter((s) =>
        `${s.apellido} ${s.nombre} ${s.dni} ${s.grado} ${s.nivel} ${s.seccion}`
          .toLowerCase()
          .includes(q),
      );
    }

    return students.sort((a, b) =>
      `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'),
    );
  }

  private resolveControlAlertLevel(
    faltasInjustificadas: number,
    settings: AlertSettingsResponse,
  ): 'normal' | 'alerta' | 'critico' {
    if (faltasInjustificadas > settings.diasAlertaCritica) return 'critico';
    if (faltasInjustificadas > settings.diasAlertaAusentismo) return 'alerta';
    return 'normal';
  }

  private resolveAbsenceAlertLevel(
    faltasInjustificadas: number,
    diasConsecutivos: number,
    settings: AlertSettingsResponse,
  ): 'normal' | 'alerta' | 'critico' {
    const superaCritico =
      faltasInjustificadas > settings.diasAlertaCritica ||
      diasConsecutivos > settings.diasAlertaCritica;
    if (superaCritico) return 'critico';

    const superaAlerta =
      faltasInjustificadas > settings.diasAlertaAusentismo ||
      diasConsecutivos > settings.diasAlertaAusentismo;
    if (superaAlerta) return 'alerta';

    return 'normal';
  }

  private buildMotivoAlerta(
    stats: {
      faltasInjustificadas: number;
      diasConsecutivos: number;
    },
    settings: AlertSettingsResponse,
    nivelAlerta: 'normal' | 'alerta' | 'critico',
  ): string {
    if (nivelAlerta === 'normal') {
      return `${stats.faltasInjustificadas} falta(s) injustificada(s) registrada(s) en BD`;
    }

    const motivos: string[] = [];
    if (stats.faltasInjustificadas > settings.diasAlertaAusentismo) {
      motivos.push(`${stats.faltasInjustificadas} faltas injustificadas`);
    }
    if (stats.diasConsecutivos > settings.diasAlertaAusentismo) {
      motivos.push(`${stats.diasConsecutivos} dias consecutivos`);
    }
    return motivos.join(' · ');
  }

  private weekdayShort(dateMs: number): string {
    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return labels[new Date(dateMs).getUTCDay()];
  }

  private shortMonthLabel(month: number): string {
    const labels = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];
    return labels[month - 1] ?? '';
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

  private resolveMesBounds(mes: string): {
    year: number;
    month: number;
    desde: string;
    hasta: string;
  } {
    const mesKey = mes.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mesKey)) {
      throw new BadRequestException('El mes debe tener formato YYYY-MM');
    }

    const [yearStr, monthStr] = mesKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const grid = this.buildMonthGrid(year, month);
    const diasMes = grid.filter((c) => c.esMesActual);

    return {
      year,
      month,
      desde: diasMes[0]?.fecha ?? `${mesKey}-01`,
      hasta: diasMes[diasMes.length - 1]?.fecha ?? `${mesKey}-28`,
    };
  }

  private async loadAttendancesByStudents(
    studentIds: number[],
    desde?: string,
    hasta?: string,
  ): Promise<Map<number, Attendance[]>> {
    const byStudent = new Map<number, Attendance[]>();
    if (!studentIds.length) return byStudent;

    const qb = this.attendancesRepository
      .createQueryBuilder('a')
      .where('a.studentId IN (:...studentIds)', { studentIds })
      .orderBy('a.fecha', 'ASC');

    if (desde) qb.andWhere('a.fecha >= :desde', { desde });
    if (hasta) qb.andWhere('a.fecha <= :hasta', { hasta });

    const attendances = await qb.getMany();
    for (const att of attendances) {
      const list = byStudent.get(att.studentId) ?? [];
      list.push(att);
      byStudent.set(att.studentId, list);
    }

    return byStudent;
  }

  private deleteJustificationFiles(adjuntos: JustificacionAdjuntoMeta[]): void {
    for (const adj of adjuntos) {
      const rel = adj.url.replace(/^\/uploads\/?/, '').replace(/\//g, sep);
      const abs = join(process.cwd(), 'uploads', rel);
      if (existsSync(abs)) {
        try {
          unlinkSync(abs);
        } catch {
          // ignorar si ya no existe
        }
      }
    }
  }

  private mapPendingAbsenceDetails(records: Attendance[]): FaltaPendienteDetalle[] {
    const hoy = this.todayIso();
    return records
      .filter(
        (a) =>
          a.estado === 'F' &&
          this.isWithinJustificationDeadline(this.normalizeFechaKey(a.fecha), hoy),
      )
      .map((a) => {
        const fecha = this.normalizeFechaKey(a.fecha);
        const diasTranscurridos = this.daysSinceDate(fecha, hoy);
        return {
          id: a.id,
          fecha,
          fechaLabel: this.formatDate(fecha),
          observacion: a.observacion ?? undefined,
          diasRestantes: Math.max(
            0,
            AttendancesService.DIAS_PLAZO_JUSTIFICACION - diasTranscurridos,
          ),
        };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  private isWithinJustificationDeadline(
    fechaIso: string,
    refIso: string = this.todayIso(),
  ): boolean {
    return (
      this.daysSinceDate(fechaIso, refIso) <=
      AttendancesService.DIAS_PLAZO_JUSTIFICACION
    );
  }

  private oldestJustifiableDateIso(refIso: string = this.todayIso()): string {
    return this.shiftDate(refIso, -AttendancesService.DIAS_PLAZO_JUSTIFICACION);
  }

  private assertJustificationDeadline(absences: Attendance[]): void {
    const hoy = this.todayIso();
    const vencidas = absences.filter(
      (a) =>
        !this.isWithinJustificationDeadline(this.normalizeFechaKey(a.fecha), hoy),
    );
    if (!vencidas.length) return;

    const fechas = vencidas
      .map((a) => this.formatDate(this.normalizeFechaKey(a.fecha)))
      .join(', ');
    throw new BadRequestException(
      `Solo se puede justificar una falta hasta ${AttendancesService.DIAS_PLAZO_JUSTIFICACION} días después de ocurrida. Plazo vencido para: ${fechas}`,
    );
  }

  private daysSinceDate(fechaIso: string, refIso: string): number {
    const inicio = parseCalendarDate(fechaIso);
    const fin = parseCalendarDate(refIso);
    const msPorDia = 24 * 60 * 60 * 1000;
    return Math.floor((fin.getTime() - inicio.getTime()) / msPorDia);
  }

  private async resolveJustifiableAbsences(
    dto: CreateJustificationDto,
  ): Promise<Attendance[]> {
    if (dto.attendanceIds?.length) {
      const absences = await this.attendancesRepository.find({
        where: {
          id: In(dto.attendanceIds),
          studentId: dto.studentId,
          estado: 'F',
        },
        order: { fecha: 'ASC' },
      });

      if (absences.length !== dto.attendanceIds.length) {
        throw new BadRequestException(
          'Una o más faltas seleccionadas no existen en BD o ya fueron justificadas',
        );
      }

      if (dto.mes?.trim()) {
        this.assertAbsencesWithinMes(absences, dto.mes);
      }

      this.assertJustificationDeadline(absences);

      if (dto.cantidad !== absences.length) {
        throw new BadRequestException(
          'La cantidad debe coincidir con las faltas seleccionadas de BD',
        );
      }

      return absences;
    }

    const fechaMin = this.oldestJustifiableDateIso();
    const qb = this.attendancesRepository
      .createQueryBuilder('a')
      .where('a.studentId = :studentId', { studentId: dto.studentId })
      .andWhere("a.estado = 'F'")
      .andWhere('a.fecha >= :fechaMin', { fechaMin });

    if (dto.mes?.trim()) {
      const bounds = this.resolveMesBounds(dto.mes);
      qb.andWhere('a.fecha >= :desde', { desde: bounds.desde }).andWhere(
        'a.fecha <= :hasta',
        { hasta: bounds.hasta },
      );
    }

    const absences = await qb
      .orderBy('a.fecha', 'DESC')
      .take(dto.cantidad)
      .getMany();

    if (absences.length < dto.cantidad) {
      const scope = dto.mes?.trim()
        ? ` en ${dto.mes.slice(0, 7)}`
        : '';
      throw new BadRequestException(
        `Solo hay ${absences.length} falta(s) sin justificar dentro del plazo de ${AttendancesService.DIAS_PLAZO_JUSTIFICACION} días${scope} para este estudiante`,
      );
    }

    this.assertJustificationDeadline(absences);

    return absences.reverse();
  }

  private assertAbsencesWithinMes(absences: Attendance[], mes: string): void {
    const bounds = this.resolveMesBounds(mes);
    const invalid = absences.filter((att) => {
      const fecha = this.normalizeFechaKey(att.fecha);
      return fecha < bounds.desde || fecha > bounds.hasta;
    });
    if (invalid.length) {
      throw new BadRequestException(
        'Las faltas seleccionadas deben pertenecer al mes indicado',
      );
    }
  }

  private computeAbsenceStats(records: Attendance[]) {
    const faltasInjustificadas = records.filter((a) => a.estado === 'F').length;
    const faltasJustificadas = records.filter((a) => a.estado === 'J').length;
    const fechasFaltas = records
      .filter((a) => a.estado === 'F')
      .map((a) => this.normalizeFechaKey(a.fecha))
      .sort();

    return {
      faltasInjustificadas,
      faltasJustificadas,
      fechasFaltas,
      diasConsecutivos: calcMaxConsecutiveDays(fechasFaltas),
      ultimaFalta: fechasFaltas.length
        ? this.formatDate(fechasFaltas[fechasFaltas.length - 1])
        : null,
      totalRegistrosBd: records.length,
    };
  }

  private todayIso(): string {
    return formatIsoDate(new Date());
  }

  private normalizeFechaKey(value: string | Date): string {
    if (value instanceof Date) {
      return formatIsoDate(value);
    }
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return formatIsoDate(parsed);
    }
    return raw.slice(0, 10);
  }

  private shiftDate(fecha: string, days: number): string {
    const date = parseCalendarDate(fecha);
    date.setUTCDate(date.getUTCDate() + days);
    return formatIsoDate(date);
  }

  private async getPeriodoActual(anio: number) {
    const periodos = await this.periodosService.findAll({
      anioEscolar: anio,
      activo: true,
    });
    return periodos.find((p) => p.actual) ?? null;
  }

  private isWithinPeriodo(
    fecha: string,
    periodo: { inicio: string; fin: string } | null,
  ): boolean {
    if (!periodo) return true;
    return fecha >= periodo.inicio && fecha <= periodo.fin;
  }

  private buildNavigation(
    fecha: string,
    hoy: string,
    feriado: { nombre: string } | null,
    periodo: { id: number; nombre: string; inicio: string; fin: string } | null,
  ): DailyRegisterNavigation {
    const esFinDeSemana = !isWeekday(parseCalendarDate(fecha));
    const fueraDePeriodo = !this.isWithinPeriodo(fecha, periodo);
    const esDiaClase = !esFinDeSemana && !feriado && !fueraDePeriodo;

    return {
      hoy,
      anterior: this.shiftDate(fecha, -1),
      siguiente: this.shiftDate(fecha, 1),
      esHoy: fecha === hoy,
      esFinDeSemana,
      esDiaClase,
      fueraDePeriodo,
      periodoActual: periodo
        ? {
            id: periodo.id,
            nombre: periodo.nombre,
            inicio: periodo.inicio,
            fin: periodo.fin,
          }
        : null,
    };
  }

  private buildMonthGrid(
    year: number,
    month: number,
  ): Array<{ fecha: string; dia: number; esMesActual: boolean }> {
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const leading = (firstDay.getUTCDay() + 6) % 7;
    const cells: Array<{ fecha: string; dia: number; esMesActual: boolean }> =
      [];

    for (let i = leading; i > 0; i--) {
      const date = new Date(firstDay);
      date.setUTCDate(date.getUTCDate() - i);
      cells.push({
        fecha: formatIsoDate(date),
        dia: date.getUTCDate(),
        esMesActual: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        fecha: formatIsoDate(new Date(Date.UTC(year, month - 1, day))),
        dia: day,
        esMesActual: true,
      });
    }

    while (cells.length % 7 !== 0) {
      const last = parseCalendarDate(cells[cells.length - 1].fecha);
      last.setUTCDate(last.getUTCDate() + 1);
      cells.push({
        fecha: formatIsoDate(last),
        dia: last.getUTCDate(),
        esMesActual: false,
      });
    }

    return cells;
  }

  private formatMonthLabel(year: number, month: number): string {
    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.toLocaleDateString('es-PE', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  private async findStudentsBySection(
    nivel: string,
    grado: string,
    seccion: string,
  ): Promise<Student[]> {
    const students = await this.studentsService.findAll();
    const nivelNorm = nivel.trim();
    const gradoNorm = normalizeGradoMatricula(grado);
    const seccionNorm = seccion.trim().toUpperCase();

    return students
      .filter(
        (s) =>
          s.activo &&
          s.estadoMatricula === 'activo' &&
          s.nivel === nivelNorm &&
          normalizeGradoMatricula(s.grado) === gradoNorm &&
          s.seccion.toUpperCase() === seccionNorm,
      )
      .sort((a, b) =>
        `${a.apellido} ${a.nombre}`.localeCompare(
          `${b.apellido} ${b.nombre}`,
          'es',
        ),
      );
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
