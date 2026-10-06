import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AUDIT_LOG_RETENTION_DAYS } from '../audit-logs/audit-logs.constants';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { StudentsService } from '../students/students.service';
import {
  CompetencyChangeAccion,
  CompetencyChangeLog,
} from './entities/competency-change-log.entity';
import {
  CompetencyEvaluation,
  NivelLogro,
} from './entities/competency-evaluation.entity';

export interface CompetencyAuditContext {
  actorUserId?: number | null;
  actorNombre?: string;
  actorRol?: string;
  motivo?: string;
  ip?: string;
  correlationId?: string | null;
  institutionId?: number | null;
}

export interface CompetencyChangeAuditContext {
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

@Injectable()
export class CompetencyChangeAuditService {
  constructor(
    @InjectRepository(CompetencyChangeLog)
    private readonly logRepo: Repository<CompetencyChangeLog>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly studentsService: StudentsService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<CompetencyChangeAuditContext> {
    let institution = await this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!institution) {
      institution = await this.institutionRepo.save(this.institutionRepo.create({}));
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
    accion: CompetencyChangeAccion,
    evaluation: Pick<
      CompetencyEvaluation,
      | 'id'
      | 'studentId'
      | 'competenciaId'
      | 'curriculumId'
      | 'bimestre'
      | 'anio'
      | 'institutionId'
    >,
    cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
    ctx?: CompetencyAuditContext,
  ): Promise<void> {
    await this.logRepo.save(
      this.logRepo.create({
        evaluationId: evaluation.id ?? null,
        studentId: evaluation.studentId,
        competenciaId: evaluation.competenciaId,
        curriculumId: evaluation.curriculumId,
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

  async findAll(filters?: {
    studentId?: number;
    competenciaId?: number;
    bimestre?: number;
    accion?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 20));
    const qb = this.logRepo
      .createQueryBuilder('l')
      .orderBy('l.createdAt', 'DESC')
      .addOrderBy('l.id', 'DESC');

    if (filters?.studentId) {
      qb.andWhere('l.studentId = :studentId', { studentId: filters.studentId });
    }
    if (filters?.competenciaId) {
      qb.andWhere('l.competenciaId = :competenciaId', {
        competenciaId: filters.competenciaId,
      });
    }
    if (filters?.bimestre) {
      qb.andWhere('l.bimestre = :bimestre', { bimestre: filters.bimestre });
    }
    if (filters?.accion) {
      qb.andWhere('l.accion = :accion', { accion: filters.accion });
    }

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

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
          studentNombre: studentNames.get(r.studentId) ?? `Estudiante #${r.studentId}`,
          competenciaId: r.competenciaId,
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
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  snapshotNivel(nivel: NivelLogro | null | undefined): Record<string, unknown> {
    return { nivelLogro: nivel ?? null };
  }
}
