import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  esSuperusuarioSiagie,
  institutionIdDeAlcance,
} from '../auth/siagie-access.util';
import { Student } from '../students/entities/student.entity';
import { AttendancesService } from './attendances.service';
import {
  evaluateRecurrentAbsenteeism,
  matchesNivelFilter,
  RecurrentAlertRuleConfig,
  RECURRENT_ALERT_ESTADOS_ABIERTOS,
} from './attendance-recurrent-alerts.util';
import {
  CloseRecurrentAlertDto,
  RecurrentAlertActionDto,
  UpdateRecurrentAlertSettingsDto,
} from './dto/recurrent-alert.dto';
import { AttendanceAlertSettings } from './entities/attendance-alert-settings.entity';
import {
  AttendanceRecurrentAlert,
  RecurrentAlertEstado,
} from './entities/attendance-recurrent-alert.entity';
import {
  AttendanceRecurrentAlertAction,
  RecurrentAlertAccion,
} from './entities/attendance-recurrent-alert-action.entity';

export interface RecurrentAlertsContextResponse {
  institucion: {
    id: number;
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel: string;
    dre: string;
  } | null;
  settings: RecurrentAlertRuleConfig & { institutionId: number | null };
  permisos: {
    consultar: boolean;
    gestionar: boolean;
    exportar: boolean;
  };
  alcance: 'IE' | 'SIAGIE' | 'UGEL' | 'DRE' | 'MINEDU';
}

