import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, In, Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { Institution } from '../institution/entities/institution.entity';
import { ParentStudent } from '../parents/entities/parent-student.entity';
import {
  RepresentanteData,
  Student,
} from '../students/entities/student.entity';
import { gradoLabelFromParts } from '../students/students.mapper';
import {
  AssociateStudentsDto,
  AssociateStudentsResult,
  CeaseRepresentativeLinkDto,
  RepresentativeLinkLogResponse,
  RepresentativeLinkResponse,
  RepresentativeLinksContext,
  RepresentativeLookupResponse,
  RepresentativeResponse,
  UpdateRepresentativeLinkDto,
} from './dto/representative-links.dto';
import { RepresentativeLinkLog } from './entities/representative-link-log.entity';
import { RepresentativeStudentLink } from './entities/representative-student-link.entity';
import { Representative } from './entities/representative.entity';
import {
  PERMISO_VINCULOS_GESTIONAR,
  PERMISO_VINCULOS_VER,
  TIPOS_VINCULO,
} from './representative-links.constants';

export interface RepresentativeAuditContext {
  actorUserId?: number | null;
  actorNombre?: string;
  actorRol?: string;
  ip?: string;
  correlationId?: string | null;
}

@Injectable()
export class RepresentativeLinksService {
  constructor(
    @InjectRepository(Representative)
    private readonly representativeRepo: Repository<Representative>,
    @InjectRepository(RepresentativeStudentLink)
    private readonly linkRepo: Repository<RepresentativeStudentLink>,
    @InjectRepository(RepresentativeLinkLog)
    private readonly logRepo: Repository<RepresentativeLinkLog>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly auditLogger: AuditLoggerService,
    private readonly dataSource: DataSource,
  ) {}

