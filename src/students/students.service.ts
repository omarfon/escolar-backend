import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Attendance } from '../attendances/entities/attendance.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import {
  HistorialAcademicoDetalle,
  HistorialAcademicoListItem,
  HistorialAsistenciaResumen,
  HistorialNotaItem,
  HistorialTrayectoriaItem,
} from './dto/historial-academico.dto';
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
  EstadoCambioSeccion,
  Student,
} from './entities/student.entity';
import {
  buildCodigo,
  ExpedienteResponse,
  gradoLabelFromParts,
  mapSectionChangeCandidate,
  normalizeRepresentante,
  parseFechaNacInput,
  resolveApellidos,
  SectionChangeCandidateResponse,
  splitGradoLabel,
  toExpedienteResponse,
} from './students.mapper';
import { StudentMeProfile } from './dto/student-me.dto';
import { StudentContactosResponse } from './dto/student-contactos.dto';
import {
  StudentGradeItemResponse,
  StudentGradesResponse,
} from './dto/student-grades.dto';
import { listStudentsForAula } from './students-dedupe.util';
import { StudentsStatsDto } from './dto/students-stats.dto';
import { HorarioBlock } from '../horarios/entities/horario-block.entity';
import {
  abrevDocente,
  Docente,
} from '../maestros/docentes/entities/docente.entity';
import { CurriculumArea } from '../curricula/entities/curriculum-area.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { User } from '../users/entities/user.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import {
  requisitosPorGrado,
  tiposEquivalentes,
  combinarRequisitosConDocumentos,
} from './document-requirements.constants';
import { StudentDocumentsResponse } from './dto/student-documents.dto';
import {
  BulkImportMatriculaResult,
  BulkMatriculaPreviewItem,
  BulkMatriculaPreviewResult,
  BulkMatriculaRowDto,
} from './dto/bulk-import-students.dto';
import { parseMatriculaFile, FilaParseadaMatricula } from './bulk-matricula.parser';
import {
  BulkHistorialPreviewItem,
  BulkHistorialPreviewResult,
  BulkHistorialRowDto,
  BulkImportHistorialResult,
} from './dto/bulk-import-historial.dto';
import {
  FilaParseadaHistorial,
  parseHistorialFile,
} from './bulk-historial.parser';
import { SalonesService } from '../maestros/salones/salones.service';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';