export interface RecurrentAlertListItem {
  id: number;
  institutionId: number;
  studentId: number;
  estudiante: string;
  nivel: string;
  grado: string;
  seccion: string;
  periodoKey: string;
  periodoLabel: string;
  periodoTipo: string;
  estado: RecurrentAlertEstado;
  nivelRiesgo: string;
  faltasInjustificadas: number;
  diasConsecutivos: number;
  porcentajeInasistencia: number;
  motivoObservacion: string;
  derivadoARol: string;
  derivadoAUsuario: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

@Injectable()
export class AttendanceRecurrentAlertsService {
  constructor(
    @InjectRepository(AttendanceRecurrentAlert)
    private readonly alertRepo: Repository<AttendanceRecurrentAlert>,
    @InjectRepository(AttendanceRecurrentAlertAction)
    private readonly actionRepo: Repository<AttendanceRecurrentAlertAction>,
    @InjectRepository(AttendanceAlertSettings)
    private readonly settingsRepo: Repository<AttendanceAlertSettings>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly attendancesService: AttendancesService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(
    user?: RequestUser,
    req?: { query?: Record<string, unknown>; headers?: Record<string, string | string[] | undefined> },
  ): Promise<RecurrentAlertsContextResponse> {
    const institutionId = institutionIdDeAlcance(user, req);
    const institution = institutionId
      ? await this.institutionRepo.findOneBy({ id: institutionId })
      : await this.institutionRepo.findOne({ order: { id: 'ASC' } });

    const settings = await this.resolveSettings(institutionId ?? institution?.id ?? null);

    return {
      institucion: institution
        ? {
            id: institution.id,
            nombre: institution.nombre,
            siglas: institution.siglas,
            anioEscolar: Number(institution.anio) || new Date().getFullYear(),
            ugel: institution.ugel,
            dre: institution.dre,
          }
        : null,
      settings: {
        institutionId: settings.institutionId,
        diasAlertaAusentismo: settings.diasAlertaAusentismo,
        diasAlertaCritica: settings.diasAlertaCritica,
        porcentajeUmbral: Number(settings.porcentajeUmbral),
        periodoTipo: settings.periodoTipo as RecurrentAlertRuleConfig['periodoTipo'],
        nivelEducativo: settings.nivelEducativo,
        modalidad: settings.modalidad,
      },
      permisos: {
        consultar: this.canConsult(user),
        gestionar: this.canManage(user),
        exportar: this.canExport(user),
      },
      alcance: this.resolveAlcance(user),
    };
  }

  async updateSettings(
    dto: UpdateRecurrentAlertSettingsDto,
    institutionId?: number,
  ): Promise<RecurrentAlertRuleConfig & { institutionId: number | null }> {
    const settings = await this.resolveSettings(institutionId ?? null, true);

    if (dto.diasAlertaAusentismo !== undefined) {
      settings.diasAlertaAusentismo = dto.diasAlertaAusentismo;
    }
    if (dto.diasAlertaCritica !== undefined) {
      settings.diasAlertaCritica = dto.diasAlertaCritica;
    }
    if (dto.porcentajeUmbral !== undefined) {
      settings.porcentajeUmbral = dto.porcentajeUmbral;
    }
    if (dto.periodoTipo !== undefined) settings.periodoTipo = dto.periodoTipo;
    if (dto.nivelEducativo !== undefined) {
      settings.nivelEducativo = dto.nivelEducativo.trim();
    }
    if (dto.modalidad !== undefined) settings.modalidad = dto.modalidad;

    if (settings.diasAlertaCritica <= settings.diasAlertaAusentismo) {
      throw new BadRequestException(
        'Los días de alerta crítica deben ser mayores que los de alerta temprana',
      );
    }

    const saved = await this.settingsRepo.save(settings);
    return this.mapSettings(saved);
  }

  async listAlerts(query: {
    institutionId?: number;
    mes?: string;
    estado?: string;
    nivel?: string;
    grado?: string;
    busqueda?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: RecurrentAlertListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const mesKey = query.mes?.slice(0, 7) ?? this.currentMesKey();

    const qb = this.alertRepo
      .createQueryBuilder('a')
      .orderBy('a.updatedAt', 'DESC')
      .addOrderBy('a.id', 'DESC');

    if (query.institutionId != null) {
      qb.andWhere('a.institutionId = :institutionId', {
        institutionId: query.institutionId,
      });
    }
    if (query.mes) {
      qb.andWhere('a.periodoKey = :periodoKey', { periodoKey: mesKey });
    }
    const estado = query.estado?.trim();
    if (estado && estado !== 'todas') {
      qb.andWhere('a.estado = :estado', { estado });
    } else if (!estado) {
      qb.andWhere('a.estado IN (:...abiertos)', {
        abiertos: [...RECURRENT_ALERT_ESTADOS_ABIERTOS],
      });
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const studentMeta = await this.loadStudentMeta(rows.map((r) => r.studentId));

    const items = rows.map((row) =>
      this.toListItem(row, studentMeta.get(row.studentId)),
    );

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async scanAndSync(query: {
    institutionId?: number;
    mes?: string;
    nivel?: string;
    grado?: string;
    actor?: RequestUser;
  }): Promise<{ creadas: number; actualizadas: number; omitidas: number }> {
    if (query.institutionId == null) {
      throw new BadRequestException(
        'Seleccione una institución educativa para detectar alertas recurrentes',
      );
    }

    const mesKey = query.mes?.slice(0, 7) ?? this.currentMesKey();
    const settings = await this.resolveSettings(query.institutionId);
    const config = this.mapSettings(settings);

    const evaluated = await this.attendancesService.findAlerts({
      mes: mesKey,
      nivel: query.nivel,
      grado: query.grado,
      institutionId: query.institutionId,
    });

    let creadas = 0;
    let actualizadas = 0;
    let omitidas = 0;

    for (const candidate of evaluated.alerts) {
      if (!matchesNivelFilter(candidate.nivel, config.nivelEducativo)) {
        omitidas++;
        continue;
      }

      const evaluation = evaluateRecurrentAbsenteeism(
        {
          faltasInjustificadas: candidate.faltasInjustificadas,
          diasConsecutivos: candidate.diasConsecutivos,
          totalRegistrosBd: candidate.totalRegistrosBd,
        },
        config,
      );

      if (!evaluation.dispara) {
        omitidas++;
        continue;
      }

      const existing = await this.alertRepo.findOne({
        where: {
          studentId: candidate.studentId,
          periodoKey: mesKey,
          institutionId: query.institutionId,
        },
      });

      if (
        existing &&
        !RECURRENT_ALERT_ESTADOS_ABIERTOS.includes(
          existing.estado as (typeof RECURRENT_ALERT_ESTADOS_ABIERTOS)[number],
        )
      ) {
        omitidas++;
        continue;
      }

      const payload: Partial<AttendanceRecurrentAlert> = {
        institutionId: query.institutionId,
        studentId: candidate.studentId,
        periodoKey: mesKey,
        periodoTipo: config.periodoTipo,
        periodoLabel: evaluated.mesLabel ?? mesKey,
        nivelEducativo: candidate.nivel,
        modalidad: config.modalidad,
        estado: existing?.estado ?? 'abierta',
        nivelRiesgo: evaluation.nivel,
        faltasInjustificadas: candidate.faltasInjustificadas,
        diasConsecutivos: candidate.diasConsecutivos,
        porcentajeInasistencia: evaluation.porcentajeInasistencia,
        motivoObservacion: evaluation.motivo,
      };

      if (existing) {
        const before = { ...existing };
        Object.assign(existing, payload);
        const saved = await this.alertRepo.save(existing);
        await this.recordAction(
          saved.id,
          'actualizar',
          query.actor,
          'Actualización por detección recurrente',
          before,
          saved,
        );
        actualizadas++;
      } else {
        const saved = await this.alertRepo.save(this.alertRepo.create(payload));
        await this.recordAction(
          saved.id,
          'detectada',
          query.actor,
          'Alerta generada por reglas de ausentismo recurrente',
          null,
          saved,
        );
        creadas++;
      }
    }

    this.auditLogger.log({
      accion: 'actualizar',
      modulo: 'asistencia',
      entidad: 'alerta_ausentismo_recurrente',
      descripcion: 'Detección de alertas por ausentismo recurrente',
      institutionId: query.institutionId,
      detalle: { mes: mesKey, creadas, actualizadas, omitidas },
      usuarioNombre: query.actor?.username,
      usuarioRol: query.actor?.rolPrincipal,
    });

    return { creadas, actualizadas, omitidas };
  }

  async syncAfterDailyRegister(
    institutionId: number | undefined,
    mesKey: string,
    actor?: RequestUser,
  ): Promise<void> {
    if (institutionId == null) return;
    await this.scanAndSync({ institutionId, mes: mesKey, actor });
  }

  async atender(
    id: number,
    dto: RecurrentAlertActionDto,
    user?: RequestUser,
    institutionId?: number,
  ): Promise<RecurrentAlertListItem> {
    this.assertCanManage(user);
    const alert = await this.getAlertOrFail(id, institutionId);
    if (alert.estado === 'cerrada') {
      throw new BadRequestException('La alerta ya está cerrada');
    }
    const before = { ...alert };
    alert.estado = 'atendida';
    const saved = await this.alertRepo.save(alert);
    await this.recordAction(
      saved.id,
      'atender',
      user,
      dto.motivo?.trim() || 'Alerta atendida',
      before,
      saved,
    );
    return this.toListItem(
      saved,
      (await this.loadStudentMeta([saved.studentId])).get(saved.studentId),
    );
  }

  async derivar(
    id: number,
    dto: RecurrentAlertActionDto,
    user?: RequestUser,
    institutionId?: number,
  ): Promise<RecurrentAlertListItem> {
    this.assertCanManage(user);
    if (!dto.derivadoARol?.trim() && !dto.derivadoAUsuario?.trim()) {
      throw new BadRequestException(
        'Indique rol o usuario destino para derivar la alerta',
      );
    }
    const alert = await this.getAlertOrFail(id, institutionId);
    if (alert.estado === 'cerrada') {
      throw new BadRequestException('La alerta ya está cerrada');
    }
    const before = { ...alert };
    alert.estado = 'derivada';
    alert.derivadoARol = dto.derivadoARol?.trim() ?? '';
    alert.derivadoAUsuario = dto.derivadoAUsuario?.trim() ?? '';
    const saved = await this.alertRepo.save(alert);
    await this.recordAction(
      saved.id,
      'derivar',
      user,
      dto.motivo?.trim() || 'Alerta derivada',
      before,
      saved,
    );
    return this.toListItem(
      saved,
      (await this.loadStudentMeta([saved.studentId])).get(saved.studentId),
    );
  }

  async cerrar(
    id: number,
    dto: CloseRecurrentAlertDto,
    user?: RequestUser,
    institutionId?: number,
  ): Promise<RecurrentAlertListItem> {
    this.assertCanManage(user);
    const alert = await this.getAlertOrFail(id, institutionId);
    if (alert.estado === 'cerrada') {
      throw new BadRequestException('La alerta ya está cerrada');
    }
    const before = { ...alert };
    alert.estado = 'cerrada';
    alert.cerradoMotivo = dto.motivo.trim();
    alert.closedAt = new Date();
    const saved = await this.alertRepo.save(alert);
    await this.recordAction(
      saved.id,
      'cerrar',
      user,
      dto.motivo.trim(),
      before,
      saved,
    );
    return this.toListItem(
      saved,
      (await this.loadStudentMeta([saved.studentId])).get(saved.studentId),
    );
  }

  async justificar(
    id: number,
    dto: RecurrentAlertActionDto,
    user?: RequestUser,
    institutionId?: number,
  ): Promise<RecurrentAlertListItem> {
    this.assertCanManage(user);
    const alert = await this.getAlertOrFail(id, institutionId);
    const before = { ...alert };
    if (dto.justificationId != null) {
      alert.justificationId = dto.justificationId;
    }
    alert.estado = alert.estado === 'abierta' ? 'atendida' : alert.estado;
    alert.motivoObservacion = [
      alert.motivoObservacion,
      dto.motivo?.trim() || 'Vinculada a justificación de inasistencias',
    ]
      .filter(Boolean)
      .join(' · ');
    const saved = await this.alertRepo.save(alert);
    await this.recordAction(
      saved.id,
      'justificar',
      user,
      dto.motivo?.trim() || 'Alerta vinculada a justificación',
      before,
      saved,
    );
    return this.toListItem(
      saved,
      (await this.loadStudentMeta([saved.studentId])).get(saved.studentId),
    );
  }

  async getActions(alertId: number, institutionId?: number) {
    await this.getAlertOrFail(alertId, institutionId);
    const rows = await this.actionRepo.find({
      where: { alertId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      accion: r.accion,
      actorNombre: r.actorNombre,
      actorRol: r.actorRol,
      motivo: r.motivo,
      valorAnterior: r.valorAnterior,
      valorNuevo: r.valorNuevo,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async getAlertOrFail(
    id: number,
    institutionId?: number,
  ): Promise<AttendanceRecurrentAlert> {
    const alert = await this.alertRepo.findOneBy({ id });
    if (!alert) throw new NotFoundException(`Alerta ${id} no encontrada`);
    if (institutionId != null && alert.institutionId !== institutionId) {
      throw new NotFoundException(`Alerta ${id} no encontrada`);
    }
    return alert;
  }

  private async resolveSettings(
    institutionId: number | null,
    createIfMissing = false,
  ): Promise<AttendanceAlertSettings> {
    if (institutionId != null) {
      let row = await this.settingsRepo.findOne({
        where: { institutionId },
      });
      if (!row && createIfMissing) {
        const global = await this.resolveSettings(null, true);
        row = await this.settingsRepo.save(
          this.settingsRepo.create({
            institutionId,
            diasAlertaAusentismo: global.diasAlertaAusentismo,
            diasAlertaCritica: global.diasAlertaCritica,
            porcentajeUmbral: global.porcentajeUmbral,
            periodoTipo: global.periodoTipo,
            nivelEducativo: global.nivelEducativo,
            modalidad: global.modalidad,
          }),
        );
      }
      if (row) return row;
    }

    let global = await this.settingsRepo.findOne({
      where: { institutionId: IsNull() },
      order: { id: 'ASC' },
    });
    if (!global) {
      global = await this.settingsRepo.findOne({ order: { id: 'ASC' } });
    }
    if (!global && createIfMissing) {
      global = await this.settingsRepo.save(
        this.settingsRepo.create({
          institutionId: null,
          diasAlertaAusentismo: 2,
          diasAlertaCritica: 5,
          porcentajeUmbral: 15,
          periodoTipo: 'mes',
          nivelEducativo: '',
          modalidad: 'todos',
        }),
      );
    }
    if (!global) {
      throw new BadRequestException(
        'No hay configuración de alertas de ausentismo',
      );
    }
    return global;
  }

  private mapSettings(
    settings: AttendanceAlertSettings,
  ): RecurrentAlertRuleConfig & { institutionId: number | null } {
    return {
      institutionId: settings.institutionId,
      diasAlertaAusentismo: settings.diasAlertaAusentismo,
      diasAlertaCritica: settings.diasAlertaCritica,
      porcentajeUmbral: Number(settings.porcentajeUmbral),
      periodoTipo: settings.periodoTipo as RecurrentAlertRuleConfig['periodoTipo'],
      nivelEducativo: settings.nivelEducativo,
      modalidad: settings.modalidad,
    };
  }

  private async loadStudentMeta(
    studentIds: number[],
  ): Promise<
    Map<
      number,
      { estudiante: string; nivel: string; grado: string; seccion: string }
    >
  > {
    const map = new Map<
      number,
      { estudiante: string; nivel: string; grado: string; seccion: string }
    >();
    const uniqueIds = [...new Set(studentIds)];
    if (!uniqueIds.length) return map;

    const students = await this.studentRepo.find({
      where: { id: In(uniqueIds) },
    });

    for (const student of students) {
      map.set(student.id, {
        estudiante: `${student.apellido}, ${student.nombre}`,
        nivel: student.nivel,
        grado: student.grado,
        seccion: student.seccion,
      });
    }
    return map;
  }

  private toListItem(
    row: AttendanceRecurrentAlert,
    meta?: {
      estudiante: string;
      nivel: string;
      grado: string;
      seccion: string;
    },
  ): RecurrentAlertListItem {
    return {
      id: row.id,
      institutionId: row.institutionId,
      studentId: row.studentId,
      estudiante: meta?.estudiante ?? `Estudiante #${row.studentId}`,
      nivel: meta?.nivel ?? row.nivelEducativo,
      grado: meta?.grado ?? '',
      seccion: meta?.seccion ?? '',
      periodoKey: row.periodoKey,
      periodoLabel: row.periodoLabel,
      periodoTipo: row.periodoTipo,
      estado: row.estado,
      nivelRiesgo: row.nivelRiesgo,
      faltasInjustificadas: row.faltasInjustificadas,
      diasConsecutivos: row.diasConsecutivos,
      porcentajeInasistencia: Number(row.porcentajeInasistencia),
      motivoObservacion: row.motivoObservacion,
      derivadoARol: row.derivadoARol,
      derivadoAUsuario: row.derivadoAUsuario,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
    };
  }

  private async recordAction(
    alertId: number,
    accion: RecurrentAlertAccion,
    user: RequestUser | undefined,
    motivo: string,
    before: AttendanceRecurrentAlert | null,
    after: AttendanceRecurrentAlert,
  ): Promise<void> {
    await this.actionRepo.save(
      this.actionRepo.create({
        alertId,
        accion,
        actorUserId: user?.id ? Number(user.id) : null,
        actorNombre: user?.username ?? '',
        actorRol: user?.rolPrincipal ?? '',
        motivo,
        valorAnterior: before ? this.snapshotAlert(before) : null,
        valorNuevo: this.snapshotAlert(after),
      }),
    );
  }

  private snapshotAlert(alert: AttendanceRecurrentAlert): Record<string, unknown> {
    return {
      estado: alert.estado,
      nivelRiesgo: alert.nivelRiesgo,
      faltasInjustificadas: alert.faltasInjustificadas,
      diasConsecutivos: alert.diasConsecutivos,
      porcentajeInasistencia: Number(alert.porcentajeInasistencia),
      derivadoARol: alert.derivadoARol,
      derivadoAUsuario: alert.derivadoAUsuario,
      justificationId: alert.justificationId,
    };
  }

  private currentMesKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private canConsult(user?: RequestUser): boolean {
    return (
      !!user?.permisos?.includes('asistencia.ver') ||
      !!user?.permisos?.includes('asistencia.reportes')
    );
  }

  private canManage(user?: RequestUser): boolean {
    return (
      !!user?.permisos?.includes('asistencia.editar') ||
      !!user?.permisos?.includes('asistencia.registrar')
    );
  }

  private canExport(user?: RequestUser): boolean {
    return !!user?.permisos?.includes('asistencia.exportar');
  }

  private assertCanManage(user?: RequestUser): void {
    if (!this.canManage(user)) {
      throw new ForbiddenException(
        'No tiene permiso para gestionar alertas de ausentismo',
      );
    }
  }

  private resolveAlcance(
    user?: RequestUser,
  ): RecurrentAlertsContextResponse['alcance'] {
    if (!user) return 'IE';
    if (esSuperusuarioSiagie(user)) return 'SIAGIE';
    const roles = user.roles ?? [];
    if (roles.includes('MINEDU')) return 'MINEDU';
    if (roles.includes('DRE')) return 'DRE';
    if (roles.includes('UGEL')) return 'UGEL';
    return 'IE';
  }
}
