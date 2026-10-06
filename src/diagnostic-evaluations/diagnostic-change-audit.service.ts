import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AUDIT_LOG_RETENTION_DAYS } from '../audit-logs/audit-logs.constants';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { StudentsService } from '../students/students.service';
import {
  DiagnosticChangeAccion,
  DiagnosticChangeLog,
} from './entities/diagnostic-change-log.entity';
import { DiagnosticEvaluation } from './entities/diagnostic-evaluation.entity';

export interface DiagnosticAuditContext {
  actorUserId?: number | null;
  actorNombre?: string;
  actorRol?: string;
  motivo?: string;
  ip?: string;
  correlationId?: string | null;
  institutionId?: number | null;
}

export interface DiagnosticChangeAuditContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel?: string;
    dre?: string;
  };
  retencionDias: number;
  permisoConsulta: string;
}

function snapshotEvaluation(e: DiagnosticEvaluation): Record<string, unknown> {
  return {
    nota: e.nota,
    nivelLogro: e.nivelLogro,
    observacion: e.observacion ?? null,
    fechaEvaluacion: e.fechaEvaluacion,
  };
}

function diffSnapshots(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { anterior?: unknown; nuevo?: unknown }> | null {
  const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] !== after[key]) {
      cambios[key] = { anterior: before[key], nuevo: after[key] };
    }
  }
  return Object.keys(cambios).length ? cambios : null;
}

@Injectable()
export class DiagnosticChangeAuditService {
  constructor(
    @InjectRepository(DiagnosticChangeLog)
    private readonly logRepo: Repository<DiagnosticChangeLog>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly studentsService: StudentsService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<DiagnosticChangeAuditContext> {
    let institution = await this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!institution) {
      institution = await this.institutionRepo.save(
        this.institutionRepo.create({}),
      );
    }
    return {
      institucion: {
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolar: Number(institution.anio) || new Date().getFullYear(),
        ugel: institution.ugel,
        dre: institution.dre,
      },
      retencionDias: AUDIT_LOG_RETENTION_DAYS,
      permisoConsulta: 'evaluacion.reportes',
    };
  }

  async recordChange(
    accion: DiagnosticChangeAccion,
    evaluation: Pick<
      DiagnosticEvaluation,
      'id' | 'studentId' | 'curso' | 'bimestre' | 'anio' | 'institutionId'
    >,
    cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
    ctx?: DiagnosticAuditContext,
  ): Promise<void> {
    await this.logRepo.save(
      this.logRepo.create({
        evaluationId: evaluation.id ?? null,
        studentId: evaluation.studentId,
        curso: evaluation.curso,
        institutionId: evaluation.institutionId ?? ctx?.institutionId ?? null,
        bimestre: evaluation.bimestre,
        anio: evaluation.anio,
        accion,
        actorUserId: ctx?.actorUserId ?? null,
        actorNombre: ctx?.actorNombre ?? '',
        actorRol: ctx?.actorRol ?? '',
        motivo: ctx?.motivo ?? '',
        cambios,
        ip: ctx?.ip ?? '',
        correlationId: ctx?.correlationId ?? null,
        resultado: 'success',
      }),
    );
  }

  async recordCreate(
    evaluation: DiagnosticEvaluation,
    ctx?: DiagnosticAuditContext,
  ): Promise<void> {
    const after = snapshotEvaluation(evaluation);
    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> =
      {};
    for (const [key, value] of Object.entries(after)) {
      cambios[key] = { nuevo: value };
    }
    await this.recordChange('crear', evaluation, cambios, ctx);
  }

  async recordUpdate(
    evaluation: DiagnosticEvaluation,
    before: DiagnosticEvaluation,
    ctx?: DiagnosticAuditContext,
  ): Promise<void> {
    const cambios = diffSnapshots(
      snapshotEvaluation(before),
      snapshotEvaluation(evaluation),
    );
    if (!cambios) return;
    await this.recordChange('actualizar', evaluation, cambios, ctx);
  }

  async findAll(filters?: {
    studentId?: number;
    curso?: string;
    accion?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 20));
    const qb = this.logRepo
      .createQueryBuilder('l')
      .orderBy('l.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (filters?.studentId) {
      qb.andWhere('l.studentId = :studentId', {
        studentId: filters.studentId,
      });
    }
    if (filters?.curso) {
      qb.andWhere('l.curso = :curso', { curso: filters.curso });
    }
    if (filters?.accion) {
      qb.andWhere('l.accion = :accion', { accion: filters.accion });
    }

    const [items, totalItems] = await qb.getManyAndCount();

    const studentIds = [...new Set(items.map((r) => r.studentId))];
    const studentNames = new Map<number, string>();
    for (const id of studentIds) {
      try {
        const student = await this.studentsService.findOne(id);
        studentNames.set(id, `${student.apellido}, ${student.nombre}`);
      } catch {
        studentNames.set(id, `Estudiante #${id}`);
      }
    }

    return {
      items: items.map((r) => {
        const created = r.createdAt;
        const fecha = created.toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const hora = created.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return {
          id: r.id,
          evaluationId: r.evaluationId,
          studentId: r.studentId,
          studentNombre:
            studentNames.get(r.studentId) ?? `Estudiante #${r.studentId}`,
          curso: r.curso,
          bimestre: r.bimestre,
          anio: r.anio,
          accion: r.accion,
          actorNombre: r.actorNombre,
          actorRol: r.actorRol,
          motivo: r.motivo,
          cambios: r.cambios,
          createdAt: r.createdAt.toISOString(),
          fechaDisplay: fecha,
          horaDisplay: hora,
        };
      }),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
      },
    };
  }
}
