import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { DocumentStorageService } from '../storage/document-storage.service';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { Institution } from '../institution/entities/institution.entity';
import {
  UpdateDocumentoDto,
  UpsertDocumentoDto,
} from './dto/expediente.dto';
import {
  DocumentoArchivoResponse,
  StudentDocumentAuditResponse,
  StudentDocumentsContext,
  UploadStudentDocumentDto,
} from './dto/student-document-upload.dto';
import { StudentDocumentsResponse } from './dto/student-documents.dto';
import {
  combinarRequisitosConDocumentos,
  requisitosPorGrado,
  tiposEquivalentes,
} from './document-requirements.constants';
import { buildCodigo, gradoLabelFromParts } from './students.mapper';
import { StudentDocumentAuditLog } from './entities/student-document-audit-log.entity';
import { StudentDocumentVersion } from './entities/student-document-version.entity';
import { StudentDocument } from './entities/student-document.entity';
import { Student } from './entities/student.entity';
import {
  computeFileSha256,
  validateStudentDocumentFile,
} from './student-document-upload.util';
import {
  PERMISO_DOCUMENTOS_CARGAR,
  PERMISO_DOCUMENTOS_DESCARGAR,
  PERMISO_DOCUMENTOS_VER,
  STUDENT_DOC_ALLOWED_MIMES,
  STUDENT_DOC_MAX_BYTES,
} from './student-documents.constants';

export interface StudentDocumentAuditContext {
  actorUserId?: number | null;
  actorNombre?: string;
  actorRol?: string;
  ip?: string;
  correlationId?: string | null;
}

@Injectable()
export class StudentDocumentsService {
  constructor(
    @InjectRepository(StudentDocument)
    private readonly documentRepo: Repository<StudentDocument>,
    @InjectRepository(StudentDocumentVersion)
    private readonly versionRepo: Repository<StudentDocumentVersion>,
    @InjectRepository(StudentDocumentAuditLog)
    private readonly auditRepo: Repository<StudentDocumentAuditLog>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly auditLogger: AuditLoggerService,
    private readonly documentStorage: DocumentStorageService,
  ) {}

