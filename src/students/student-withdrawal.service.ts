import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';
import { Attendance } from '../attendances/entities/attendance.entity';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Grade } from '../grades/entities/grade.entity';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { SalonesService } from '../maestros/salones/salones.service';
import {
  CreateStudentWithdrawalDto,
  StudentWithdrawalContext,
  StudentWithdrawalEligibility,
  StudentWithdrawalListResponse,
  StudentWithdrawalResponse,
} from './dto/student-withdrawal.dto';
import { StudentAcademicHistory } from './entities/student-academic-history.entity';
import { Student } from './entities/student.entity';
import { StudentWithdrawal } from './entities/student-withdrawal.entity';
import { StudentChangeAuditService } from './student-change-audit.service';
import {
  MOTIVOS_RETIRO,
  PERMISO_RETIRO_CONSULTAR,
  PERMISO_RETIRO_REGISTRAR,
  RETIRO_SUSTENTO_MIN,
} from './student-withdrawal.constants';
import {
  resolveFechaRetiroWindow,
  todayIso,
  validateFechaRetiro,
} from './student-withdrawal.util';

@Injectable()
export class StudentWithdrawalService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(StudentWithdrawal)
    private readonly withdrawalRepo: Repository<StudentWithdrawal>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(StudentAcademicHistory)
    private readonly historyRepo: Repository<StudentAcademicHistory>,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly salonesService: SalonesService,
    private readonly studentChangeAudit: StudentChangeAuditService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<StudentWithdrawalContext> {
    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const window = await this.buildWindow(anioEscolar, String(anioEscolar));
    return {
      institucion: {
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolar,
        ugel: institution.ugel ?? '',
        dre: institution.dre ?? '',
        codigoModular: institution.codigoModular ?? '',
      },
      permisoRegistrar: PERMISO_RETIRO_REGISTRAR,
      permisoConsultar: PERMISO_RETIRO_CONSULTAR,
      motivos: MOTIVOS_RETIRO,
      fechaMin: window.fechaMin,
      fechaMax: window.fechaMax,
    };
  }

  async getEligibility(
    studentId: number,
  ): Promise<StudentWithdrawalEligibility> {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
    }
    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const window = await this.buildWindow(anioEscolar, student.anioIngreso);
    const existing = await this.withdrawalRepo.findOne({
      where: { studentId, anioEscolar },
    });

    let motivoInelegible: string | null = null;
    if (existing) {
      motivoInelegible = `Ya existe un retiro registrado para el año ${anioEscolar}`;
    } else if (student.estadoMatricula !== 'activo' || !student.activo) {
      motivoInelegible = 'El estudiante no tiene matrícula activa';
    }

    return {
      studentId: student.id,
      studentCodigo: student.codigo || String(student.id),
      studentNombre: `${student.apellido}, ${student.nombre}`.trim(),
      nivel: student.nivel,
      grado: student.grado,
      seccion: student.seccion,
      estadoMatricula: student.estadoMatricula,
      anioEscolar,
      elegible: !motivoInelegible,
      motivoInelegible,
      fechaMin: window.fechaMin,
      fechaMax: window.fechaMax,
      retiroExistenteId: existing?.id ?? null,
    };
  }

  async findAll(filters?: {
    studentId?: number;
    anioEscolar?: number;
    busqueda?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    pageSize?: number;
  }): Promise<StudentWithdrawalListResponse> {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 20));
    const qb = this.withdrawalRepo.createQueryBuilder('w');

    if (filters?.studentId) {
      qb.andWhere('w.studentId = :studentId', { studentId: filters.studentId });
    }
    if (filters?.anioEscolar) {
      qb.andWhere('w.anioEscolar = :anio', { anio: filters.anioEscolar });
    }
    if (filters?.desde) {
      qb.andWhere('w.fechaRetiro >= :desde', { desde: filters.desde });
    }
    if (filters?.hasta) {
      qb.andWhere('w.fechaRetiro <= :hasta', { hasta: filters.hasta });
    }
    if (filters?.busqueda?.trim()) {
      const q = `%${filters.busqueda.trim()}%`;
      qb.andWhere(
        '(w.studentNombre ILIKE :q OR w.studentCodigo ILIKE :q OR w.motivo ILIKE :q)',
        { q },
      );
    }

    const [rows, totalItems] = await qb
      .orderBy('w.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: rows.map((row) => this.toResponse(row)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    };
  }

  async findOne(id: number): Promise<StudentWithdrawalResponse> {
    const row = await this.withdrawalRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Retiro ${id} no encontrado`);
    }
    return this.toResponse(row);
  }

  async register(
    studentId: number,
    dto: CreateStudentWithdrawalDto,
    req?: Request,
  ): Promise<StudentWithdrawalResponse> {
    const motivo = dto.motivo?.trim();
    const sustento = dto.sustento?.trim();
    if (
      !motivo ||
      !MOTIVOS_RETIRO.includes(motivo as (typeof MOTIVOS_RETIRO)[number])
    ) {
      throw new BadRequestException('Debe indicar un motivo de retiro válido');
    }
    if (!sustento || sustento.length < RETIRO_SUSTENTO_MIN) {
      throw new BadRequestException(
        `El sustento es obligatorio (mínimo ${RETIRO_SUSTENTO_MIN} caracteres)`,
      );
    }

    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
    }

    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const correlationId = req ? getCorrelationId(req) : null;

    if (correlationId) {
      const byCorr = await this.withdrawalRepo.findOne({
        where: { studentId, anioEscolar, correlationId },
      });
      if (byCorr) {
        return this.toResponse(byCorr, true);
      }
    }

    const existing = await this.withdrawalRepo.findOne({
      where: { studentId, anioEscolar },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un retiro registrado para este estudiante en el año ${anioEscolar}`,
      );
    }

    if (!student.activo || student.estadoMatricula !== 'activo') {
      throw new BadRequestException(
        'Solo se puede registrar el retiro de un estudiante con matrícula activa',
      );
    }

    const window = await this.buildWindow(anioEscolar, student.anioIngreso);
    const fechaError = validateFechaRetiro(dto.fechaRetiro, window);
    if (fechaError) {
      throw new BadRequestException(fechaError);
    }

    const actor = req
      ? parseActorFromRequest(req)
      : { usuarioId: null, usuarioNombre: 'Sistema', usuarioRol: '' };
    const ip = req ? getClientIp(req) : '';

    const notasConservadas = await this.gradeRepo.count({
      where: { studentId },
    });
    const asistenciasConservadas = await this.attendanceRepo.count({
      where: { studentId },
    });

    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {
      estadoMatricula: { anterior: student.estadoMatricula, nuevo: 'retirado' },
      activo: { anterior: student.activo, nuevo: true },
      fechaRetiro: { nuevo: dto.fechaRetiro },
      motivo: { nuevo: motivo },
    };

    const saved = await this.dataSource.transaction(async (manager) => {
      const studentTx = manager.getRepository(Student);
      const withdrawalTx = manager.getRepository(StudentWithdrawal);
      const historyTx = manager.getRepository(StudentAcademicHistory);

      const locked = await studentTx.findOne({
        where: { id: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
      }
      if (!locked.activo || locked.estadoMatricula !== 'activo') {
        throw new BadRequestException(
          'Solo se puede registrar el retiro de un estudiante con matrícula activa',
        );
      }

      const dup = await withdrawalTx.findOne({
        where: { studentId, anioEscolar },
      });
      if (dup) {
        throw new ConflictException(
          `Ya existe un retiro registrado para este estudiante en el año ${anioEscolar}`,
        );
      }

      locked.estadoMatricula = 'retirado';
      await studentTx.save(locked);

      const anioKey = String(anioEscolar);
      let history = await historyTx.findOne({
        where: { studentId, anio: anioKey },
      });
      if (history) {
        history.estado = 'Retirado';
        history.grado = locked.grado;
        history.seccion = locked.seccion;
        await historyTx.save(history);
      } else {
        history = await historyTx.save(
          historyTx.create({
            studentId,
            anio: anioKey,
            grado: locked.grado,
            seccion: locked.seccion,
            promedio: 0,
            estado: 'Retirado',
          }),
        );
      }

      const vacantes = await this.countVacantesAfter(
        locked.nivel,
        locked.grado,
        locked.seccion,
        anioEscolar,
      );

      return withdrawalTx.save(
        withdrawalTx.create({
          studentId,
          studentCodigo: locked.codigo || String(locked.id),
          studentNombre: `${locked.apellido}, ${locked.nombre}`.trim(),
          anioEscolar,
          nivel: locked.nivel,
          grado: locked.grado,
          seccion: locked.seccion,
          fechaRetiro: dto.fechaRetiro,
          motivo,
          sustento,
          estado: 'registrado',
          actorUserId: actor.usuarioId,
          actorNombre: actor.usuarioNombre,
          actorRol: actor.usuarioRol,
          cambios,
          ip,
          correlationId,
          notasConservadas,
          asistenciasConservadas,
          vacantesDisponiblesDespues: vacantes,
        }),
      );
    });

    await this.studentChangeAudit.recordWithdrawal(student, cambios, {
      req,
      motivo: `${motivo}. ${sustento}`.slice(0, 500),
    });

    this.auditLogger.log({
      accion: 'actualizar',
      modulo: 'matricula',
      entidad: 'retiro_estudiante',
      entidadId: String(saved.id),
      descripcion: `Retiro registrado — ${saved.studentNombre} (${saved.studentCodigo})`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip,
      correlationId: correlationId ?? undefined,
      resultado: 'success',
      nivel: 'warning',
      detalle: {
        studentId,
        anioEscolar,
        fechaRetiro: dto.fechaRetiro,
        motivo,
        estadoAnterior: 'activo',
        estadoNuevo: 'retirado',
        notasConservadas,
        asistenciasConservadas,
        vacantesDisponiblesDespues: saved.vacantesDisponiblesDespues,
      },
    });

    return this.toResponse(saved);
  }

  private async buildWindow(anioEscolar: number, anioIngreso?: string | null) {
    const periodos = await this.periodosService.findAll({
      anioEscolar,
      activo: true,
    });
    const inicios = periodos
      .map((p) => p.inicio)
      .filter(Boolean)
      .sort();
    const fines = periodos
      .map((p) => p.fin)
      .filter(Boolean)
      .sort();
    return resolveFechaRetiroWindow({
      anioEscolar,
      anioIngreso,
      periodoInicio: inicios[0] ?? null,
      periodoFin: fines.at(-1) ?? null,
      hoy: todayIso(),
    });
  }

  private async countVacantesAfter(
    nivel: string,
    grado: string,
    seccion: string,
    anioEscolar: number,
  ): Promise<number> {
    const occupancy = await this.salonesService.getSectionOccupancy(
      nivel,
      grado,
      anioEscolar,
    );
    const sec = seccion.trim().toUpperCase();
    const item = occupancy.find((o) => o.seccion === sec);
    return item?.disponibles ?? 0;
  }

  private async requireInstitution(): Promise<Institution> {
    let institution = await this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!institution) {
      institution = await this.institutionRepo.save(
        this.institutionRepo.create({}),
      );
    }
    return institution;
  }

  private toResponse(
    row: StudentWithdrawal,
    duplicadoIdempotente = false,
  ): StudentWithdrawalResponse {
    return {
      id: row.id,
      studentId: row.studentId,
      studentCodigo: row.studentCodigo,
      studentNombre: row.studentNombre,
      anioEscolar: row.anioEscolar,
      nivel: row.nivel,
      grado: row.grado,
      seccion: row.seccion,
      fechaRetiro: row.fechaRetiro,
      motivo: row.motivo,
      sustento: row.sustento,
      estado: row.estado,
      actorUserId: row.actorUserId,
      actorNombre: row.actorNombre,
      actorRol: row.actorRol,
      cambios: row.cambios,
      ip: row.ip,
      correlationId: row.correlationId,
      notasConservadas: row.notasConservadas,
      asistenciasConservadas: row.asistenciasConservadas,
      vacantesDisponiblesDespues: row.vacantesDisponiblesDespues,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      duplicadoIdempotente: duplicadoIdempotente || undefined,
    };
  }
}
