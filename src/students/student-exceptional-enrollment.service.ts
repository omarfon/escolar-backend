import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import {
  CheckExceptionalEnrollmentAgeDto,
  CheckExceptionalEnrollmentDuplicatesDto,
  CreateExceptionalEnrollmentDto,
  ExceptionalEnrollmentAgeCheck,
  ExceptionalEnrollmentContext,
} from './dto/student-exceptional-enrollment.dto';
import { StudentAuditContext } from './dto/student-change-audit.dto';
import { Student } from './entities/student.entity';
import { validarEdadNormativa } from './enrollment-age.util';
import { findDuplicateCandidates } from './student-duplicate-match.util';
import {
  MOTIVOS_MATRICULA_EXCEPCIONAL,
  PERMISO_MATRICULA_EXCEPCIONAL,
  PERMISO_MATRICULA_EXCEPCIONAL_CONSULTAR,
} from './student-exceptional-enrollment.constants';
import { StudentChangeAuditService } from './student-change-audit.service';
import {
  buildCodigo,
  ExpedienteResponse,
  normalizeRepresentante,
  parseFechaNacInput,
  resolveApellidos,
  splitGradoLabel,
} from './students.mapper';
import { StudentsService } from './students.service';

const GRADOS_DISPONIBLES = [
  { label: '1° Inicial', nivel: 'Inicial', grado: '1°' },
  { label: '2° Inicial', nivel: 'Inicial', grado: '2°' },
  { label: '3° Inicial', nivel: 'Inicial', grado: '3°' },
  { label: '1° Primaria', nivel: 'Primaria', grado: '1°' },
  { label: '2° Primaria', nivel: 'Primaria', grado: '2°' },
  { label: '3° Primaria', nivel: 'Primaria', grado: '3°' },
  { label: '4° Primaria', nivel: 'Primaria', grado: '4°' },
  { label: '5° Primaria', nivel: 'Primaria', grado: '5°' },
  { label: '6° Primaria', nivel: 'Primaria', grado: '6°' },
  { label: '1° Secundaria', nivel: 'Secundaria', grado: '1°' },
  { label: '2° Secundaria', nivel: 'Secundaria', grado: '2°' },
  { label: '3° Secundaria', nivel: 'Secundaria', grado: '3°' },
  { label: '4° Secundaria', nivel: 'Secundaria', grado: '4°' },
  { label: '5° Secundaria', nivel: 'Secundaria', grado: '5°' },
];