  async getContext(): Promise<StudentDocumentsContext> {
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
      permisoConsulta: PERMISO_DOCUMENTOS_VER,
      permisoCarga: PERMISO_DOCUMENTOS_CARGAR,
      permisoDescarga: PERMISO_DOCUMENTOS_DESCARGAR,
      maxBytes: STUDENT_DOC_MAX_BYTES,
      maxMb: STUDENT_DOC_MAX_BYTES / (1024 * 1024),
      formatosPermitidos: ['PDF', 'JPG', 'JPEG', 'PNG', 'WebP', 'GIF'],
      mimeTypes: [...STUDENT_DOC_ALLOWED_MIMES],
      storageDriver: this.documentStorage.driver,
    };
  }

  auditContextFromRequest(req: Request): StudentDocumentAuditContext {
    const actor = parseActorFromRequest(req);
    return {
      actorUserId: actor.usuarioId,
      actorNombre: actor.usuarioNombre,
      actorRol: actor.usuarioRol,
      ip: getClientIp(req),
      correlationId: getCorrelationId(req),
    };
  }

  async getActiveFile(documentId: number): Promise<DocumentoArchivoResponse | null> {
    const version = await this.versionRepo.findOne({
      where: { documentId, activo: true },
      order: { version: 'DESC' },
    });
    return version ? this.toArchivoResponse(version) : null;
  }

  async listVersions(
    studentId: number,
    documentId: number,
  ): Promise<DocumentoArchivoResponse[]> {
    await this.getDocumentOrFail(studentId, documentId);
    const rows = await this.versionRepo.find({
      where: { documentId, studentId },
      order: { version: 'DESC' },
    });
    return rows.map((v) => this.toArchivoResponse(v));
  }

  async uploadFile(
    studentId: number,
    documentId: number,
    file: Express.Multer.File,
    dto: UploadStudentDocumentDto,
    ctx?: StudentDocumentAuditContext,
  ): Promise<{ documento: StudentDocument; archivo: DocumentoArchivoResponse }> {
    const doc = await this.getDocumentOrFail(studentId, documentId);

    validateStudentDocumentFile(file);
    const nextVersion =
      (await this.versionRepo.count({ where: { documentId } })) + 1;
    const sha256 = computeFileSha256(file.buffer);
    const savedFile = await this.documentStorage.putStudentDocument({
      studentId,
      documentId,
      version: nextVersion,
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      sha256,
    });

    const duplicate = await this.versionRepo.findOne({
      where: { documentId, sha256: savedFile.sha256, activo: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'Ya existe una versión activa con el mismo contenido (hash idéntico)',
      );
    }

    await this.versionRepo.update({ documentId, activo: true }, { activo: false });

    const version = await this.versionRepo.save(
      this.versionRepo.create({
        documentId,
        studentId,
        version: nextVersion,
        nombreArchivo: savedFile.nombreArchivo,
        mimeType: savedFile.mimeType,
        tamanoBytes: savedFile.tamanoBytes,
        sha256: savedFile.sha256,
        storagePath: savedFile.storagePath,
        url: savedFile.url,
        activo: true,
        vigenciaHasta: dto.vigenciaHasta?.trim() || null,
        uploadedByUserId: ctx?.actorUserId ?? null,
        uploadedByNombre: ctx?.actorNombre ?? '',
      }),
    );

    doc.estado = 'entregado';
    doc.imagenUrl = savedFile.url;
    if (dto.numero?.trim()) doc.numero = dto.numero.trim();
    if (!doc.fechaEntrega) {
      doc.fechaEntrega = new Date().toISOString().slice(0, 10);
    }
    const updated = await this.documentRepo.save(doc);

    await this.persistAudit({
      studentId,
      documentId,
      versionId: version.id,
      accion: 'subir',
      motivo: dto.motivo,
      detalle: {
        version: nextVersion,
        nombreArchivo: savedFile.nombreArchivo,
        sha256: savedFile.sha256,
        tamanoBytes: savedFile.tamanoBytes,
      },
      ctx,
    });

    this.auditLogger.log({
      accion: 'crear',
      modulo: 'estudiantes',
      entidad: 'student_document',
      entidadId: String(documentId),
      descripcion: `Cargó documento "${doc.tipo}" v${nextVersion} para estudiante #${studentId}`,
      usuarioId: ctx?.actorUserId ?? null,
      usuarioNombre: ctx?.actorNombre ?? '',
      usuarioRol: ctx?.actorRol ?? '',
      detalle: { studentId, documentId, version: nextVersion },
      ip: ctx?.ip ?? '',
      correlationId: ctx?.correlationId ?? null,
    });

    return {
      documento: updated,
      archivo: this.toArchivoResponse(version),
    };
  }

  async streamDownload(
    studentId: number,
    documentId: number,
    versionId: number,
    res: Response,
    ctx?: StudentDocumentAuditContext,
  ): Promise<void> {
    const version = await this.versionRepo.findOne({
      where: { id: versionId, documentId, studentId },
    });
    if (!version) {
      throw new NotFoundException('Versión de documento no encontrada');
    }
    if (!(await this.documentStorage.exists(version.storagePath))) {
      throw new NotFoundException('Archivo no disponible en almacenamiento');
    }

    await this.persistAudit({
      studentId,
      documentId,
      versionId,
      accion: 'descargar',
      motivo: 'Descarga de documento',
      detalle: { nombreArchivo: version.nombreArchivo, version: version.version },
      ctx,
    });

    res.setHeader('Content-Type', version.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(version.nombreArchivo)}"`,
    );
    const stream = await this.documentStorage.openReadStream(version.storagePath);
    stream.pipe(res);
  }

  getRequisitosDocumentos(gradoLabel: string) {
    return requisitosPorGrado(gradoLabel);
  }

  async findEntitiesByStudentId(studentId: number): Promise<StudentDocument[]> {
    return this.documentRepo.find({
      where: { studentId },
      order: { id: 'ASC' },
    });
  }

  async deleteAllForStudent(studentId: number): Promise<void> {
    await this.documentRepo.delete({ studentId });
  }

  async replaceDocumentos(
    studentId: number,
    rows: Array<{
      id?: number;
      tipo: string;
      numero?: string;
      estado?: 'entregado' | 'pendiente' | 'vencido';
      fechaEntrega?: string;
      imagenUrl?: string;
    }>,
  ): Promise<void> {
    await this.documentRepo.delete({ studentId });
    if (!rows.length) return;
    await this.documentRepo.save(
      rows.map((row) =>
        this.documentRepo.create({
          studentId,
          tipo: row.tipo.trim(),
          numero: row.numero?.trim() ?? '',
          estado: row.estado ?? 'pendiente',
          fechaEntrega: row.fechaEntrega?.trim() ?? '',
          imagenUrl: row.imagenUrl?.trim() ?? '',
        }),
      ),
    );
  }

  async syncRequisitosMatricula(
    studentId: number,
  ): Promise<StudentDocumentsResponse> {
    const student = await this.getStudentOrFail(studentId);
    const gradoLabel = gradoLabelFromParts(student.nivel, student.grado);
    const requisitos = requisitosPorGrado(gradoLabel);
    const existing = await this.documentRepo.find({ where: { studentId } });

    for (const req of requisitos) {
      const yaExiste = existing.some((doc) =>
        tiposEquivalentes(doc.tipo, req.tipo),
      );
      if (!yaExiste) {
        await this.documentRepo.save(
          this.documentRepo.create({
            studentId,
            tipo: req.tipo,
            estado: 'pendiente',
          }),
        );
      }
    }

    return this.findStudentDocumentsMatricula(studentId);
  }

  async addDocument(studentId: number, dto: UpsertDocumentoDto) {
    await this.getStudentOrFail(studentId);
    const saved = await this.documentRepo.save(
      this.documentRepo.create({
        studentId,
        tipo: dto.tipo.trim(),
        numero: dto.numero?.trim() ?? '',
        estado: dto.estado ?? 'pendiente',
        fechaEntrega: dto.fechaEntrega?.trim() ?? '',
        imagenUrl: dto.imagenUrl?.trim() ?? '',
      }),
    );
    return this.toDocumentResponse(saved);
  }

  async updateDocument(
    studentId: number,
    docId: number,
    dto: UpdateDocumentoDto,
  ) {
    await this.getStudentOrFail(studentId);
    const doc = await this.documentRepo.findOneBy({ id: docId, studentId });
    if (!doc) {
      throw new NotFoundException(`Documento ${docId} no encontrado`);
    }

    if (dto.tipo !== undefined) doc.tipo = dto.tipo.trim();
    if (dto.numero !== undefined) doc.numero = dto.numero.trim();
    if (dto.estado !== undefined) doc.estado = dto.estado;
    if (dto.fechaEntrega !== undefined) {
      doc.fechaEntrega = dto.fechaEntrega.trim();
    }
    if (dto.imagenUrl !== undefined) doc.imagenUrl = dto.imagenUrl.trim();

    const saved = await this.documentRepo.save(doc);
    return this.toDocumentResponse(saved);
  }

  async removeDocument(studentId: number, docId: number) {
    await this.getStudentOrFail(studentId);
    const doc = await this.documentRepo.findOneBy({ id: docId, studentId });
    if (!doc) {
      throw new NotFoundException(`Documento ${docId} no encontrado`);
    }
    await this.documentRepo.remove(doc);
    return { deleted: true, id: docId };
  }

  /** Valida documento con archivo activo para evidencia de traslado. */
  async assertDocumentoEvidenciaTraslado(
    studentId: number,
    documentId: number,
  ): Promise<StudentDocument> {
    const doc = await this.documentRepo.findOneBy({ id: documentId, studentId });
    if (!doc) {
      throw new BadRequestException(
        'Documento no encontrado en el expediente del estudiante.',
      );
    }
    const archivo = await this.getActiveFile(documentId);
    if (!archivo) {
      throw new BadRequestException(
        'El documento seleccionado no tiene archivo cargado. Suba el archivo en el expediente del estudiante.',
      );
    }
    return doc;
  }

  async getEvidenciaTrasladoDetalle(
    studentId: number,
    documentId: number | null,
  ): Promise<{
    id: number;
    tipo: string;
    numero: string;
    estado: StudentDocument['estado'];
    tieneArchivo: boolean;
    versionId: number | null;
  } | null> {
    if (!documentId) return null;
    const doc = await this.documentRepo.findOneBy({ id: documentId, studentId });
    if (!doc) return null;
    const archivo = await this.getActiveFile(documentId);
    return {
      id: doc.id,
      tipo: doc.tipo,
      numero: doc.numero,
      estado: doc.estado,
      tieneArchivo: !!archivo,
      versionId: archivo?.versionId ?? null,
    };
  }

  async findStudentDocumentsMatricula(
    studentId: number,
  ): Promise<StudentDocumentsResponse> {
    const student = await this.getStudentOrFail(studentId);
    const gradoLabel = gradoLabelFromParts(student.nivel, student.grado);
    const stored = await this.documentRepo.find({
      where: { studentId },
      order: { id: 'ASC' },
    });
    const documentos = combinarRequisitosConDocumentos(
      gradoLabel,
      await Promise.all(
        stored.map(async (d) => ({
          ...this.toDocumentResponse(d),
          archivo: await this.getActiveFile(d.id),
        })),
      ),
    );
    return {
      studentId: student.id,
      codigo: buildCodigo(student.id, student.codigo),
      nombres: student.nombre,
      apellidos: student.apellido,
      gradoLabel,
      seccion: student.seccion,
      anioIngreso: student.anioIngreso ?? String(new Date().getFullYear()),
      documentos,
      entregados: documentos.filter((d) => d.estado === 'entregado').length,
      total: documentos.length,
      obligatoriosPendientes: documentos.filter(
        (d) => d.obligatorio && d.estado !== 'entregado',
      ).length,
    };
  }

  async findAuditLogs(filters?: {
    studentId?: number;
    documentId?: number;
    limit?: number;
  }): Promise<{ items: StudentDocumentAuditResponse[]; total: number }> {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC');
    if (filters?.studentId) {
      qb.andWhere('a.studentId = :studentId', { studentId: filters.studentId });
    }
    if (filters?.documentId) {
      qb.andWhere('a.documentId = :documentId', {
        documentId: filters.documentId,
      });
    }
    const total = await qb.getCount();
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const rows = await qb.take(limit).getMany();
    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        documentId: r.documentId,
        versionId: r.versionId,
        accion: r.accion,
        actorNombre: r.actorNombre,
        actorRol: r.actorRol,
        motivo: r.motivo,
        detalle: r.detalle,
        resultado: r.resultado,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  private async getStudentOrFail(studentId: number): Promise<Student> {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    return student;
  }

  private async getDocumentOrFail(
    studentId: number,
    documentId: number,
  ): Promise<StudentDocument> {
    await this.getStudentOrFail(studentId);
    const doc = await this.documentRepo.findOne({
      where: { id: documentId, studentId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  private toDocumentResponse(doc: StudentDocument) {
    return {
      id: doc.id,
      tipo: doc.tipo,
      numero: doc.numero,
      estado: doc.estado,
      fechaEntrega: doc.fechaEntrega,
      imagenUrl: doc.imagenUrl || undefined,
    };
  }

  private toArchivoResponse(v: StudentDocumentVersion): DocumentoArchivoResponse {
    return {
      versionId: v.id,
      version: v.version,
      nombreArchivo: v.nombreArchivo,
      mimeType: v.mimeType,
      tamanoBytes: v.tamanoBytes,
      sha256: v.sha256,
      url: v.url,
      vigenciaHasta: v.vigenciaHasta,
      uploadedAt: v.createdAt.toISOString(),
      uploadedByNombre: v.uploadedByNombre,
    };
  }

  private async persistAudit(input: {
    studentId: number;
    documentId: number;
    versionId?: number | null;
    accion: StudentDocumentAuditLog['accion'];
    motivo: string;
    detalle: Record<string, unknown>;
    ctx?: StudentDocumentAuditContext;
  }): Promise<void> {
    await this.auditRepo.save(
      this.auditRepo.create({
        studentId: input.studentId,
        documentId: input.documentId,
        versionId: input.versionId ?? null,
        accion: input.accion,
        actorUserId: input.ctx?.actorUserId ?? null,
        actorNombre: input.ctx?.actorNombre ?? '',
        actorRol: input.ctx?.actorRol ?? '',
        motivo: input.motivo,
        detalle: input.detalle,
        ip: input.ctx?.ip ?? '',
        correlationId: input.ctx?.correlationId ?? null,
        resultado: 'success',
      }),
    );
  }
}