  async getContext(): Promise<RepresentativeLinksContext> {
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
      permisoConsulta: PERMISO_VINCULOS_VER,
      permisoGestion: PERMISO_VINCULOS_GESTIONAR,
      tiposVinculo: [...TIPOS_VINCULO],
    };
  }

  normalizeDocument(value: string): string {
    return value.trim().replace(/\s+/g, '');
  }

  toRepresentativeResponse(
    rep: Representative,
    extra?: Partial<RepresentativeResponse>,
  ): RepresentativeResponse {
    return {
      id: rep.id,
      tipoDocumento: rep.tipoDocumento,
      numeroDocumento: rep.numeroDocumento,
      nombres: rep.nombres,
      apellidos: rep.apellidos,
      apellidoPaterno: rep.apellidoPaterno,
      apellidoMaterno: rep.apellidoMaterno,
      email: rep.email,
      telefono: rep.telefono,
      ...extra,
    };
  }

  async findByDocument(
    tipoDocumento: string,
    numeroDocumento: string,
  ): Promise<RepresentativeLookupResponse> {
    const tipo = tipoDocumento.trim() || 'DNI';
    const doc = this.normalizeDocument(numeroDocumento);
    if (!doc) {
      throw new BadRequestException('Debe indicar el número de documento');
    }

    let rep = await this.representativeRepo.findOne({
      where: { tipoDocumento: tipo, numeroDocumento: doc },
    });

    let sugeridoDesdeExpediente = false;
    if (!rep) {
      const suggested = await this.findRepresentativeInStudents(tipo, doc);
      if (suggested) {
        sugeridoDesdeExpediente = true;
        return {
          representante: {
            id: null,
            tipoDocumento: tipo,
            numeroDocumento: doc,
            nombres: suggested.nombres,
            apellidos: suggested.apellidos,
            apellidoPaterno: suggested.apellidoPaterno,
            apellidoMaterno: suggested.apellidoMaterno,
            email: suggested.email,
            telefono: suggested.telefono,
            pendienteRegistro: true,
          },
          vinculosActivos: [],
          vinculosHistoricos: [],
          sugeridoDesdeExpediente,
        };
      }
      return {
        representante: null,
        vinculosActivos: [],
        vinculosHistoricos: [],
        sugeridoDesdeExpediente: false,
      };
    }

    const links = await this.linkRepo.find({
      where: { representativeId: rep.id },
      order: { createdAt: 'DESC' },
    });
    const students = await this.loadStudentSummaries(links.map((l) => l.studentId));
    const mapped = links.map((l) => this.toLinkResponse(l, students.get(l.studentId)));

    return {
      representante: this.toRepresentativeResponse(rep),
      vinculosActivos: mapped.filter((l) => l.activo),
      vinculosHistoricos: mapped.filter((l) => !l.activo),
      sugeridoDesdeExpediente,
    };
  }

  async associateStudents(
    dto: AssociateStudentsDto,
    ctx?: RepresentativeAuditContext,
  ): Promise<AssociateStudentsResult> {
    const tipo = dto.tipoDocumento.trim() || 'DNI';
    const doc = this.normalizeDocument(dto.numeroDocumento);
    if (!doc) {
      throw new BadRequestException('Debe indicar el número de documento');
    }

    const uniqueStudentIds = [...new Set(dto.studentIds)];
    const creados: RepresentativeLinkResponse[] = [];
    const omitidos: Array<{ studentId: number; razon: string }> = [];

    await this.dataSource.transaction(async (manager) => {
      const repRepo = manager.getRepository(Representative);
      const linkRepo = manager.getRepository(RepresentativeStudentLink);
      const studentRepo = manager.getRepository(Student);
      const parentRepo = manager.getRepository(ParentStudent);

      let rep = await repRepo.findOne({
        where: { tipoDocumento: tipo, numeroDocumento: doc },
      });

      if (!rep) {
        const data = dto.representante ?? {};
        const nombres = data.nombres?.trim();
        if (!nombres) {
          throw new BadRequestException(
            'Debe registrar nombres del representante para crear el vínculo',
          );
        }
        rep = repRepo.create({
          tipoDocumento: tipo,
          numeroDocumento: doc,
          nombres,
          apellidos: data.apellidos?.trim() ?? '',
          apellidoPaterno: data.apellidoPaterno?.trim() ?? '',
          apellidoMaterno: data.apellidoMaterno?.trim() ?? '',
          email: data.email?.trim().toLowerCase() ?? '',
          telefono: data.telefono?.trim() ?? '',
        });
        rep = await repRepo.save(rep);
      } else if (dto.representante) {
        rep.nombres = dto.representante.nombres?.trim() || rep.nombres;
        rep.apellidos = dto.representante.apellidos?.trim() ?? rep.apellidos;
        rep.apellidoPaterno =
          dto.representante.apellidoPaterno?.trim() ?? rep.apellidoPaterno;
        rep.apellidoMaterno =
          dto.representante.apellidoMaterno?.trim() ?? rep.apellidoMaterno;
        if (dto.representante.email?.trim()) {
          rep.email = dto.representante.email.trim().toLowerCase();
        }
        if (dto.representante.telefono?.trim()) {
          rep.telefono = dto.representante.telefono.trim();
        }
        rep = await repRepo.save(rep);
      }

      const today = new Date().toISOString().slice(0, 10);

      for (const studentId of uniqueStudentIds) {
        const student = await studentRepo.findOne({ where: { id: studentId } });
        if (!student) {
          omitidos.push({ studentId, razon: 'Estudiante no encontrado' });
          continue;
        }

        const existing = await linkRepo.findOne({
          where: {
            representativeId: rep.id,
            studentId,
            activo: true,
          },
        });
        if (existing) {
          omitidos.push({
            studentId,
            razon: 'Ya existe un vínculo activo con este representante',
          });
          continue;
        }

        const esPrincipal = dto.esPrincipal ?? false;
        if (esPrincipal) {
          await this.clearPrincipalForStudent(linkRepo, studentId);
        }

        const link = linkRepo.create({
          representativeId: rep.id,
          studentId,
          tipoVinculo: dto.tipoVinculo,
          esPrincipal,
          vigenciaDesde: today,
          vigenciaHasta: null,
          activo: true,
          motivoCese: '',
        });
        const saved = await linkRepo.save(link);

        await this.syncStudentRepresentativeSlot(
          studentRepo,
          student,
          rep,
          dto.tipoVinculo,
          esPrincipal,
        );
        await this.syncParentStudentLink(parentRepo, rep, studentId, dto.tipoVinculo);

        await this.persistLinkLog(manager, {
          linkId: saved.id,
          representativeId: rep.id,
          studentId,
          accion: 'crear',
          motivo: dto.motivo,
          cambios: {
            tipoVinculo: { nuevo: dto.tipoVinculo },
            esPrincipal: { nuevo: esPrincipal },
            vigenciaDesde: { nuevo: today },
          },
          ctx,
        });

        const summary = this.studentSummary(student);
        creados.push(this.toLinkResponse(saved, summary));
      }
    });

    const rep = await this.representativeRepo.findOneOrFail({
      where: {
        tipoDocumento: tipo,
        numeroDocumento: doc,
      },
    });

    this.auditLogger.log({
      accion: 'crear',
      modulo: 'estudiantes',
      entidad: 'representative_link',
      entidadId: String(rep.id),
      descripcion: `Asoció ${creados.length} estudiante(s) al representante ${doc}`,
      usuarioId: ctx?.actorUserId ?? null,
      usuarioNombre: ctx?.actorNombre ?? '',
      usuarioRol: ctx?.actorRol ?? '',
      detalle: {
        representativeId: rep.id,
        creados: creados.map((c) => c.studentId),
        omitidos,
      },
      ip: ctx?.ip ?? '',
      correlationId: ctx?.correlationId ?? null,
    });

    return {
      representante: this.toRepresentativeResponse(rep),
      creados,
      omitidos,
    };
  }

  async updateLink(
    linkId: number,
    dto: UpdateRepresentativeLinkDto,
    ctx?: RepresentativeAuditContext,
  ): Promise<RepresentativeLinkResponse> {
    const link = await this.linkRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    if (!link.activo) {
      throw new BadRequestException('No se puede modificar un vínculo inactivo');
    }

    const rep = await this.representativeRepo.findOne({
      where: { id: link.representativeId },
    });
    if (!rep) throw new NotFoundException('Representante no encontrado');

    const student = await this.studentRepo.findOne({ where: { id: link.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};

    await this.dataSource.transaction(async (manager) => {
      const linkRepo = manager.getRepository(RepresentativeStudentLink);
      const studentRepo = manager.getRepository(Student);
      const current = await linkRepo.findOneOrFail({ where: { id: linkId } });

      if (dto.tipoVinculo && dto.tipoVinculo !== current.tipoVinculo) {
        cambios.tipoVinculo = {
          anterior: current.tipoVinculo,
          nuevo: dto.tipoVinculo,
        };
        current.tipoVinculo = dto.tipoVinculo;
      }

      if (dto.esPrincipal !== undefined && dto.esPrincipal !== current.esPrincipal) {
        if (dto.esPrincipal) {
          await this.clearPrincipalForStudent(linkRepo, current.studentId, current.id);
        }
        cambios.esPrincipal = {
          anterior: current.esPrincipal,
          nuevo: dto.esPrincipal,
        };
        current.esPrincipal = dto.esPrincipal;
      }

      await linkRepo.save(current);

      await this.syncStudentRepresentativeSlot(
        studentRepo,
        student,
        rep,
        current.tipoVinculo,
        current.esPrincipal,
      );

      await this.persistLinkLog(manager, {
        linkId: current.id,
        representativeId: current.representativeId,
        studentId: current.studentId,
        accion: 'actualizar',
        motivo: dto.motivo,
        cambios,
        ctx,
      });
    });

    const updated = await this.linkRepo.findOneOrFail({ where: { id: linkId } });
    this.auditLogger.log({
      accion: 'actualizar',
      modulo: 'estudiantes',
      entidad: 'representative_link',
      entidadId: String(linkId),
      descripcion: `Actualizó vínculo representante-estudiante #${linkId}`,
      usuarioId: ctx?.actorUserId ?? null,
      usuarioNombre: ctx?.actorNombre ?? '',
      usuarioRol: ctx?.actorRol ?? '',
      detalle: { cambios },
      ip: ctx?.ip ?? '',
      correlationId: ctx?.correlationId ?? null,
    });

    return this.toLinkResponse(updated, this.studentSummary(student));
  }

  async ceaseLink(
    linkId: number,
    dto: CeaseRepresentativeLinkDto,
    ctx?: RepresentativeAuditContext,
  ): Promise<RepresentativeLinkResponse> {
    const link = await this.linkRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    if (!link.activo) {
      throw new BadRequestException('El vínculo ya está inactivo');
    }

    const rep = await this.representativeRepo.findOne({
      where: { id: link.representativeId },
    });
    if (!rep) throw new NotFoundException('Representante no encontrado');

    const student = await this.studentRepo.findOne({ where: { id: link.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const today = new Date().toISOString().slice(0, 10);

    await this.dataSource.transaction(async (manager) => {
      const linkRepo = manager.getRepository(RepresentativeStudentLink);
      const parentRepo = manager.getRepository(ParentStudent);
      const current = await linkRepo.findOneOrFail({ where: { id: linkId } });
      current.activo = false;
      current.vigenciaHasta = today;
      current.motivoCese = dto.motivo.trim();
      current.esPrincipal = false;
      await linkRepo.save(current);

      if (rep.email) {
        await parentRepo.delete({
          parentEmail: rep.email.toLowerCase(),
          studentId: current.studentId,
        });
      }

      await this.persistLinkLog(manager, {
        linkId: current.id,
        representativeId: current.representativeId,
        studentId: current.studentId,
        accion: 'cesar',
        motivo: dto.motivo,
        cambios: {
          activo: { anterior: true, nuevo: false },
          vigenciaHasta: { nuevo: today },
          motivoCese: { nuevo: dto.motivo },
        },
        ctx,
      });
    });

    const updated = await this.linkRepo.findOneOrFail({ where: { id: linkId } });
    this.auditLogger.log({
      accion: 'eliminar',
      modulo: 'estudiantes',
      entidad: 'representative_link',
      entidadId: String(linkId),
      descripcion: `Cesó vínculo representante-estudiante #${linkId}`,
      usuarioId: ctx?.actorUserId ?? null,
      usuarioNombre: ctx?.actorNombre ?? '',
      usuarioRol: ctx?.actorRol ?? '',
      detalle: { motivo: dto.motivo },
      ip: ctx?.ip ?? '',
      correlationId: ctx?.correlationId ?? null,
    });

    return this.toLinkResponse(updated, this.studentSummary(student));
  }

  async findAuditLogs(filters?: {
    representativeId?: number;
    studentId?: number;
    limit?: number;
  }): Promise<{ items: RepresentativeLinkLogResponse[]; total: number }> {
    const qb = this.logRepo
      .createQueryBuilder('l')
      .orderBy('l.createdAt', 'DESC');

    if (filters?.representativeId) {
      qb.andWhere('l.representativeId = :representativeId', {
        representativeId: filters.representativeId,
      });
    }
    if (filters?.studentId) {
      qb.andWhere('l.studentId = :studentId', { studentId: filters.studentId });
    }

    const total = await qb.getCount();
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const rows = await qb.take(limit).getMany();

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        linkId: r.linkId,
        representativeId: r.representativeId,
        studentId: r.studentId,
        accion: r.accion,
        actorNombre: r.actorNombre,
        actorRol: r.actorRol,
        motivo: r.motivo,
        cambios: r.cambios,
        resultado: r.resultado,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  auditContextFromRequest(req: Request): RepresentativeAuditContext {
    const actor = parseActorFromRequest(req);
    return {
      actorUserId: actor.usuarioId,
      actorNombre: actor.usuarioNombre,
      actorRol: actor.usuarioRol,
      ip: getClientIp(req),
      correlationId: getCorrelationId(req),
    };
  }

  private async findRepresentativeInStudents(
    tipoDocumento: string,
    numeroDocumento: string,
  ): Promise<RepresentanteData | null> {
    const students = await this.studentRepo.find();
    for (const student of students) {
      for (const slot of [student.padre, student.madre, student.apoderado]) {
        if (
          slot &&
          (slot.tipoDocumento || 'DNI') === tipoDocumento &&
          this.normalizeDocument(slot.dni || '') === numeroDocumento
        ) {
          return slot;
        }
      }
    }
    return null;
  }

  private async loadStudentSummaries(studentIds: number[]) {
    const unique = [...new Set(studentIds)];
    const map = new Map<number, ReturnType<typeof this.studentSummary>>();
    if (!unique.length) return map;
    const students = await this.studentRepo.find({ where: { id: In(unique) } });
    for (const s of students) {
      map.set(s.id, this.studentSummary(s));
    }
    return map;
  }

  private studentSummary(student: Student) {
    return {
      id: student.id,
      codigo: student.codigo,
      nombres: student.nombre,
      apellidos:
        student.apellido ||
        [student.apellidoPaterno, student.apellidoMaterno].filter(Boolean).join(' '),
      gradoLabel: gradoLabelFromParts(student.nivel, student.grado),
      seccion: student.seccion,
      estado: student.estadoMatricula ?? (student.activo ? 'activo' : 'inactivo'),
    };
  }

  private toLinkResponse(
    link: RepresentativeStudentLink,
    student?: ReturnType<typeof this.studentSummary>,
  ): RepresentativeLinkResponse {
    return {
      id: link.id,
      representativeId: link.representativeId,
      studentId: link.studentId,
      tipoVinculo: link.tipoVinculo,
      esPrincipal: link.esPrincipal,
      vigenciaDesde: link.vigenciaDesde,
      vigenciaHasta: link.vigenciaHasta,
      activo: link.activo,
      motivoCese: link.motivoCese,
      student,
    };
  }

  private async clearPrincipalForStudent(
    linkRepo: Repository<RepresentativeStudentLink>,
    studentId: number,
    exceptLinkId?: number,
  ): Promise<void> {
    const qb = linkRepo
      .createQueryBuilder()
      .update(RepresentativeStudentLink)
      .set({ esPrincipal: false })
      .where('"studentId" = :studentId', { studentId })
      .andWhere('activo = true')
      .andWhere('"esPrincipal" = true');
    if (exceptLinkId) {
      qb.andWhere('id != :exceptLinkId', { exceptLinkId });
    }
    await qb.execute();
  }

  private async syncStudentRepresentativeSlot(
    studentRepo: Repository<Student>,
    student: Student,
    rep: Representative,
    tipoVinculo: string,
    esPrincipal: boolean,
  ): Promise<void> {
    const payload: RepresentanteData = {
      nombres: rep.nombres,
      apellidos: rep.apellidos,
      apellidoPaterno: rep.apellidoPaterno,
      apellidoMaterno: rep.apellidoMaterno,
      tipoDocumento: rep.tipoDocumento,
      dni: rep.numeroDocumento,
      telefono: rep.telefono,
      email: rep.email,
      trabajo: tipoVinculo,
    };

    if (tipoVinculo === 'padre') {
      student.padre = payload;
    } else if (tipoVinculo === 'madre') {
      student.madre = payload;
    } else if (tipoVinculo === 'apoderado' || esPrincipal) {
      student.apoderado = payload;
    }
    await studentRepo.save(student);
  }

  private async syncParentStudentLink(
    parentRepo: Repository<ParentStudent>,
    rep: Representative,
    studentId: number,
    parentesco: string,
  ): Promise<void> {
    const email = rep.email?.trim().toLowerCase();
    if (!email) return;
    const existing = await parentRepo.findOne({
      where: { parentEmail: email, studentId },
    });
    if (existing) {
      existing.parentesco = parentesco;
      await parentRepo.save(existing);
      return;
    }
    await parentRepo.save(
      parentRepo.create({
        parentEmail: email,
        studentId,
        parentesco,
      }),
    );
  }

  private async persistLinkLog(
    manager: DataSource['manager'],
    input: {
      linkId: number;
      representativeId: number;
      studentId: number;
      accion: 'crear' | 'actualizar' | 'cesar';
      motivo: string;
      cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;
      ctx?: RepresentativeAuditContext;
    },
  ): Promise<void> {
    const logRepo = manager.getRepository(RepresentativeLinkLog);
    await logRepo.save(
      logRepo.create({
        linkId: input.linkId,
        representativeId: input.representativeId,
        studentId: input.studentId,
        accion: input.accion,
        actorUserId: input.ctx?.actorUserId ?? null,
        actorNombre: input.ctx?.actorNombre ?? '',
        actorRol: input.ctx?.actorRol ?? '',
        motivo: input.motivo,
        cambios: input.cambios,
        ip: input.ctx?.ip ?? '',
        correlationId: input.ctx?.correlationId ?? null,
        resultado: 'success',
      }),
    );
  }
}
