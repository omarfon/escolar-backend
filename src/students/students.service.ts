import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Attendance } from '../attendances/entities/attendance.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { ChangeSectionDto } from './dto/change-section.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import {
  CreateExpedienteDto,
  UpdateDocumentoDto,
  UpdateExpedienteDto,
  UpsertDocumentoDto,
} from './dto/expediente.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { SectionChange } from './entities/section-change.entity';
import { StudentAcademicHistory } from './entities/student-academic-history.entity';
import { StudentDocument } from './entities/student-document.entity';
import {
  REPRESENTANTE_VACIO,
  Student,
} from './entities/student.entity';
import {
  buildCodigo,
  ExpedienteResponse,
  gradoLabelFromParts,
  normalizeRepresentante,
  parseFechaNacInput,
  splitGradoLabel,
  toExpedienteResponse,
} from './students.mapper';
import {
  requisitosPorGrado,
  tiposEquivalentes,
} from './document-requirements.constants';
import {
  BulkImportMatriculaResult,
  BulkMatriculaPreviewItem,
  BulkMatriculaPreviewResult,
  BulkMatriculaRowDto,
} from './dto/bulk-import-students.dto';
import { parseMatriculaFile, FilaParseadaMatricula } from './bulk-matricula.parser';
import { ClassroomsService } from '../classrooms/classrooms.service';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(SectionChange)
    private readonly sectionChangeRepo: Repository<SectionChange>,
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(StudentDocument)
    private readonly documentRepo: Repository<StudentDocument>,
    @InjectRepository(StudentAcademicHistory)
    private readonly historyRepo: Repository<StudentAcademicHistory>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    private readonly classroomsService: ClassroomsService,
  ) {}

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    const entity = this.studentsRepository.create({
      ...createStudentDto,
      padre: { ...REPRESENTANTE_VACIO },
      madre: { ...REPRESENTANTE_VACIO },
      apoderado: { ...REPRESENTANTE_VACIO },
    });
    const saved = await this.studentsRepository.save(entity);
    if (!saved.codigo) {
      saved.codigo = buildCodigo(saved.id);
      await this.studentsRepository.save(saved);
    }
    return saved;
  }

  async createExpediente(dto: CreateExpedienteDto): Promise<ExpedienteResponse> {
    const email = dto.email.trim().toLowerCase();
    const existingEmail = await this.studentsRepository.findOneBy({ email });
    if (existingEmail) {
      throw new BadRequestException('Ya existe un estudiante con ese correo electrónico');
    }

    if (dto.dni?.trim()) {
      const existingDni = await this.studentsRepository.findOneBy({
        dni: dto.dni.trim(),
      });
      if (existingDni) {
        throw new BadRequestException('Ya existe un estudiante con ese DNI');
      }
    }

    const { nivel, grado } = splitGradoLabel(dto.gradoLabel);
    const estado = dto.estado ?? 'activo';
    const entity = this.studentsRepository.create({
      nombre: dto.nombres.trim(),
      apellido: dto.apellidos.trim(),
      email: dto.email.trim(),
      nivel,
      grado,
      seccion: dto.seccion.trim().toUpperCase(),
      activo: estado === 'activo',
      codigo: dto.codigo?.trim() ?? '',
      dni: dto.dni?.trim() ?? '',
      fechaNac: parseFechaNacInput(dto.fechaNac),
      sexo: dto.sexo ?? 'M',
      direccion: dto.direccion?.trim() ?? '',
      foto: dto.foto?.trim() ?? '',
      grupoSanguineo: dto.grupoSanguineo?.trim() || 'O+',
      alergias: dto.alergias?.trim() ?? '',
      condicionesSalud: dto.condicionesSalud?.trim() ?? '',
      observaciones: dto.observaciones?.trim() ?? '',
      anioIngreso: dto.anioIngreso?.trim() || String(new Date().getFullYear()),
      estadoMatricula: estado,
      conductaNota: dto.conductaNota?.trim() || 'AD',
      padre: normalizeRepresentante(dto.padre),
      madre: normalizeRepresentante(dto.madre),
      apoderado: normalizeRepresentante(dto.apoderado),
    });

    const saved = await this.studentsRepository.save(entity);
    if (!saved.codigo) {
      saved.codigo = buildCodigo(saved.id);
      await this.studentsRepository.save(saved);
    }

    if (dto.historialAcademico?.length) {
      await this.replaceHistorial(saved.id, dto.historialAcademico);
    }
    if (dto.documentos?.length) {
      await this.replaceDocumentos(saved.id, dto.documentos);
    }

    return this.findExpediente(saved.id);
  }

  async bulkCreateMatriculas(
    estudiantes: BulkMatriculaRowDto[],
    erroresValidacion: BulkImportMatriculaResult['erroresValidacion'] = [],
  ): Promise<BulkImportMatriculaResult> {
    const creados: ExpedienteResponse[] = [];
    const errores: BulkImportMatriculaResult['errores'] = [];

    for (let i = 0; i < estudiantes.length; i++) {
      const row = estudiantes[i];
      const fila = row.fila ?? i + 2;
      try {
        const gradoNum = row.grado.replace(/°/g, '').trim();
        const gradoLabel = `${gradoNum}° ${row.nivel}`;
        const email =
          row.email?.trim().toLowerCase() ||
          `alumno.${row.dni.trim()}@estudiante.pe`;

        const apoderado = row.apoderadoNombres?.trim()
          ? {
              nombres: row.apoderadoNombres.trim(),
              apellidos: row.apoderadoApellidos?.trim() ?? '',
              dni: row.apoderadoDni?.trim() ?? '',
              telefono: row.apoderadoTelefono?.trim() ?? '',
              email: row.apoderadoEmail?.trim() ?? '',
            }
          : undefined;

        const saved = await this.createExpediente({
          nombres: row.nombres.trim(),
          apellidos: row.apellidos.trim(),
          dni: row.dni.trim(),
          email,
          sexo: row.sexo ?? 'M',
          fechaNac: parseFechaNacInput(row.fechaNac) ?? undefined,
          gradoLabel,
          seccion: row.seccion.trim().toUpperCase(),
          anioIngreso:
            row.anioIngreso?.trim() || String(new Date().getFullYear()),
          estado: 'activo',
          apoderado,
        });
        creados.push(saved);
      } catch (err: unknown) {
        errores.push({
          fila,
          dni: row.dni,
          email: row.email ?? '',
          mensaje: this.extractBulkMatriculaError(err),
        });
      }
    }

    return {
      total: estudiantes.length + erroresValidacion.length,
      creados: creados.length,
      omitidos: erroresValidacion.length,
      errores,
      erroresValidacion,
      estudiantes: creados,
    };
  }

  async bulkCreateFromFile(
    buffer: Buffer,
    originalname: string,
  ): Promise<BulkImportMatriculaResult> {
    const parsed = parseMatriculaFile(buffer, originalname);
    if (!parsed.validas.length) {
      return {
        total: parsed.filas.length,
        creados: 0,
        omitidos: parsed.erroresValidacion.length,
        errores: [],
        erroresValidacion: parsed.erroresValidacion,
        estudiantes: [],
      };
    }
    return this.bulkCreateMatriculas(parsed.validas, parsed.erroresValidacion);
  }

  async previewBulkFromFile(
    buffer: Buffer,
    originalname: string,
  ): Promise<BulkMatriculaPreviewResult> {
    const parsed = parseMatriculaFile(buffer, originalname);
    return this.previewBulkMatriculas(parsed.filas);
  }

  async previewBulkMatriculas(
    filas: FilaParseadaMatricula[],
  ): Promise<BulkMatriculaPreviewResult> {
    const bloqueados: BulkMatriculaPreviewItem[] = [];
    const candidatos: FilaParseadaMatricula[] = [];

    for (const row of filas) {
      if (!row.valido) {
        bloqueados.push(
          this.toPreviewItem(row, row.errores.join('; ') || 'Datos invalidos'),
        );
        continue;
      }
      candidatos.push(row);
    }

    const dnis = [...new Set(candidatos.map((r) => r.dni.trim()))];
    const emails = [
      ...new Set(candidatos.map((r) => this.resolveBulkEmail(r))),
    ];

    const existingByDni = dnis.length
      ? await this.studentsRepository.find({ where: { dni: In(dnis) } })
      : [];
    const existingByEmail = emails.length
      ? await this.studentsRepository.find({ where: { email: In(emails) } })
      : [];

    const dniSet = new Set(existingByDni.map((s) => s.dni.trim()));
    const emailSet = new Set(
      existingByEmail.map((s) => s.email.trim().toLowerCase()),
    );

    const listos: BulkMatriculaPreviewItem[] = [];

    for (const row of candidatos) {
      const email = this.resolveBulkEmail(row);
      const motivos: string[] = [];
      if (dniSet.has(row.dni.trim())) {
        motivos.push('Ya existe un estudiante con ese DNI');
      }
      if (emailSet.has(email.toLowerCase())) {
        motivos.push('Ya existe un estudiante con ese correo electronico');
      }
      if (motivos.length) {
        bloqueados.push(this.toPreviewItem(row, motivos.join('; ')));
      } else {
        listos.push(this.toPreviewItem(row));
      }
    }

    bloqueados.sort((a, b) => a.fila - b.fila);
    listos.sort((a, b) => a.fila - b.fila);

    return {
      total: filas.length,
      listosCount: listos.length,
      bloqueadosCount: bloqueados.length,
      listos,
      bloqueados,
    };
  }

  private resolveBulkEmail(row: BulkMatriculaRowDto): string {
    return (
      row.email?.trim().toLowerCase() ||
      `alumno.${row.dni.trim()}@estudiante.pe`
    );
  }

  private toPreviewItem(
    row: FilaParseadaMatricula,
    motivo?: string,
  ): BulkMatriculaPreviewItem {
    const gradoNum = row.grado.replace(/°/g, '').trim();
    return {
      fila: row.fila,
      nombres: row.nombres.trim(),
      apellidos: row.apellidos.trim(),
      dni: row.dni.trim(),
      email: this.resolveBulkEmail(row),
      sexo: row.sexo,
      fechaNac: row.fechaNac,
      nivel: row.nivel,
      grado: row.grado,
      seccion: row.seccion.trim().toUpperCase(),
      anioIngreso: row.anioIngreso,
      apoderadoNombres: row.apoderadoNombres,
      apoderadoApellidos: row.apoderadoApellidos,
      apoderadoDni: row.apoderadoDni,
      apoderadoTelefono: row.apoderadoTelefono,
      apoderadoEmail: row.apoderadoEmail,
      gradoLabel: `${gradoNum}° ${row.nivel}`,
      motivo,
    };
  }

  private extractBulkMatriculaError(err: unknown): string {
    if (err && typeof err === 'object' && 'response' in err) {
      const response = (err as { response?: { message?: string | string[] } })
        .response;
      const msg = response?.message;
      if (Array.isArray(msg)) return msg.join('; ');
      if (typeof msg === 'string') return msg;
    }
    if (err instanceof BadRequestException) {
      const res = err.getResponse();
      if (typeof res === 'string') return res;
      if (res && typeof res === 'object' && 'message' in res) {
        const msg = (res as { message: string | string[] }).message;
        return Array.isArray(msg) ? msg.join('; ') : msg;
      }
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return 'No se pudo registrar la matricula';
  }

  async findAllExpedientes(search?: string): Promise<ExpedienteResponse[]> {
    const students = await this.studentsRepository.find({
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
    const query = search?.trim().toLowerCase();
    const filtered = query
      ? students.filter((s) => {
          const gradoLabel = gradoLabelFromParts(s.nivel, s.grado);
          const haystack = [
            s.nombre,
            s.apellido,
            s.dni,
            s.codigo,
            s.email,
            gradoLabel,
            `${s.apellido} ${s.nombre}`,
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(query);
        })
      : students;
    return Promise.all(filtered.map((s) => this.buildExpediente(s)));
  }

  getRequisitosDocumentos(gradoLabel: string) {
    return requisitosPorGrado(gradoLabel);
  }

  async syncRequisitosMatricula(studentId: number): Promise<ExpedienteResponse> {
    const student = await this.getOrFail(studentId);
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

    return this.findExpediente(studentId);
  }

  findAll() {
    return this.studentsRepository.find({
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.getOrFail(id);
  }

  async findExpediente(id: number): Promise<ExpedienteResponse> {
    const student = await this.getOrFail(id);
    return this.buildExpediente(student);
  }

  async update(id: number, updateStudentDto: UpdateStudentDto) {
    const current = await this.getOrFail(id);
    const merged = this.studentsRepository.merge(current, updateStudentDto);
    return this.studentsRepository.save(merged);
  }

  async updateExpediente(
    id: number,
    dto: UpdateExpedienteDto,
  ): Promise<ExpedienteResponse> {
    const current = await this.getOrFail(id);

    if (dto.nombres !== undefined) current.nombre = dto.nombres.trim();
    if (dto.apellidos !== undefined) current.apellido = dto.apellidos.trim();
    if (dto.email !== undefined) current.email = dto.email.trim();
    if (dto.codigo !== undefined) current.codigo = dto.codigo.trim();
    if (dto.dni !== undefined) current.dni = dto.dni.trim();
    if (dto.fechaNac !== undefined) {
      current.fechaNac = dto.fechaNac.trim() || null;
    }
    if (dto.sexo !== undefined) current.sexo = dto.sexo;
    if (dto.direccion !== undefined) current.direccion = dto.direccion.trim();
    if (dto.foto !== undefined) current.foto = dto.foto.trim();
    if (dto.grupoSanguineo !== undefined) {
      current.grupoSanguineo = dto.grupoSanguineo.trim();
    }
    if (dto.alergias !== undefined) current.alergias = dto.alergias.trim();
    if (dto.condicionesSalud !== undefined) {
      current.condicionesSalud = dto.condicionesSalud.trim();
    }
    if (dto.observaciones !== undefined) {
      current.observaciones = dto.observaciones.trim();
    }
    if (dto.gradoLabel !== undefined) {
      const { nivel, grado } = splitGradoLabel(dto.gradoLabel);
      current.nivel = nivel;
      current.grado = grado;
    }
    if (dto.seccion !== undefined) {
      current.seccion = dto.seccion.trim().toUpperCase();
    }
    if (dto.anioIngreso !== undefined) {
      current.anioIngreso = dto.anioIngreso.trim();
    }
    if (dto.estado !== undefined) {
      current.estadoMatricula = dto.estado;
      current.activo = dto.estado === 'activo';
    }
    if (dto.conductaNota !== undefined) {
      current.conductaNota = dto.conductaNota.trim();
    }
    if (dto.padre !== undefined) {
      current.padre = normalizeRepresentante(dto.padre);
    }
    if (dto.madre !== undefined) {
      current.madre = normalizeRepresentante(dto.madre);
    }
    if (dto.apoderado !== undefined) {
      current.apoderado = normalizeRepresentante(dto.apoderado);
    }

    await this.studentsRepository.save(current);

    if (dto.historialAcademico !== undefined) {
      await this.replaceHistorial(id, dto.historialAcademico);
    }
    if (dto.documentos !== undefined) {
      await this.replaceDocumentos(id, dto.documentos);
    }

    return this.findExpediente(id);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.documentRepo.delete({ studentId: id });
    await this.historyRepo.delete({ studentId: id });
    await this.studentsRepository.remove(current);
    return { deleted: true, id };
  }

  async addDocument(studentId: number, dto: UpsertDocumentoDto) {
    await this.getOrFail(studentId);
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
    await this.getOrFail(studentId);
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
    await this.getOrFail(studentId);
    const doc = await this.documentRepo.findOneBy({ id: docId, studentId });
    if (!doc) {
      throw new NotFoundException(`Documento ${docId} no encontrado`);
    }
    await this.documentRepo.remove(doc);
    return { deleted: true, id: docId };
  }

  async getSectionOccupancy(nivel: string, grado: string, anioEscolar?: number) {
    return this.classroomsService.getSectionOccupancy(nivel, grado, anioEscolar);
  }

  async findSectionChanges(nivel?: string, grado?: string) {
    const qb = this.sectionChangeRepo
      .createQueryBuilder('change')
      .orderBy('change.createdAt', 'DESC');

    if (nivel) qb.andWhere('change.nivel = :nivel', { nivel });
    if (grado) qb.andWhere('change.grado = :grado', { grado });

    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      estudiante: row.estudiante,
      nivel: row.nivel,
      grado: row.grado,
      seccionAnterior: row.seccionAnterior,
      seccionNueva: row.seccionNueva,
      motivo: row.motivo,
      observacion: row.observacion,
      realizadoPor: row.realizadoPor,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async changeSection(id: number, dto: ChangeSectionDto) {
    const student = await this.getOrFail(id);
    const nuevaSeccion = dto.nuevaSeccion.trim().toUpperCase();

    if (student.seccion.toUpperCase() === nuevaSeccion) {
      throw new BadRequestException('El estudiante ya pertenece a esa seccion');
    }

    const seccionAnterior = student.seccion;
    student.seccion = nuevaSeccion;
    await this.studentsRepository.save(student);

    await this.scheduleRepo.update(
      { studentId: student.id },
      { seccion: nuevaSeccion },
    );

    await this.sectionChangeRepo.save(
      this.sectionChangeRepo.create({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        nivel: student.nivel,
        grado: student.grado,
        seccionAnterior,
        seccionNueva: nuevaSeccion,
        motivo: dto.motivo?.trim() ?? '',
        observacion: dto.observacion?.trim() ?? '',
        realizadoPor: dto.realizadoPor?.trim() || 'Sistema',
      }),
    );

    return this.findExpediente(id);
  }

  private async buildExpediente(student: Student): Promise<ExpedienteResponse> {
    const [historial, documentos, asistenciaPct] = await Promise.all([
      this.historyRepo.find({
        where: { studentId: student.id },
        order: { anio: 'DESC' },
      }),
      this.documentRepo.find({
        where: { studentId: student.id },
        order: { id: 'ASC' },
      }),
      this.computeAsistenciaPct(student.id),
    ]);

    return toExpedienteResponse(student, {
      historial,
      documentos,
      asistenciaPct,
    });
  }

  private async computeAsistenciaPct(studentId: number): Promise<number> {
    const records = await this.attendanceRepo.find({ where: { studentId } });
    if (!records.length) return 0;
    const presentes = records.filter((r) => r.estado === 'P' || r.estado === 'T').length;
    return Math.round((presentes / records.length) * 100);
  }

  private async replaceHistorial(
    studentId: number,
    rows: Array<{
      anio: string;
      grado: string;
      seccion: string;
      promedio: number;
      estado: string;
    }>,
  ) {
    await this.historyRepo.delete({ studentId });
    if (!rows.length) return;
    await this.historyRepo.save(
      rows.map((row) =>
        this.historyRepo.create({
          studentId,
          anio: row.anio.trim(),
          grado: row.grado.trim(),
          seccion: row.seccion.trim(),
          promedio: row.promedio,
          estado: row.estado.trim(),
        }),
      ),
    );
  }

  private async replaceDocumentos(
    studentId: number,
    rows: Array<{
      id?: number;
      tipo: string;
      numero?: string;
      estado?: 'entregado' | 'pendiente' | 'vencido';
      fechaEntrega?: string;
      imagenUrl?: string;
    }>,
  ) {
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

  private async getOrFail(id: number): Promise<Student> {
    const student = await this.studentsRepository.findOneBy({ id });
    if (!student) throw new NotFoundException(`Student ${id} no encontrado`);
    return student;
  }
}