@Injectable()
export class StudentsService implements OnModuleInit {
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
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(HorarioBlock)
    private readonly horarioBlockRepo: Repository<HorarioBlock>,
    @InjectRepository(Docente)
    private readonly docenteRepo: Repository<Docente>,
    @InjectRepository(CurriculumArea)
    private readonly curriculumAreaRepo: Repository<CurriculumArea>,
    @InjectRepository(CurriculumSubject)
    private readonly curriculumSubjectRepo: Repository<CurriculumSubject>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly salonesService: SalonesService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.syncEstadosCambioSeccionDesdeHistorial();
  }

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
    await this.assertDocumentoMatriculaDisponible(dto.dni, dto.tipoDocumento);

    const email = dto.email.trim().toLowerCase();
    const existingEmail = await this.studentsRepository.findOneBy({ email });
    if (existingEmail) {
      if (this.esConflictoDocumentoPorEmail(email, dto.dni, existingEmail.dni)) {
        throw new BadRequestException('Ya existe un estudiante con ese número de documento');
      }
      throw new BadRequestException('Ya existe un estudiante con ese correo electrónico');
    }

    const { nivel, grado } = splitGradoLabel(dto.gradoLabel);
    const estado = dto.estado ?? 'activo';
    const apellidos = resolveApellidos(dto);
    const entity = this.studentsRepository.create({
      nombre: dto.nombres.trim(),
      apellido: apellidos.apellido,
      apellidoPaterno: apellidos.apellidoPaterno,
      apellidoMaterno: apellidos.apellidoMaterno,
      email,
      nivel,
      grado,
      seccion: dto.seccion.trim().toUpperCase(),
      activo: estado === 'activo',
      codigo: dto.codigo?.trim() ?? '',
      dni: dto.dni?.trim() ?? '',
      tipoDocumento: dto.tipoDocumento?.trim() || 'DNI',
      fechaNac: parseFechaNacInput(dto.fechaNac),
      sexo: dto.sexo ?? 'M',
      direccion: dto.direccion?.trim() ?? '',
      distrito: dto.distrito?.trim() ?? '',
      provincia: dto.provincia?.trim() ?? '',
      departamento: dto.departamento?.trim() ?? '',
      telefonoEmergencia: dto.telefonoEmergencia?.trim() ?? '',
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

        const apellidos = resolveApellidos({
          apellidos: row.apellidos,
          apellidoPaterno: row.apellidoPaterno,
          apellidoMaterno: row.apellidoMaterno,
        });

        const apoderado = row.apoderadoNombres?.trim()
          ? normalizeRepresentante({
              nombres: row.apoderadoNombres.trim(),
              apellidos: row.apoderadoApellidos?.trim(),
              apellidoPaterno: row.apoderadoApellidoPaterno?.trim(),
              apellidoMaterno: row.apoderadoApellidoMaterno?.trim(),
              tipoDocumento: row.apoderadoTipoDocumento?.trim() || 'DNI',
              dni: row.apoderadoDni?.trim() ?? '',
              telefono: row.apoderadoTelefono?.trim() ?? '',
              email: row.apoderadoEmail?.trim() ?? '',
            })
          : undefined;

        const parentesco = row.apoderadoParentesco;
        const padre =
          parentesco === 'padre' && apoderado ? apoderado : undefined;
        const madre =
          parentesco === 'madre' && apoderado ? apoderado : undefined;

        const saved = await this.createExpediente({
          nombres: row.nombres.trim(),
          apellidos: apellidos.apellido,
          apellidoPaterno: apellidos.apellidoPaterno,
          apellidoMaterno: apellidos.apellidoMaterno,
          tipoDocumento: row.tipoDocumento?.trim() || 'DNI',
          dni: row.dni.trim(),
          email,
          sexo: row.sexo ?? 'M',
          fechaNac: parseFechaNacInput(row.fechaNac) ?? undefined,
          direccion: row.direccion.trim(),
          distrito: row.distrito?.trim(),
          provincia: row.provincia?.trim(),
          departamento: row.departamento?.trim(),
          telefonoEmergencia: row.telefonoEmergencia?.trim(),
          gradoLabel,
          seccion: row.seccion.trim().toUpperCase(),
          anioIngreso:
            row.anioIngreso?.trim() || String(new Date().getFullYear()),
          estado: 'activo',
          padre,
          madre,
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
      const docDuplicado = dniSet.has(row.dni.trim());
      const emailDuplicado = emailSet.has(email.toLowerCase());
      if (
        docDuplicado ||
        (emailDuplicado && this.esConflictoDocumentoPorEmail(email, row.dni))
      ) {
        motivos.push('Ya existe un estudiante con ese DNI');
      } else if (emailDuplicado) {
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

  async bulkImportHistorial(
    filas: BulkHistorialRowDto[],
    erroresValidacion: BulkImportHistorialResult['erroresValidacion'] = [],
  ): Promise<BulkImportHistorialResult> {
    const errores: BulkImportHistorialResult['errores'] = [];
    const importados: BulkImportHistorialResult['filas'] = [];
    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;

    for (let i = 0; i < filas.length; i++) {
      const row = filas[i];
      const fila = row.fila ?? i + 2;
      try {
        const student = await this.findStudentForHistorialRow(row);
        if (!student) {
          errores.push({
            fila,
            dni: row.dni ?? '',
            email: row.email ?? '',
            mensaje: 'Estudiante no encontrado',
          });
          continue;
        }

        const mismatch = this.historialAlumnoNoCoincide(row, student);
        if (mismatch) {
          errores.push({
            fila,
            dni: row.dni ?? '',
            email: row.email ?? '',
            mensaje: mismatch,
          });
          continue;
        }

        const anio = row.anio.trim();
        const payload = {
          studentId: student.id,
          anio,
          grado: row.grado.trim(),
          seccion: row.seccion.trim().toUpperCase(),
          promedio: row.promedio,
          estado: row.estado?.trim() || 'Promovido',
        };

        const existing = await this.historyRepo.findOne({
          where: { studentId: student.id, anio },
        });

        if (existing) {
          if (this.historialCoincide(existing, row)) {
            sinCambios++;
            importados.push(
              this.buildHistorialImportRow(student, row, payload, 'sin_cambios'),
            );
            continue;
          }
          existing.grado = payload.grado;
          existing.seccion = payload.seccion;
          existing.promedio = payload.promedio;
          existing.estado = payload.estado;
          await this.historyRepo.save(existing);
          actualizados++;
          importados.push(
            this.buildHistorialImportRow(student, row, payload, 'actualizado'),
          );
        } else {
          await this.historyRepo.save(this.historyRepo.create(payload));
          creados++;
          importados.push(
            this.buildHistorialImportRow(student, row, payload, 'creado'),
          );
        }
      } catch (err: unknown) {
        errores.push({
          fila,
          dni: row.dni ?? '',
          email: row.email ?? '',
          mensaje: this.extractBulkMatriculaError(err),
        });
      }
    }

    return {
      total: filas.length + erroresValidacion.length,
      importados: creados + actualizados,
      creados,
      actualizados,
      sinCambios,
      omitidos: erroresValidacion.length,
      errores,
      erroresValidacion,
      filas: importados,
    };
  }

  async bulkImportHistorialFromFile(
    buffer: Buffer,
    originalname: string,
  ): Promise<BulkImportHistorialResult> {
    const parsed = parseHistorialFile(buffer, originalname);
    if (!parsed.validas.length) {
      return {
        total: parsed.filas.length,
        importados: 0,
        creados: 0,
        actualizados: 0,
        sinCambios: 0,
        omitidos: parsed.erroresValidacion.length,
        errores: [],
        erroresValidacion: parsed.erroresValidacion,
        filas: [],
      };
    }
    return this.bulkImportHistorial(parsed.validas, parsed.erroresValidacion);
  }

  async previewBulkHistorialFromFile(
    buffer: Buffer,
    originalname: string,
  ): Promise<BulkHistorialPreviewResult> {
    const parsed = parseHistorialFile(buffer, originalname);
    return this.previewBulkHistorialFilas(parsed.filas);
  }

  async previewBulkHistorialFilas(
    filas: FilaParseadaHistorial[],
  ): Promise<BulkHistorialPreviewResult> {
    const bloqueados: BulkHistorialPreviewItem[] = [];
    const candidatos: FilaParseadaHistorial[] = [];

    for (const row of filas) {
      if (!row.valido) {
        bloqueados.push(
          this.toHistorialPreviewItem(row, row.errores.join('; ') || 'Datos invalidos'),
        );
        continue;
      }
      candidatos.push(row);
    }

    const listos: BulkHistorialPreviewItem[] = [];
    const seenInFile = new Map<string, number>();
    const resolved: Array<{ row: FilaParseadaHistorial; student: Student }> = [];

    for (const row of candidatos) {
      const student = await this.findStudentForHistorialRow(row);
      if (!student) {
        bloqueados.push(
          this.toHistorialPreviewItem(row, 'Estudiante no encontrado en el sistema'),
        );
        continue;
      }
      const mismatch = this.historialAlumnoNoCoincide(row, student);
      if (mismatch) {
        bloqueados.push(this.toHistorialPreviewItem(row, mismatch, student));
        continue;
      }

      const fileKey = `${student.id}:${row.anio.trim()}`;
      const filaDuplicada = seenInFile.get(fileKey);
      if (filaDuplicada !== undefined) {
        bloqueados.push(
          this.toHistorialPreviewItem(
            row,
            `Registro duplicado en el archivo (mismo alumno y anio que fila ${filaDuplicada})`,
            student,
          ),
        );
        continue;
      }
      seenInFile.set(fileKey, row.fila);
      resolved.push({ row, student });
    }

    const existingRows = resolved.length
      ? await this.historyRepo.find({
          where: resolved.map(({ row, student }) => ({
            studentId: student.id,
            anio: row.anio.trim(),
          })),
        })
      : [];
    const historyMap = new Map(
      existingRows.map((h) => [`${h.studentId}:${h.anio}`, h]),
    );

    for (const { row, student } of resolved) {
      const existing = historyMap.get(`${student.id}:${row.anio.trim()}`) ?? null;
      listos.push(this.toHistorialPreviewItem(row, undefined, student, existing));
    }

    bloqueados.sort((a, b) => a.fila - b.fila);
    listos.sort((a, b) => a.fila - b.fila);

    const nuevosCount = listos.filter((r) => r.accionPrevista === 'creado').length;
    const actualizadosCount = listos.filter(
      (r) => r.accionPrevista === 'actualizado',
    ).length;
    const sinCambiosCount = listos.filter(
      (r) => r.accionPrevista === 'sin_cambios',
    ).length;

    return {
      total: filas.length,
      listosCount: listos.length,
      bloqueadosCount: bloqueados.length,
      nuevosCount,
      actualizadosCount,
      sinCambiosCount,
      listos,
      bloqueados,
    };
  }

  private historialCoincide(
    existing: StudentAcademicHistory,
    row: Pick<BulkHistorialRowDto, 'grado' | 'seccion' | 'promedio' | 'estado'>,
  ): boolean {
    const estado = row.estado?.trim() || 'Promovido';
    return (
      existing.grado.trim() === row.grado.trim() &&
      existing.seccion.trim().toUpperCase() === row.seccion.trim().toUpperCase() &&
      Math.abs(existing.promedio - row.promedio) < 0.01 &&
      existing.estado.trim() === estado
    );
  }

  private resolveHistorialAccion(
    existing: StudentAcademicHistory | null,
    row: FilaParseadaHistorial,
  ): {
    yaRegistrado: boolean;
    accionPrevista: 'creado' | 'actualizado' | 'sin_cambios';
    registroAnterior?: {
      grado: string;
      seccion: string;
      promedio: number;
      estado: string;
    };
  } {
    if (!existing) {
      return { yaRegistrado: false, accionPrevista: 'creado' };
    }
    const registroAnterior = {
      grado: existing.grado,
      seccion: existing.seccion,
      promedio: existing.promedio,
      estado: existing.estado,
    };
    if (this.historialCoincide(existing, row)) {
      return {
        yaRegistrado: true,
        accionPrevista: 'sin_cambios',
        registroAnterior,
      };
    }
    return {
      yaRegistrado: true,
      accionPrevista: 'actualizado',
      registroAnterior,
    };
  }

  private async findStudentForHistorialRow(
    row: Pick<
      BulkHistorialRowDto,
      'dni' | 'codigo' | 'email' | 'nombres' | 'apellidos' | 'apellidoPaterno' | 'apellidoMaterno'
    >,
  ): Promise<Student | null> {
    const dni = row.dni?.trim();
    if (dni) {
      const byDni = await this.studentsRepository.findOne({ where: { dni } });
      if (byDni) return byDni;
    }

    const codigo = row.codigo?.trim();
    if (codigo) {
      const byCodigo = await this.studentsRepository.findOne({ where: { codigo } });
      if (byCodigo) return byCodigo;
    }

    const email = row.email?.trim().toLowerCase();
    if (email) {
      const byEmail = await this.studentsRepository.findOne({ where: { email } });
      if (byEmail) return byEmail;
    }

    const nombres = row.nombres?.trim();
    const apellidos =
      row.apellidos?.trim() ||
      [row.apellidoPaterno?.trim(), row.apellidoMaterno?.trim()]
        .filter(Boolean)
        .join(' ');
    if (nombres && apellidos) {
      const byNombre = await this.studentsRepository.findOne({
        where: { nombre: nombres, apellido: apellidos },
      });
      if (byNombre) return byNombre;
    }

    return null;
  }

  private historialAlumnoNoCoincide(
    row: Pick<
      BulkHistorialRowDto,
      'dni' | 'nombres' | 'apellidos' | 'apellidoPaterno' | 'apellidoMaterno'
    >,
    student: Student,
  ): string | null {
    const norm = (v: string) =>
      v
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const fileDni = row.dni?.trim();
    if (fileDni && student.dni?.trim() && fileDni !== student.dni.trim()) {
      return `DNI no coincide con el alumno registrado (${student.dni})`;
    }

    const fileNombres = row.nombres?.trim();
    if (fileNombres && norm(fileNombres) !== norm(student.nombre)) {
      return `Nombres no coinciden con el alumno registrado (${student.nombre})`;
    }

    const fileApellidos =
      row.apellidos?.trim() ||
      [row.apellidoPaterno?.trim(), row.apellidoMaterno?.trim()]
        .filter(Boolean)
        .join(' ');
    if (fileApellidos && norm(fileApellidos) !== norm(student.apellido)) {
      return `Apellidos no coinciden con el alumno registrado (${student.apellido})`;
    }

    return null;
  }

  private buildHistorialImportRow(
    student: Student,
    _row: BulkHistorialRowDto,
    payload: {
      anio: string;
      grado: string;
      seccion: string;
      promedio: number;
      estado: string;
    },
    accion: 'creado' | 'actualizado' | 'sin_cambios',
  ): BulkImportHistorialResult['filas'][number] {
    return {
      studentId: student.id,
      codigo: student.codigo,
      nombres: student.nombre,
      apellidos: student.apellido,
      apellidoPaterno: student.apellidoPaterno,
      apellidoMaterno: student.apellidoMaterno,
      dni: student.dni,
      email: student.email,
      nivel: student.nivel,
      anio: payload.anio,
      grado: payload.grado,
      seccion: payload.seccion,
      promedio: payload.promedio,
      estado: payload.estado,
      accion,
    };
  }

  private toHistorialPreviewItem(
    row: FilaParseadaHistorial,
    motivo?: string,
    student?: Student | null,
    existing?: StudentAcademicHistory | null,
  ): BulkHistorialPreviewItem {
    const apellidos =
      row.apellidos?.trim() ||
      [row.apellidoPaterno?.trim(), row.apellidoMaterno?.trim()]
        .filter(Boolean)
        .join(' ') ||
      student?.apellido ||
      '';

    const accion = this.resolveHistorialAccion(existing ?? null, row);

    return {
      fila: row.fila,
      nombres: row.nombres?.trim() || student?.nombre || '',
      apellidos,
      apellidoPaterno: row.apellidoPaterno?.trim() || student?.apellidoPaterno || '',
      apellidoMaterno: row.apellidoMaterno?.trim() || student?.apellidoMaterno || '',
      dni: row.dni?.trim() || student?.dni || '',
      codigo: row.codigo?.trim() || student?.codigo || '',
      email: row.email?.trim() || student?.email || '',
      nivel: row.nivel?.trim() || student?.nivel || '',
      anio: row.anio,
      grado: row.grado,
      seccion: row.seccion,
      promedio: row.promedio,
      estado: row.estado ?? 'Promovido',
      yaRegistrado: accion.yaRegistrado,
      accionPrevista: accion.accionPrevista,
      registroAnterior: accion.registroAnterior,
      motivo,
    };
  }

  private emailInstitucionalPorDocumento(numero: string): string {
    return `alumno.${numero.trim()}@estudiante.pe`.toLowerCase();
  }

  private esConflictoDocumentoPorEmail(
    email: string,
    numero?: string,
    numeroExistente?: string,
  ): boolean {
    const docNum = numero?.trim();
    if (!docNum) return false;
    const emailNormalizado = email.trim().toLowerCase();
    if (emailNormalizado === this.emailInstitucionalPorDocumento(docNum)) {
      return true;
    }
    return numeroExistente?.trim() === docNum;
  }

  private async assertDocumentoMatriculaDisponible(
    numero?: string,
    tipoDocumento?: string,
  ): Promise<void> {
    const docNum = numero?.trim();
    if (!docNum) return;

    const tipo = tipoDocumento?.trim() || 'DNI';
    const existing = await this.studentsRepository.findOne({
      where: { dni: docNum, tipoDocumento: tipo },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un estudiante con ese número de documento');
    }
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
    const apellidos = resolveApellidos({
      apellidos: row.apellidos,
      apellidoPaterno: row.apellidoPaterno,
      apellidoMaterno: row.apellidoMaterno,
    });
    return {
      fila: row.fila,
      nombres: row.nombres.trim(),
      apellidos: apellidos.apellido,
      apellidoPaterno: apellidos.apellidoPaterno,
      apellidoMaterno: apellidos.apellidoMaterno,
      tipoDocumento: row.tipoDocumento,
      dni: row.dni.trim(),
      email: this.resolveBulkEmail(row),
      sexo: row.sexo,
      fechaNac: row.fechaNac,
      direccion: row.direccion?.trim() ?? '',
      distrito: row.distrito,
      provincia: row.provincia,
      departamento: row.departamento,
      telefonoEmergencia: row.telefonoEmergencia,
      nivel: row.nivel,
      grado: row.grado,
      seccion: row.seccion.trim().toUpperCase(),
      anioIngreso: row.anioIngreso,
      apoderadoNombres: row.apoderadoNombres,
      apoderadoApellidos: row.apoderadoApellidos,
      apoderadoApellidoPaterno: row.apoderadoApellidoPaterno,
      apoderadoApellidoMaterno: row.apoderadoApellidoMaterno,
      apoderadoTipoDocumento: row.apoderadoTipoDocumento,
      apoderadoDni: row.apoderadoDni,
      apoderadoTelefono: row.apoderadoTelefono,
      apoderadoEmail: row.apoderadoEmail,
      apoderadoParentesco: row.apoderadoParentesco,
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
    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];
    const filtered = tokens.length
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
            `${s.nombre} ${s.apellido}`,
          ]
            .join(' ')
            .toLowerCase();
          return tokens.every((t) => haystack.includes(t));
        })
      : students;
    return Promise.all(filtered.map((s) => this.buildExpediente(s)));
  }

  async getStudentsStats(): Promise<StudentsStatsDto> {
    const [
      total,
      activos,
      inactivos,
      retirados,
      matriculadosActivos,
      mujeres,
      varones,
    ] = await Promise.all([
      this.studentsRepository.count(),
      this.studentsRepository.count({ where: { estadoMatricula: 'activo' } }),
      this.studentsRepository.count({ where: { estadoMatricula: 'inactivo' } }),
      this.studentsRepository.count({ where: { estadoMatricula: 'retirado' } }),
      this.studentsRepository.count({
        where: { activo: true, estadoMatricula: 'activo' },
      }),
      this.studentsRepository.count({ where: { sexo: 'F' } }),
      this.studentsRepository.count({ where: { sexo: 'M' } }),
    ]);

    return {
      total,
      activos,
      inactivos,
      retirados,
      matriculadosActivos,
      mujeres,
      varones,
    };
  }

  async exportExpedientesCsv(filters?: {
    q?: string;
    grado?: string;
    estado?: string;
  }): Promise<string> {
    let items = await this.findAllExpedientes(filters?.q);
    if (filters?.grado?.trim()) {
      const grado = filters.grado.trim();
      items = items.filter(
        (i) => i.gradoLabel === grado || i.grado === grado,
      );
    }
    if (filters?.estado?.trim()) {
      items = items.filter((i) => i.estado === filters.estado!.trim());
    }
    return this.buildExpedientesCsv(items);
  }

  private buildExpedientesCsv(items: ExpedienteResponse[]): string {
    const sep = ';';
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? '');
      return s.includes(sep) || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const header = [
      'Codigo',
      'Apellidos',
      'Nombres',
      'DNI',
      'Email',
      'Sexo',
      'Fecha nacimiento',
      'Direccion',
      'Grado',
      'Seccion',
      'Estado',
      'Anio ingreso',
      'Apoderado',
      'DNI apoderado',
      'Telefono apoderado',
      'Email apoderado',
      '% Asistencia',
      'Conducta',
    ];

    const rows = items.map((e) =>
      [
        e.codigo,
        e.apellidos,
        e.nombres,
        e.dni,
        e.email,
        e.sexo,
        e.fechaNac,
        e.direccion,
        e.gradoLabel,
        e.seccion,
        e.estado,
        e.anioIngreso,
        `${e.apoderado.nombres} ${e.apoderado.apellidos}`.trim(),
        e.apoderado.dni,
        e.apoderado.telefono,
        e.apoderado.email,
        e.asistenciaPct,
        e.conductaNota,
      ]
        .map(esc)
        .join(sep),
    );

    return [header.map(esc).join(sep), ...rows].join('\n');
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

  async findMeByLogin(login: string): Promise<StudentMeProfile> {
    const email = login.trim().toLowerCase();
    const student = await this.studentsRepository.findOneBy({ email });
    if (!student) {
      throw new NotFoundException(
        'No se encontró el registro académico del estudiante',
      );
    }
    const grado = student.grado;
    return {
      id: student.id,
      nombres: student.nombre,
      apellidos: student.apellido,
      email: student.email,
      dni: student.dni ?? '',
      nivel: student.nivel,
      grado,
      gradoLabel: gradoLabelFromParts(student.nivel, grado),
      seccion: student.seccion,
      aulaLabel: `${student.nivel} ${grado} · Sección ${student.seccion}`,
      activo: student.activo,
    };
  }

  async findMeProfileByLogin(login: string): Promise<ExpedienteResponse> {
    const email = login.trim().toLowerCase();
    const student = await this.studentsRepository.findOneBy({ email });
    if (!student) {
      throw new NotFoundException(
        'No se encontró el registro académico del estudiante',
      );
    }
    return this.findExpediente(student.id);
  }

  async findContactosByLogin(
    login: string,
    anioEscolar?: number,
  ): Promise<StudentContactosResponse> {
    const me = await this.findMeByLogin(login);
    const anio = anioEscolar ?? new Date().getFullYear();

    const allStudents = await this.studentsRepository.find();
    const companerosRaw = listStudentsForAula(
      allStudents,
      me.nivel,
      me.grado,
      me.seccion,
    ).filter((s) => s.id !== me.id);

    const emails = companerosRaw.map((s) => s.email.trim().toLowerCase());
    const users =
      emails.length > 0
        ? await this.userRepo.find({ where: { email: In(emails) } })
        : [];
    const telefonoByEmail = new Map(
      users.map((u) => [u.email.trim().toLowerCase(), u.telefono?.trim() ?? '']),
    );

    const companeros = companerosRaw.map((s) => ({
      id: s.id,
      nombres: s.nombre,
      apellidos: s.apellido,
      email: s.email,
      telefono: telefonoByEmail.get(s.email.trim().toLowerCase()) ?? '',
    }));

    const blocks = await this.horarioBlockRepo.find({
      where: {
        anioEscolar: anio,
        nivel: me.nivel,
        grado: me.grado,
        seccion: me.seccion,
        activo: true,
      },
    });

    const cursoIds = [...new Set(blocks.map((b) => b.cursoId))];
    const docenteIds = [...new Set(blocks.map((b) => b.docenteId))];

    const cursos =
      cursoIds.length > 0
        ? await this.curriculumSubjectRepo.find({
            where: { id: In(cursoIds) },
          })
        : [];
    const cursoById = new Map(cursos.map((c) => [c.id, c.nombre]));

    const docentesDb =
      docenteIds.length > 0
        ? await this.docenteRepo.find({
            where: { id: In(docenteIds), estado: 'activo' },
          })
        : [];
    const docenteById = new Map(docentesDb.map((d) => [d.id, d]));

    const cursosPorDocente = new Map<number, Set<string>>();
    for (const block of blocks) {
      const cursoNombre = cursoById.get(block.cursoId);
      if (!cursoNombre) continue;
      if (!cursosPorDocente.has(block.docenteId)) {
        cursosPorDocente.set(block.docenteId, new Set());
      }
      cursosPorDocente.get(block.docenteId)!.add(cursoNombre);
    }

    const docentes = [...cursosPorDocente.entries()]
      .map(([docenteId, cursosSet]) => {
        const docente = docenteById.get(docenteId);
        if (!docente) return null;
        return {
          id: docente.id,
          nombres: docente.nombres,
          apellidos: docente.apellidos,
          abrev: docente.abrev?.trim() || abrevDocente(docente.nombres, docente.apellidos),
          email: docente.email,
          telefono: docente.telefono?.trim() ?? '',
          especialidad: docente.especialidad?.trim() ?? '',
          cursos: [...cursosSet].sort((a, b) => a.localeCompare(b, 'es')),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) =>
        `${a.apellidos} ${a.nombres}`.localeCompare(
          `${b.apellidos} ${b.nombres}`,
          'es',
        ),
      );

    return {
      aula: {
        nivel: me.nivel,
        grado: me.grado,
        seccion: me.seccion,
        aulaLabel: me.aulaLabel,
        anioEscolar: anio,
      },
      companeros,
      docentes,
    };
  }

  async findAttendancesByLogin(
    login: string,
    anioEscolar?: number,
  ): Promise<Attendance[]> {
    const me = await this.findMeByLogin(login);
    const anio = anioEscolar ?? new Date().getFullYear();

    return this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.studentId = :studentId', { studentId: me.id })
      .andWhere('a.fecha >= :desde', { desde: `${anio}-01-01` })
      .andWhere('a.fecha <= :hasta', { hasta: `${anio}-12-31` })
      .orderBy('a.fecha', 'DESC')
      .getMany();
  }

  async findGradesByLogin(
    login: string,
    anioEscolar?: number,
  ): Promise<StudentGradesResponse> {
    const me = await this.findMeByLogin(login);
    const anio = anioEscolar ?? new Date().getFullYear();
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const gradoNorm = normalizeGradoMatricula(me.grado);
    const seccionNorm = me.seccion.trim().toUpperCase();

    const blocksDb = await this.horarioBlockRepo.find({
      where: { anioEscolar: anio, nivel: me.nivel, activo: true },
    });
    const blocks = blocksDb.filter(
      (b) =>
        normalizeGradoMatricula(b.grado) === gradoNorm &&
        b.seccion.trim().toUpperCase() === seccionNorm,
    );

    const cursoIds = [...new Set(blocks.map((b) => b.cursoId))];
    const docenteIds = [...new Set(blocks.map((b) => b.docenteId))];

    const cursosDb =
      cursoIds.length > 0
        ? await this.curriculumSubjectRepo.find({
            where: { id: In(cursoIds) },
          })
        : [];

    const areaIds = [...new Set(cursosDb.map((c) => c.areaId))];
    const areasDb =
      areaIds.length > 0
        ? await this.curriculumAreaRepo.find({ where: { id: In(areaIds) } })
        : [];
    const areaById = new Map(areasDb.map((a) => [a.id, a.nombre]));

    const docentesDb =
      docenteIds.length > 0
        ? await this.docenteRepo.find({
            where: { id: In(docenteIds), estado: 'activo' },
          })
        : [];
    const docenteById = new Map(docentesDb.map((d) => [d.id, d]));

    const docenteAbrevByCursoId = new Map<number, string>();
    for (const block of blocks) {
      if (docenteAbrevByCursoId.has(block.cursoId)) continue;
      const docente = docenteById.get(block.docenteId);
      docenteAbrevByCursoId.set(
        block.cursoId,
        docente?.abrev?.trim() ||
          (docente
            ? abrevDocente(docente.nombres, docente.apellidos)
            : 'Docente'),
      );
    }

    const gradesDb = await this.gradeRepo.find({
      where: { studentId: me.id },
      order: { fechaEvaluacion: 'DESC' },
    });
    const grades = gradesDb.filter((g) =>
      g.fechaEvaluacion.startsWith(String(anio)),
    );

    const toItem = (g: Grade): StudentGradeItemResponse => ({
      id: g.id,
      descripcion: g.descripcion ?? g.tipo,
      fecha: g.fechaEvaluacion.slice(0, 10),
      bimestre: g.bimestre,
      nota: g.nota,
    });

    const cursos = cursosDb
      .map((curso) => {
        const cursoGrades = grades.filter(
          (g) =>
            g.courseId === curso.id ||
            (!g.courseId && g.curso === curso.nombre),
        );
        return {
          id: curso.id,
          nombre: curso.nombre,
          area: areaById.get(curso.areaId) ?? 'Área curricular',
          docenteAbrev: docenteAbrevByCursoId.get(curso.id) ?? 'Docente',
          controlesDiarios: cursoGrades
            .filter((g) => g.tipo === 'daily')
            .map(toItem),
          parciales: cursoGrades
            .filter((g) => g.tipo === 'partial')
            .map(toItem),
          finales: cursoGrades.filter((g) => g.tipo === 'final').map(toItem),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return {
      bimestreActual,
      anioEscolar: anio,
      cursos,
    };
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
    if (
      dto.apellidos !== undefined ||
      dto.apellidoPaterno !== undefined ||
      dto.apellidoMaterno !== undefined
    ) {
      const apellidos = resolveApellidos({
        apellidos: dto.apellidos ?? current.apellido,
        apellidoPaterno: dto.apellidoPaterno ?? current.apellidoPaterno,
        apellidoMaterno: dto.apellidoMaterno ?? current.apellidoMaterno,
      });
      current.apellido = apellidos.apellido;
      current.apellidoPaterno = apellidos.apellidoPaterno;
      current.apellidoMaterno = apellidos.apellidoMaterno;
    }
    if (dto.email !== undefined) current.email = dto.email.trim();
    if (dto.codigo !== undefined) current.codigo = dto.codigo.trim();
    if (dto.dni !== undefined) current.dni = dto.dni.trim();
    if (dto.tipoDocumento !== undefined) {
      current.tipoDocumento = dto.tipoDocumento.trim() || 'DNI';
    }
    if (dto.fechaNac !== undefined) {
      current.fechaNac = dto.fechaNac.trim() || null;
    }
    if (dto.sexo !== undefined) current.sexo = dto.sexo;
    if (dto.direccion !== undefined) current.direccion = dto.direccion.trim();
    if (dto.distrito !== undefined) current.distrito = dto.distrito.trim();
    if (dto.provincia !== undefined) current.provincia = dto.provincia.trim();
    if (dto.departamento !== undefined) {
      current.departamento = dto.departamento.trim();
    }
    if (dto.telefonoEmergencia !== undefined) {
      current.telefonoEmergencia = dto.telefonoEmergencia.trim();
    }
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

  async findStudentDocumentsMatricula(
    studentId: number,
  ): Promise<StudentDocumentsResponse> {
    const student = await this.getOrFail(studentId);
    const gradoLabel = gradoLabelFromParts(student.nivel, student.grado);
    const stored = await this.documentRepo.find({
      where: { studentId },
      order: { id: 'ASC' },
    });
    const documentos = combinarRequisitosConDocumentos(
      gradoLabel,
      stored.map((d) => this.toDocumentResponse(d)),
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

  async getSectionOccupancy(nivel: string, grado: string, anioEscolar?: number) {
    return this.salonesService.getSectionOccupancy(nivel, grado, anioEscolar);
  }

  async findSectionChangeCandidates(
    nivel?: string,
    grado?: string,
  ): Promise<SectionChangeCandidateResponse[]> {
    const students = await this.studentsRepository.find({
      where: {
        activo: true,
        estadoMatricula: 'activo',
        estadoCambioSeccion: 'elegible',
      },
      order: { apellido: 'ASC', nombre: 'ASC', id: 'ASC' },
    });

    const docLookup = this.buildDocumentoLookupForSectionChange(students);
    const unicos = this.dedupeStudentsForSectionChange(students);
    const filtered = unicos.filter((s) => {
      if (nivel && s.nivel !== nivel) return false;
      if (grado) {
        return (
          normalizeGradoMatricula(s.grado) === normalizeGradoMatricula(grado) ||
          gradoLabelFromParts(s.nivel, s.grado) === grado.trim()
        );
      }
      return true;
    });

    return filtered.map((s) =>
      mapSectionChangeCandidate(
        s,
        this.resolveDocumentoForSectionChange(s, docLookup),
      ),
    );
  }

  async findSectionChanges(nivel?: string, grado?: string) {
    const qb = this.sectionChangeRepo
      .createQueryBuilder('change')
      .orderBy('change.createdAt', 'DESC');

    if (nivel) qb.andWhere('change.nivel = :nivel', { nivel });
    if (grado) {
      qb.andWhere('change.grado = :grado', {
        grado: normalizeGradoMatricula(grado),
      });
    }

    const rows = await qb.getMany();
    const studentIds = [...new Set(rows.map((row) => row.studentId))];
    const students = studentIds.length
      ? await this.studentsRepository.findBy({ id: In(studentIds) })
      : [];
    const docPorAlumno = new Map(
      students.map((s) => [
        s.id,
        { dni: s.dni?.trim() ?? '', tipoDocumento: s.tipoDocumento?.trim() || 'DNI' },
      ]),
    );

    return rows.map((row) => {
      const doc = docPorAlumno.get(row.studentId);
      return {
      id: row.id,
      studentId: row.studentId,
      estudiante: row.estudiante,
      dni: doc?.dni ?? '',
      tipoDocumento: doc?.tipoDocumento ?? 'DNI',
      nivel: row.nivel,
      grado: row.grado,
      seccionAnterior: row.seccionAnterior,
      seccionNueva: row.seccionNueva,
      motivo: row.motivo,
      observacion: row.observacion,
      autorizadoPor: row.autorizadoPor,
      realizadoPor: row.realizadoPor,
      anioEscolar: row.anioEscolar ?? row.createdAt.getFullYear(),
      estado: row.estado ?? 'completado',
      createdAt: row.createdAt.toISOString(),
    };
    });
  }

  async changeSection(id: number, dto: ChangeSectionDto) {
    const student = await this.getOrFail(id);
    if (!student.activo) {
      throw new BadRequestException(
        'Solo se puede cambiar seccion a estudiantes con matricula activa',
      );
    }

    const canonical = await this.getCanonicalSectionChangeStudent(student);
    if (canonical.id !== student.id) {
      throw new BadRequestException(
        `Registro duplicado. Utilice el expediente ${buildCodigo(canonical.id, canonical.codigo)}.`,
      );
    }

    if (student.estadoCambioSeccion === 'cambio_realizado') {
      throw new BadRequestException(
        'Este alumno ya tiene un cambio de seccion registrado en el periodo actual',
      );
    }

    const nuevaSeccion = dto.nuevaSeccion.trim().toUpperCase();
    const motivo = dto.motivo.trim();
    const autorizadoPor = dto.autorizadoPor.trim();
    const observacion = dto.observacion?.trim() ?? '';

    if (student.seccion.toUpperCase() === nuevaSeccion) {
      throw new BadRequestException('El estudiante ya pertenece a esa seccion');
    }

    if (motivo === 'otro' && !observacion) {
      throw new BadRequestException(
        'Debe indicar una observacion cuando el motivo es "otro"',
      );
    }

    const dni = student.dni?.trim();
    if (dni) {
      const mismoDniEnDestino = await this.studentsRepository.findOne({
        where: {
          nivel: student.nivel,
          grado: student.grado,
          seccion: nuevaSeccion,
          dni,
          activo: true,
        },
      });
      if (mismoDniEnDestino && mismoDniEnDestino.id !== student.id) {
        throw new BadRequestException(
          'Ya existe un alumno con el mismo DNI en la seccion destino',
        );
      }
    }

    const duplicadoNombreEnDestino = await this.studentsRepository.find({
      where: {
        nivel: student.nivel,
        grado: student.grado,
        seccion: nuevaSeccion,
        apellido: student.apellido,
        nombre: student.nombre,
        activo: true,
      },
    });
    if (duplicadoNombreEnDestino.some((s) => s.id !== student.id)) {
      throw new BadRequestException(
        'Ya existe un alumno con el mismo nombre en la seccion destino',
      );
    }

    const anio = new Date().getFullYear();
    await this.salonesService.assertVacancyAvailable(
      student.nivel,
      student.grado,
      nuevaSeccion,
      anio,
    );

    const seccionAnterior = student.seccion.toUpperCase();
    student.seccion = nuevaSeccion;
    student.estadoCambioSeccion = 'cambio_realizado';
    await this.studentsRepository.save(student);

    await this.scheduleRepo.update(
      { studentId: student.id },
      { seccion: nuevaSeccion },
    );

    const realizadoPor = dto.realizadoPor?.trim() || 'Sistema';

    await this.sectionChangeRepo.save(
      this.sectionChangeRepo.create({
        studentId: student.id,
        estudiante: `${student.apellido}, ${student.nombre}`,
        nivel: student.nivel,
        grado: student.grado,
        seccionAnterior,
        seccionNueva: nuevaSeccion,
        motivo,
        observacion,
        autorizadoPor,
        realizadoPor,
        anioEscolar: anio,
        estado: 'completado',
      }),
    );

    const occupancy = await this.salonesService.getSectionOccupancy(
      student.nivel,
      student.grado,
      anio,
    );
    const occOrigen = occupancy.find((o) => o.seccion === seccionAnterior);
    const occDestino = occupancy.find((o) => o.seccion === nuevaSeccion);

    return {
      student: await this.findExpediente(id),
      seccionAnterior,
      seccionNueva: nuevaSeccion,
      vacanteLiberadaEn: seccionAnterior,
      vacanteOcupadaEn: nuevaSeccion,
      disponiblesOrigen: occOrigen?.disponibles ?? null,
      disponiblesDestino: occDestino?.disponibles ?? null,
      motivo,
      autorizadoPor,
      realizadoPor,
    };
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

  private async syncEstadosCambioSeccionDesdeHistorial(): Promise<void> {
    const anio = new Date().getFullYear();
    const cambios = await this.sectionChangeRepo.find();
    const ids = [
      ...new Set(
        cambios
          .filter(
            (c) =>
              (c.anioEscolar ?? c.createdAt.getFullYear()) === anio,
          )
          .map((c) => c.studentId),
      ),
    ];
    if (!ids.length) return;
    await this.studentsRepository.update(
      { id: In(ids) },
      { estadoCambioSeccion: 'cambio_realizado' satisfies EstadoCambioSeccion },
    );
  }

  private matriculaIdentityKey(student: Student): string {
    const dni = student.dni?.trim();
    if (dni) return `dni:${dni}`;
    const codigo = student.codigo?.trim();
    if (codigo) return `cod:${codigo}`;
    return [
      'nom',
      student.apellido.trim().toLowerCase(),
      student.nombre.trim().toLowerCase(),
      student.nivel.trim().toLowerCase(),
      normalizeGradoMatricula(student.grado).toLowerCase(),
      student.seccion.trim().toUpperCase(),
    ].join('|');
  }

  private nombreEnAulaKey(student: Student): string {
    return [
      student.apellido.trim().toLowerCase(),
      student.nombre.trim().toLowerCase(),
      student.nivel.trim().toLowerCase(),
      normalizeGradoMatricula(student.grado).toLowerCase(),
      student.seccion.trim().toUpperCase(),
    ].join('|');
  }

  private pickCanonicalStudentForDedupe(prev: Student, next: Student): Student {
    const score = (s: Student) =>
      (s.dni?.trim() ? 8 : 0) +
      (s.email?.match(/^alumno\.(.+)@estudiante\.pe$/i) ? 4 : 0) +
      (s.codigo?.trim() ? 4 : 0) +
      (s.apellidoPaterno?.trim() ? 2 : 0) +
      (s.tipoDocumento?.trim() ? 1 : 0);
    const prevScore = score(prev);
    const nextScore = score(next);
    if (nextScore !== prevScore) return nextScore > prevScore ? next : prev;
    return next.id < prev.id ? next : prev;
  }

  private buildDocumentoLookupForSectionChange(
    students: Student[],
  ): Map<string, { dni: string; tipoDocumento: string }> {
    const map = new Map<string, { dni: string; tipoDocumento: string }>();
    for (const s of students) {
      let dni = s.dni?.trim() ?? '';
      if (!dni) {
        dni =
          s.email?.match(/^alumno\.(.+)@estudiante\.pe$/i)?.[1]?.trim() ?? '';
      }
      if (!dni) continue;
      const entry = {
        dni,
        tipoDocumento: s.tipoDocumento?.trim() || 'DNI',
      };
      map.set(this.matriculaIdentityKey(s), entry);
      const aulaKey = this.nombreEnAulaKey(s);
      if (!map.has(aulaKey)) map.set(aulaKey, entry);
    }
    return map;
  }

  private resolveDocumentoForSectionChange(
    student: Student,
    lookup: Map<string, { dni: string; tipoDocumento: string }>,
  ): { dni: string; tipoDocumento: string } | null {
    if (student.dni?.trim()) return null;
    return (
      lookup.get(this.matriculaIdentityKey(student)) ??
      lookup.get(this.nombreEnAulaKey(student)) ??
      null
    );
  }

  private dedupeStudentsForSectionChange(students: Student[]): Student[] {
    const byIdentity = new Map<string, Student>();
    for (const s of students) {
      const key = this.matriculaIdentityKey(s);
      const prev = byIdentity.get(key);
      if (!prev) {
        byIdentity.set(key, s);
      } else {
        byIdentity.set(key, this.pickCanonicalStudentForDedupe(prev, s));
      }
    }

    const byNombreEnAula = new Map<string, Student>();
    for (const s of byIdentity.values()) {
      const key = this.nombreEnAulaKey(s);
      const prev = byNombreEnAula.get(key);
      if (!prev) {
        byNombreEnAula.set(key, s);
      } else {
        byNombreEnAula.set(key, this.pickCanonicalStudentForDedupe(prev, s));
      }
    }

    return [...byNombreEnAula.values()];
  }

  private async getCanonicalSectionChangeStudent(
    student: Student,
  ): Promise<Student> {
    const activos = await this.studentsRepository.find({
      where: { activo: true, estadoMatricula: 'activo' },
    });
    const unicos = this.dedupeStudentsForSectionChange(activos);
    const key = this.matriculaIdentityKey(student);
    const byId = unicos.find((s) => s.id === student.id);
    if (byId) return byId;

    const nombreKey = [
      student.apellido.trim().toLowerCase(),
      student.nombre.trim().toLowerCase(),
      student.nivel.trim().toLowerCase(),
      normalizeGradoMatricula(student.grado).toLowerCase(),
      student.seccion.trim().toUpperCase(),
    ].join('|');

    const match = unicos.find((s) => {
      const k = [
        s.apellido.trim().toLowerCase(),
        s.nombre.trim().toLowerCase(),
        s.nivel.trim().toLowerCase(),
        normalizeGradoMatricula(s.grado).toLowerCase(),
        s.seccion.trim().toUpperCase(),
      ].join('|');
      return k === nombreKey || this.matriculaIdentityKey(s) === key;
    });

    return match ?? student;
  }

  async findHistorialAcademicoList(
    search?: string,
  ): Promise<HistorialAcademicoListItem[]> {
    const students = await this.studentsRepository.find({
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
    const filtered = this.filterStudentsForSearch(students, search);
    return Promise.all(filtered.map((s) => this.buildHistorialListItem(s)));
  }

  async findHistorialAcademicoDetalle(
    id: number,
  ): Promise<HistorialAcademicoDetalle> {
    const student = await this.getOrFail(id);
    const [historial, attendances, grades, asistenciaPct] = await Promise.all([
      this.historyRepo.find({
        where: { studentId: student.id },
        order: { anio: 'ASC' },
      }),
      this.attendanceRepo.find({ where: { studentId: student.id } }),
      this.gradeRepo.find({
        where: { studentId: student.id },
        order: { bimestre: 'ASC', curso: 'ASC' },
      }),
      this.computeAsistenciaPct(student.id),
    ]);

    const anioActual = String(new Date().getFullYear());
    const gradesAnioActual = grades.filter((g) =>
      g.fechaEvaluacion.startsWith(anioActual),
    );
    const notasActuales = this.mapGradesToNotas(gradesAnioActual);
    const trayectoria = this.buildTrayectoria(
      student,
      historial,
      attendances,
      grades,
    );

    return {
      id: student.id,
      codigo: student.codigo,
      nombres: student.nombre,
      apellidos: student.apellido,
      dni: student.dni,
      nivel: student.nivel,
      gradoActual: student.grado,
      seccionActual: student.seccion,
      anioIngreso: student.anioIngreso,
      conductaNota: student.conductaNota ?? 'AD',
      asistenciaPct,
      trayectoria,
      notasActuales,
      resumenNotas: this.buildResumenNotas(gradesAnioActual),
    };
  }

  private filterStudentsForSearch(
    students: Student[],
    search?: string,
  ): Student[] {
    const query = search?.trim().toLowerCase();
    if (!query) return students;
    return students.filter((s) => {
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
    });
  }

  private async buildHistorialListItem(
    student: Student,
  ): Promise<HistorialAcademicoListItem> {
    const [historial, asistenciaPct, grades] = await Promise.all([
      this.historyRepo.find({
        where: { studentId: student.id },
        order: { anio: 'ASC' },
      }),
      this.computeAsistenciaPct(student.id),
      this.gradeRepo.find({ where: { studentId: student.id } }),
    ]);

    const anioActual = String(new Date().getFullYear());
    const aniosRegistrados = historial.length;
    const promedioUltimo = this.resolvePromedioUltimo(
      student,
      historial,
      grades,
      anioActual,
    );

    return {
      id: student.id,
      codigo: student.codigo,
      nombres: student.nombre,
      apellidos: student.apellido,
      dni: student.dni,
      nivel: student.nivel,
      gradoActual: student.grado,
      seccionActual: student.seccion,
      anioIngreso: student.anioIngreso,
      aniosRegistrados,
      promedioUltimo,
      asistenciaPct,
      conductaNota: student.conductaNota ?? 'AD',
      estado: student.estadoMatricula,
    };
  }

  private resolvePromedioUltimo(
    student: Student,
    historial: StudentAcademicHistory[],
    grades: Grade[],
    anioActual: string,
  ): number | null {
    const actualRow = historial.find((h) => h.anio === anioActual);
    if (actualRow) return actualRow.promedio;
    const promedioGrades = this.computePromedioFromGrades(grades);
    if (promedioGrades !== null) return promedioGrades;
    if (historial.length) return historial[historial.length - 1].promedio;
    return null;
  }

  private buildTrayectoria(
    student: Student,
    historial: StudentAcademicHistory[],
    attendances: Attendance[],
    grades: Grade[],
  ): HistorialTrayectoriaItem[] {
    const anioActual = String(new Date().getFullYear());
    const notasPorAnio = new Map<string, HistorialNotaItem[]>();
    for (const grade of grades) {
      const anio = grade.fechaEvaluacion.slice(0, 4);
      const list = notasPorAnio.get(anio) ?? [];
      list.push({
        curso: grade.curso,
        bimestre: grade.bimestre,
        tipo: grade.tipo,
        nota: grade.nota,
        fechaEvaluacion: grade.fechaEvaluacion,
      });
      notasPorAnio.set(anio, list);
    }

    const rows: HistorialTrayectoriaItem[] = historial.map((h) => ({
      anio: h.anio,
      grado: h.grado,
      seccion: h.seccion,
      promedio: h.promedio,
      estado: h.estado,
      esActual: h.anio === anioActual,
      asistencia: this.computeAsistenciaResumen(
        attendances.filter((a) => a.fecha.startsWith(h.anio)),
      ),
      notas: notasPorAnio.get(h.anio) ?? [],
    }));

    return rows.sort((a, b) => Number(a.anio) - Number(b.anio));
  }

  private mapGradesToNotas(grades: Grade[]): HistorialNotaItem[] {
    return grades.map((g) => ({
      curso: g.curso,
      bimestre: g.bimestre,
      tipo: g.tipo,
      nota: g.nota,
      fechaEvaluacion: g.fechaEvaluacion,
    }));
  }

  private buildResumenNotas(grades: Grade[]): HistorialAcademicoDetalle['resumenNotas'] {
    if (!grades.length) {
      return { promedioGeneral: null, totalRegistros: 0, porBimestre: [] };
    }

    const porBimestreMap = new Map<number, { sum: number; count: number }>();
    for (const g of grades) {
      const prev = porBimestreMap.get(g.bimestre) ?? { sum: 0, count: 0 };
      porBimestreMap.set(g.bimestre, {
        sum: prev.sum + g.nota,
        count: prev.count + 1,
      });
    }

    const porBimestre = [...porBimestreMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([bimestre, { sum, count }]) => ({
        bimestre,
        promedio: Math.round((sum / count) * 100) / 100,
        cantidad: count,
      }));

    return {
      promedioGeneral: this.computePromedioFromGrades(grades),
      totalRegistros: grades.length,
      porBimestre,
    };
  }

  private computePromedioFromGrades(grades: Pick<Grade, 'nota'>[]): number | null {
    if (!grades.length) return null;
    const sum = grades.reduce((acc, g) => acc + g.nota, 0);
    return Math.round((sum / grades.length) * 100) / 100;
  }

  private computeAsistenciaResumen(
    records: Attendance[],
  ): HistorialAsistenciaResumen {
    if (!records.length) {
      return {
        total: 0,
        presentes: 0,
        faltas: 0,
        tardanzas: 0,
        justificadas: 0,
        porcentaje: 0,
      };
    }

    const presentes = records.filter((r) => r.estado === 'P').length;
    const faltas = records.filter((r) => r.estado === 'F').length;
    const tardanzas = records.filter((r) => r.estado === 'T').length;
    const justificadas = records.filter((r) => r.estado === 'J').length;
    const asistidos = presentes + tardanzas;

    return {
      total: records.length,
      presentes,
      faltas,
      tardanzas,
      justificadas,
      porcentaje: Math.round((asistidos / records.length) * 100),
    };
  }

  private async getOrFail(id: number): Promise<Student> {
    const student = await this.studentsRepository.findOneBy({ id });
    if (!student) throw new NotFoundException(`Student ${id} no encontrado`);
    return student;
  }
}