@Injectable()
export class StudentExceptionalEnrollmentService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly studentsService: StudentsService,
    private readonly studentChangeAudit: StudentChangeAuditService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<ExceptionalEnrollmentContext> {
    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    return {
      institucion: {
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolar,
        ugel: institution.ugel ?? '',
        dre: institution.dre ?? '',
        codigoModular: institution.codigoModular ?? '',
        fechaCorteNormativa: `${anioEscolar}-03-31`,
      },
      permisoRegistrar: PERMISO_MATRICULA_EXCEPCIONAL,
      permisoConsultar: PERMISO_MATRICULA_EXCEPCIONAL_CONSULTAR,
      motivos: MOTIVOS_MATRICULA_EXCEPCIONAL,
      gradosDisponibles: GRADOS_DISPONIBLES,
    };
  }

  async checkAge(
    dto: CheckExceptionalEnrollmentAgeDto,
  ): Promise<ExceptionalEnrollmentAgeCheck> {
    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const { nivel, grado } = splitGradoLabel(dto.gradoLabel);
    const result = validarEdadNormativa({
      fechaNac: dto.fechaNac,
      nivel,
      grado,
      anioEscolar,
    });
    return {
      cumpleEdadNormativa: result.valido,
      edadActual: result.edadActual,
      edadEsperada: result.edadEsperada,
      fechaCorte: result.fechaCorte,
      mensaje: result.mensaje,
      requiereExcepcional: !result.valido,
    };
  }

  async findDuplicates(dto: CheckExceptionalEnrollmentDuplicatesDto) {
    const students = await this.studentRepo.find();
    return findDuplicateCandidates(students, {
      nombres: dto.nombres,
      apellidos: dto.apellidos,
      fechaNac: dto.fechaNac,
      sexo: dto.sexo,
    });
  }

  async register(
    dto: CreateExceptionalEnrollmentDto,
    auditCtx?: StudentAuditContext,
  ): Promise<ExpedienteResponse> {
    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const { nivel, grado } = splitGradoLabel(dto.gradoLabel);

    const edadCheck = validarEdadNormativa({
      fechaNac: dto.fechaNac,
      nivel,
      grado,
      anioEscolar,
    });

    if (edadCheck.valido) {
      throw new BadRequestException(
        'La edad del estudiante cumple la normativa para el grado indicado. Use el flujo de matrícula regular.',
      );
    }

    const docNum = dto.dni.trim();
    const tipoDoc = dto.tipoDocumento?.trim() || 'DNI';
    const existingDoc = await this.studentRepo.findOne({
      where: { dni: docNum, tipoDocumento: tipoDoc },
    });
    if (existingDoc) {
      throw new ConflictException('Ya existe un estudiante con ese número de documento');
    }

    const coincidencias = await this.findDuplicates({
      nombres: dto.nombres,
      apellidos: dto.apellidos,
      fechaNac: dto.fechaNac,
      sexo: dto.sexo,
    });
    if (coincidencias.length && !dto.confirmarDuplicado) {
      throw new ConflictException({
        message:
          'Se encontraron posibles coincidencias con estudiantes existentes. Revise antes de continuar.',
        coincidencias,
      });
    }

    const emailInput = dto.email?.trim().toLowerCase();
    if (emailInput) {
      const existingEmail = await this.studentRepo.findOneBy({ email: emailInput });
      if (existingEmail) {
        throw new BadRequestException('Ya existe un estudiante con ese correo electrónico');
      }
    }

    const apellidos = resolveApellidos(dto);
    const entity = this.studentRepo.create({
      nombre: dto.nombres.trim(),
      apellido: apellidos.apellido,
      apellidoPaterno: apellidos.apellidoPaterno,
      apellidoMaterno: apellidos.apellidoMaterno,
      email: emailInput || `alumno.${docNum}@estudiante.pe`,
      nivel,
      grado,
      seccion: dto.seccion.trim().toUpperCase(),
      activo: true,
      codigo: '',
      dni: docNum,
      tipoDocumento: tipoDoc,
      fechaNac: parseFechaNacInput(dto.fechaNac),
      sexo: dto.sexo ?? 'M',
      direccion: dto.direccion?.trim() ?? '',
      distrito: '',
      provincia: '',
      departamento: '',
      telefonoEmergencia: '',
      foto: '',
      grupoSanguineo: 'O+',
      alergias: '',
      condicionesSalud: '',
      observaciones: '',
      anioIngreso: String(anioEscolar),
      estadoMatricula: 'activo',
      conductaNota: 'AD',
      estadoDocumento: 'regular',
      matriculaExcepcional: true,
      excepcionalMotivo: dto.excepcionalMotivo.trim(),
      excepcionalSustento: dto.excepcionalSustento.trim(),
      edadNormativaAlRegistro: edadCheck.edadActual,
      padre: normalizeRepresentante(undefined),
      madre: normalizeRepresentante(undefined),
      apoderado: normalizeRepresentante(dto.apoderado),
    });

    const saved = await this.studentRepo.save(entity);
    saved.codigo = buildCodigo(saved.id, saved.codigo);
    await this.studentRepo.save(saved);

    await this.studentChangeAudit.recordCreate(saved, {
      ...auditCtx,
      motivo: dto.excepcionalMotivo.trim(),
    });

    if (auditCtx?.req) {
      const actor = parseActorFromRequest(auditCtx.req);
      this.auditLogger.log({
        accion: 'crear',
        modulo: 'matricula',
        entidad: 'matricula_excepcional',
        entidadId: String(saved.id),
        descripcion: `Registró matrícula excepcional (sin validar edad normativa) — estudiante ${saved.id}`,
        usuarioId: actor.usuarioId,
        usuarioNombre: actor.usuarioNombre,
        usuarioRol: actor.usuarioRol,
        ip: getClientIp(auditCtx.req),
        correlationId: getCorrelationId(auditCtx.req),
        resultado: 'success',
        detalle: {
          studentId: saved.id,
          gradoLabel: dto.gradoLabel,
          edadAlRegistro: edadCheck.edadActual,
          edadEsperada: edadCheck.edadEsperada,
          motivo: dto.excepcionalMotivo.trim(),
        },
      });
    }

    return this.studentsService.findExpediente(saved.id);
  }

  logConsultation(req: Request, accion: 'contexto' | 'registrar'): void {
    const actor = parseActorFromRequest(req);
    this.auditLogger.log({
      accion: 'consultar',
      modulo: 'matricula',
      entidad: 'matricula_excepcional',
      descripcion:
        accion === 'contexto'
          ? 'Consultó contexto de matrícula excepcional'
          : 'Inició consulta previa a matrícula excepcional',
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip: getClientIp(req),
      correlationId: getCorrelationId(req),
      resultado: 'success',
    });
  }

  private async requireInstitution(): Promise<Institution> {
    let institution = await this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!institution) {
      institution = await this.institutionRepo.save(this.institutionRepo.create({}));
    }
    return institution;
  }
}
