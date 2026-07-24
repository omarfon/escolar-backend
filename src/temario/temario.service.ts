import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumTeacherAssignment } from '../curricula/entities/curriculum-teacher-assignment.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';
import { Student } from '../students/entities/student.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateTemarioClaseDto,
  ModoLiberacionDto,
  TemarioImagenClaseDto,
  UpdateTemarioClaseDto,
} from './dto/temario-clase.dto';
import {
  TemarioClase,
  TemarioClaseEstado,
  TemarioMaterialTipo,
} from './entities/temario-clase.entity';
import {
  buildDemoClases,
  DemoClaseTemplate,
} from './temario-demo-clases.data';

export interface TemarioImagenClaseResponse {
  url: string;
  nombre: string;
  leyenda: string;
  urlDisplay: string;
}

export interface TemarioClaseResponse {
  id: number;
  docenteId: number;
  docenteNombre: string;
  assignmentId: number | null;
  cursoId: number;
  cursoNombre: string;
  nivel: string;
  grado: string;
  seccion: string;
  anioEscolar: number;
  numero: number;
  titulo: string;
  descripcion: string;
  objetivos: string;
  contenidoClase: string;
  imagenesClase: TemarioImagenClaseResponse[];
  fechaClase: string;
  fechaClaseDisplay: string;
  estado: TemarioClaseEstado;
  visibleEstudiante: boolean;
  modoLiberacion: ModoLiberacionDto;
  fechaLiberacion: string | null;
  fechaLiberacionDisplay: string | null;
  horaLiberacion: string;
  diasAntesLiberacion: number | null;
  liberadoAlumno: boolean;
  liberacionLabel: string;
  materialTitulo: string;
  materialDescripcion: string;
  materialTipo: TemarioMaterialTipo;
  materialUrl: string;
  materialNombreArchivo: string;
  materialMimeType: string;
  materialUrlDisplay: string;
  tieneMaterial: boolean;
  createdAt: string;
  updatedAt: string;
}

function demoClases(): DemoClaseTemplate[] {
  return buildDemoClases();
}

@Injectable()
export class TemarioService {
  constructor(
    @InjectRepository(TemarioClase)
    private readonly temarioRepo: Repository<TemarioClase>,
    @InjectRepository(Docente)
    private readonly docenteRepo: Repository<Docente>,
    @InjectRepository(CurriculumTeacherAssignment)
    private readonly assignmentRepo: Repository<CurriculumTeacherAssignment>,
    @InjectRepository(CurriculumSubject)
    private readonly subjectRepo: Repository<CurriculumSubject>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Inserta clases demo solo en aulas vacías. No modifica filas existentes. */
  async seedTemarioIfEmpty(anioEscolar = 2026): Promise<number> {
    const docente = await this.docenteRepo.findOne({
      where: { username: 'docente', estado: 'activo' },
    });
    if (!docente) return 0;

    const assignments = await this.assignmentRepo.find({
      where: { docenteId: docente.id, activo: true },
    });
    if (!assignments.length) return 0;

    let inserted = 0;
    const docenteNombre = `${docente.apellidos}, ${docente.nombres}`;
    const samples = demoClases();
    const seededAulas = new Set<string>();

    for (const assignment of assignments) {
      const subject = await this.subjectRepo.findOneBy({
        id: assignment.cursoId,
      });
      const cursoNombre = subject?.nombre ?? 'Matemática';
      const grado = normalizeGradoMatricula(assignment.grado);
      const secciones = (assignment.secciones?.length
        ? assignment.secciones
        : ['A']
      ).map((s) => s.trim().toUpperCase());

      for (const seccion of secciones) {
        const aulaKey = `${assignment.cursoId}|${assignment.nivel}|${grado}|${seccion}`;
        if (seededAulas.has(aulaKey)) continue;

        const existing = await this.temarioRepo.count({
          where: {
            docenteId: docente.id,
            cursoId: assignment.cursoId,
            nivel: assignment.nivel,
            grado,
            seccion,
            anioEscolar,
          },
        });
        if (existing > 0) {
          seededAulas.add(aulaKey);
          continue;
        }

        await this.temarioRepo.save(
          samples.map((sample) =>
            this.createDemoClaseEntity({
              sample,
              docenteId: docente.id,
              docenteNombre,
              assignmentId: assignment.id,
              cursoId: assignment.cursoId,
              cursoNombre,
              nivel: assignment.nivel,
              grado,
              seccion,
              anioEscolar,
            }),
          ),
        );
        inserted += samples.length;
        seededAulas.add(aulaKey);
      }
    }

    return inserted;
  }

  /**
   * Carga o repara temario desde plantilla (npm run db:temario-data).
   * Con repair=true sincroniza clases faltantes, fechas, contenido y deduplica.
   */
  async seedTemarioFromTemplate(
    anioEscolar = 2026,
    options?: { repair?: boolean },
  ): Promise<number> {
    let inserted = await this.seedTemarioIfEmpty(anioEscolar);
    if (!options?.repair) return inserted;

    inserted += await this.syncDemoClasesFaltantes(anioEscolar);
    await this.syncDemoFechasClase(anioEscolar);
    await this.syncDemoContenidoCompleto(anioEscolar);
    await this.purgeDuplicadosTemario(anioEscolar);
    return inserted;
  }

  /** Inserta clases demo que aún no existen (p. ej. ampliación de 6 a 15). */
  private async syncDemoClasesFaltantes(anioEscolar: number): Promise<number> {
    const docente = await this.docenteRepo.findOne({
      where: { username: 'docente', estado: 'activo' },
    });
    if (!docente) return 0;

    const assignments = await this.assignmentRepo.find({
      where: { docenteId: docente.id, activo: true },
    });
    if (!assignments.length) return 0;

    let inserted = 0;
    const docenteNombre = `${docente.apellidos}, ${docente.nombres}`;
    const samples = demoClases();

    for (const assignment of assignments) {
      const subject = await this.subjectRepo.findOneBy({
        id: assignment.cursoId,
      });
      const cursoNombre = subject?.nombre ?? 'Matemática';
      const grado = normalizeGradoMatricula(assignment.grado);
      const secciones = (assignment.secciones?.length
        ? assignment.secciones
        : ['A']
      ).map((s) => s.trim().toUpperCase());

      for (const seccion of secciones) {
        for (const sample of samples) {
          const exists = await this.temarioRepo.findOne({
            where: {
              cursoId: assignment.cursoId,
              nivel: assignment.nivel,
              grado,
              seccion,
              anioEscolar,
              fechaClase: sample.fechaClase,
              titulo: sample.titulo,
            },
          });
          if (exists) continue;

          await this.temarioRepo.save(
            this.createDemoClaseEntity({
              sample,
              docenteId: docente.id,
              docenteNombre,
              assignmentId: assignment.id,
              cursoId: assignment.cursoId,
              cursoNombre,
              nivel: assignment.nivel,
              grado,
              seccion,
              anioEscolar,
            }),
          );
          inserted++;
        }
      }
    }

    return inserted;
  }

  private createDemoClaseEntity(params: {
    sample: DemoClaseTemplate;
    docenteId: number;
    docenteNombre: string;
    assignmentId: number;
    cursoId: number;
    cursoNombre: string;
    nivel: string;
    grado: string;
    seccion: string;
    anioEscolar: number;
  }): TemarioClase {
    const { sample, ...ctx } = params;
    const { imagenesClase, ...rest } = sample;
    const lib = this.resolveLiberacion({
      modoLiberacion:
        sample.diasAntesLiberacion != null ? 'dias_antes' : 'inmediato',
      visibleEstudiante: true,
      fechaClase: sample.fechaClase,
      diasAntesLiberacion: sample.diasAntesLiberacion ?? null,
      fechaLiberacion: null,
      horaLiberacion: sample.horaLiberacion ?? '08:00',
    });
    return this.temarioRepo.create({
      docenteId: ctx.docenteId,
      docenteNombre: ctx.docenteNombre,
      assignmentId: ctx.assignmentId,
      cursoId: ctx.cursoId,
      cursoNombre: ctx.cursoNombre,
      nivel: ctx.nivel,
      grado: ctx.grado,
      seccion: ctx.seccion,
      anioEscolar: ctx.anioEscolar,
      visibleEstudiante: lib.visibleEstudiante,
      fechaLiberacion: lib.fechaLiberacion,
      horaLiberacion: lib.horaLiberacion,
      diasAntesLiberacion: lib.diasAntesLiberacion,
      materialTitulo: sample.materialTitulo ?? '',
      materialDescripcion: sample.materialDescripcion ?? '',
      materialTipo: sample.materialTipo ?? 'texto',
      materialUrl: sample.materialUrl ?? '',
      materialNombreArchivo: '',
      materialMimeType: '',
      imagenesClase: this.serializeImagenesClase(imagenesClase),
      ...rest,
    });
  }

  /** Actualiza clases demo existentes con el contenido completo de la plantilla. */
  private async syncDemoContenidoCompleto(anioEscolar: number): Promise<void> {
    for (const sample of demoClases()) {
      const rows = await this.temarioRepo.find({
        where: { numero: sample.numero, anioEscolar, titulo: sample.titulo },
      });
      for (const row of rows) {
        row.descripcion = sample.descripcion;
        row.objetivos = sample.objetivos;
        row.contenidoClase = sample.contenidoClase;
        row.imagenesClase = this.serializeImagenesClase(sample.imagenesClase);
        row.materialTitulo = sample.materialTitulo ?? '';
        row.materialDescripcion = sample.materialDescripcion ?? '';
        row.materialTipo = sample.materialTipo ?? 'texto';
        row.materialUrl = sample.materialUrl ?? '';
        row.estado = sample.estado;

        if (sample.diasAntesLiberacion != null) {
          const lib = this.resolveLiberacion({
            modoLiberacion: 'dias_antes',
            visibleEstudiante: true,
            fechaClase: row.fechaClase,
            diasAntesLiberacion: sample.diasAntesLiberacion,
            fechaLiberacion: null,
            horaLiberacion: row.horaLiberacion ?? '08:00',
          });
          row.visibleEstudiante = lib.visibleEstudiante;
          row.fechaLiberacion = lib.fechaLiberacion;
          row.horaLiberacion = lib.horaLiberacion;
          row.diasAntesLiberacion = lib.diasAntesLiberacion;
        } else {
          row.diasAntesLiberacion = null;
          row.fechaLiberacion = null;
          row.horaLiberacion = row.horaLiberacion ?? '08:00';
          row.visibleEstudiante = true;
        }

        await this.temarioRepo.save(row);
      }
    }
  }

  /** Corrige fechas demo ya insertadas para repartir temas en distintos días lectivos. */
  private async syncDemoFechasClase(anioEscolar: number): Promise<void> {
    for (const sample of demoClases()) {
      const rows = await this.temarioRepo.find({
        where: { numero: sample.numero, anioEscolar, titulo: sample.titulo },
      });
      for (const row of rows) {
        if (row.fechaClase === sample.fechaClase) continue;
        row.fechaClase = sample.fechaClase;
        if (row.diasAntesLiberacion != null) {
          const lib = this.resolveLiberacion({
            modoLiberacion: 'dias_antes',
            visibleEstudiante: row.visibleEstudiante,
            fechaClase: sample.fechaClase,
            diasAntesLiberacion: row.diasAntesLiberacion,
            fechaLiberacion: null,
          });
          row.fechaLiberacion = lib.fechaLiberacion;
        }
        await this.temarioRepo.save(row);
      }
    }
  }

  async findForDocente(
    userId: number,
    query: {
      nivel?: string;
      grado?: string;
      seccion?: string;
      curso?: string;
      anioEscolar?: number;
    },
  ): Promise<TemarioClaseResponse[]> {
    const docente = await this.getDocenteByUserId(userId);
    const anio = query.anioEscolar ?? new Date().getFullYear();

    const qb = this.temarioRepo
      .createQueryBuilder('t')
      .where('t.docenteId = :docenteId', { docenteId: docente.id })
      .andWhere('t.anioEscolar = :anio', { anio })
      .orderBy('t.fechaClase', 'ASC')
      .addOrderBy('t.numero', 'ASC');

    if (query.nivel) {
      qb.andWhere('t.nivel = :nivel', { nivel: query.nivel.trim() });
    }
    if (query.grado) {
      const grado = normalizeGradoMatricula(query.grado);
      qb.andWhere('(t.grado = :grado OR t.grado = :gradoRaw)', {
        grado,
        gradoRaw: query.grado.trim(),
      });
    }
    if (query.seccion) {
      qb.andWhere('UPPER(TRIM(t.seccion)) = :seccion', {
        seccion: query.seccion.trim().toUpperCase(),
      });
    }
    if (query.curso) {
      qb.andWhere('LOWER(TRIM(t.cursoNombre)) = LOWER(TRIM(:curso))', {
        curso: query.curso,
      });
    }

    const rows = await qb.getMany();
    return this.dedupeTemarioFilasExactas(rows).map((r) => this.toResponse(r));
  }

  async findForEstudiante(
    userId: number,
    query: {
      nivel?: string;
      grado?: string;
      seccion?: string;
      curso?: string;
      anioEscolar?: number;
    },
  ): Promise<TemarioClaseResponse[]> {
    const aula = await this.resolveEstudianteAula(userId, query);
    return this.findForEstudianteAula(aula, query);
  }

  async findForStudentId(
    studentId: number,
    query: { curso?: string; anioEscolar?: number },
  ): Promise<TemarioClaseResponse[]> {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student || !student.activo) {
      throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
    }

    return this.findForEstudianteAula(
      {
        nivel: student.nivel,
        grado: normalizeGradoMatricula(student.grado),
        seccion: student.seccion.trim().toUpperCase(),
      },
      query,
    );
  }

  private async findForEstudianteAula(
    aula: { nivel: string; grado: string; seccion: string },
    query: { curso?: string; anioEscolar?: number },
  ): Promise<TemarioClaseResponse[]> {
    const anio = query.anioEscolar ?? new Date().getFullYear();

    const qb = this.temarioRepo
      .createQueryBuilder('t')
      .where('t.anioEscolar = :anio', { anio })
      .andWhere('t.visibleEstudiante = true')
      .andWhere('t.nivel = :nivel', { nivel: aula.nivel })
      .andWhere('(t.grado = :grado OR t.grado = :gradoRaw)', {
        grado: aula.grado,
        gradoRaw: aula.grado,
      })
      .andWhere('UPPER(TRIM(t.seccion)) = :seccion', { seccion: aula.seccion })
      .andWhere("t.estado <> 'cancelada'")
      .orderBy('t.fechaClase', 'ASC')
      .addOrderBy('t.numero', 'ASC');

    if (query.curso) {
      qb.andWhere('LOWER(TRIM(t.cursoNombre)) = LOWER(TRIM(:curso))', {
        curso: query.curso,
      });
    }

    const rows = await qb.getMany();
    const liberados = rows.filter((r) => this.isLiberadoAlumno(r));
    const unicos = this.dedupeTemarioFilasExactas(liberados, true);
    return unicos.map((r) => this.toResponse(r));
  }

  /** Elimina filas duplicadas exactas; conserva hasta 2 temas distintos por sesión. */
  private dedupeTemarioFilasExactas(
    rows: TemarioClase[],
    porNombreCurso = false,
  ): TemarioClase[] {
    const best = new Map<string, TemarioClase>();
    for (const row of rows) {
      const key = this.temarioFilaKey(row, porNombreCurso);
      const current = best.get(key);
      if (!current || this.temarioRowScore(row) > this.temarioRowScore(current)) {
        best.set(key, row);
      }
    }
    return [...best.values()].sort(
      (a, b) =>
        a.fechaClase.localeCompare(b.fechaClase) ||
        a.numero - b.numero ||
        a.titulo.localeCompare(b.titulo, 'es'),
    );
  }

  private temarioFilaKey(row: TemarioClase, porNombreCurso = false): string {
    const cursoKey = porNombreCurso
      ? row.cursoNombre.trim().toLowerCase()
      : String(row.cursoId);
    return `${row.docenteId}|${cursoKey}|${row.nivel}|${row.grado}|${row.seccion.trim().toUpperCase()}|${row.fechaClase.slice(0, 10)}|${row.titulo.trim().toLowerCase()}`;
  }

  private temarioRowScore(row: TemarioClase): number {
    return (
      (row.contenidoClase?.length ?? 0) +
      (row.descripcion?.length ?? 0) +
      (row.imagenesClase?.length ?? 0) +
      (row.materialTitulo?.length ?? 0)
    );
  }

  /** Elimina clases duplicadas en la misma fecha (conserva la más completa). */
  private async purgeDuplicadosTemario(anioEscolar: number): Promise<void> {
    const rows = await this.temarioRepo.find({
      where: { anioEscolar },
      order: { fechaClase: 'ASC', id: 'ASC' },
    });
    if (rows.length < 2) return;

    const keep = new Set(this.dedupeTemarioFilasExactas(rows).map((r) => r.id));
    const toRemove = rows.filter((r) => !keep.has(r.id));
    if (toRemove.length) {
      await this.temarioRepo.remove(toRemove);
    }
  }

  async createForDocente(
    userId: number,
    dto: CreateTemarioClaseDto,
  ): Promise<TemarioClaseResponse> {
    const docente = await this.getDocenteByUserId(userId);
    await this.assertDocentePuedeGestionar(docente.id, dto);
    await this.assertLimiteTemasPorDia(docente.id, dto, null);

    const lib = this.resolveLiberacion({
      modoLiberacion: dto.modoLiberacion,
      visibleEstudiante: dto.visibleEstudiante,
      fechaClase: dto.fechaClase,
      fechaLiberacion: dto.fechaLiberacion ?? null,
      diasAntesLiberacion: dto.diasAntesLiberacion ?? null,
      horaLiberacion: dto.horaLiberacion ?? null,
    });

    const saved = await this.temarioRepo.save(
      this.temarioRepo.create({
        docenteId: docente.id,
        docenteNombre: `${docente.apellidos}, ${docente.nombres}`,
        assignmentId: dto.assignmentId ?? null,
        cursoId: dto.cursoId,
        cursoNombre: dto.cursoNombre.trim(),
        nivel: dto.nivel.trim(),
        grado: normalizeGradoMatricula(dto.grado),
        seccion: dto.seccion.trim().toUpperCase(),
        anioEscolar: dto.anioEscolar,
        numero: dto.numero,
        titulo: dto.titulo.trim(),
        descripcion: dto.descripcion?.trim() ?? '',
        objetivos: dto.objetivos?.trim() ?? '',
        contenidoClase: dto.contenidoClase?.trim() ?? '',
        imagenesClase: this.serializeImagenesClase(dto.imagenesClase),
        fechaClase: dto.fechaClase,
        estado: dto.estado ?? 'programada',
        visibleEstudiante: lib.visibleEstudiante,
        fechaLiberacion: lib.fechaLiberacion,
        horaLiberacion: lib.horaLiberacion,
        diasAntesLiberacion: lib.diasAntesLiberacion,
        materialTitulo: dto.materialTitulo?.trim() ?? '',
        materialDescripcion: dto.materialDescripcion?.trim() ?? '',
        materialTipo: (dto.materialTipo as TemarioMaterialTipo) ?? 'texto',
        materialUrl: dto.materialUrl?.trim() ?? '',
        materialNombreArchivo: dto.materialNombreArchivo?.trim() ?? '',
        materialMimeType: dto.materialMimeType?.trim() ?? '',
      }),
    );

    return this.toResponse(saved);
  }

  async updateForDocente(
    userId: number,
    id: number,
    dto: UpdateTemarioClaseDto,
  ): Promise<TemarioClaseResponse> {
    const docente = await this.getDocenteByUserId(userId);
    const current = await this.getClaseOrFail(id);
    if (current.docenteId !== docente.id) {
      throw new ForbiddenException('Solo puede editar clases de su temario');
    }

    if (dto.numero !== undefined) current.numero = dto.numero;
    if (dto.titulo !== undefined) current.titulo = dto.titulo.trim();
    if (dto.descripcion !== undefined) {
      current.descripcion = dto.descripcion.trim();
    }
    if (dto.objetivos !== undefined) current.objetivos = dto.objetivos.trim();
    if (dto.contenidoClase !== undefined) {
      current.contenidoClase = dto.contenidoClase.trim();
    }
    if (dto.imagenesClase !== undefined) {
      current.imagenesClase = this.serializeImagenesClase(dto.imagenesClase);
    }
    if (dto.fechaClase !== undefined) current.fechaClase = dto.fechaClase;
    if (dto.estado !== undefined) current.estado = dto.estado;

    if (dto.fechaClase !== undefined || dto.titulo !== undefined) {
      await this.assertLimiteTemasPorDia(
        docente.id,
        {
          cursoId: current.cursoId,
          nivel: current.nivel,
          grado: current.grado,
          seccion: current.seccion,
          anioEscolar: current.anioEscolar,
          fechaClase: dto.fechaClase ?? current.fechaClase,
          titulo: dto.titulo ?? current.titulo,
        },
        current.id,
      );
    }

    if (
      dto.modoLiberacion !== undefined ||
      dto.visibleEstudiante !== undefined ||
      dto.fechaLiberacion !== undefined ||
      dto.horaLiberacion !== undefined ||
      dto.diasAntesLiberacion !== undefined ||
      dto.fechaClase !== undefined
    ) {
      const lib = this.resolveLiberacion({
        modoLiberacion:
          dto.modoLiberacion ?? this.inferModoLiberacion(current),
        visibleEstudiante: dto.visibleEstudiante ?? current.visibleEstudiante,
        fechaClase: dto.fechaClase ?? current.fechaClase,
        fechaLiberacion:
          dto.fechaLiberacion !== undefined
            ? dto.fechaLiberacion
            : current.fechaLiberacion,
        diasAntesLiberacion:
          dto.diasAntesLiberacion !== undefined
            ? dto.diasAntesLiberacion
            : current.diasAntesLiberacion,
        horaLiberacion: dto.horaLiberacion ?? current.horaLiberacion,
      });
      current.visibleEstudiante = lib.visibleEstudiante;
      current.fechaLiberacion = lib.fechaLiberacion;
      current.horaLiberacion = lib.horaLiberacion;
      current.diasAntesLiberacion = lib.diasAntesLiberacion;
    }

    if (dto.materialTitulo !== undefined) {
      current.materialTitulo = dto.materialTitulo.trim();
    }
    if (dto.materialDescripcion !== undefined) {
      current.materialDescripcion = dto.materialDescripcion.trim();
    }
    if (dto.materialTipo !== undefined) {
      current.materialTipo = dto.materialTipo as TemarioMaterialTipo;
    }
    if (dto.materialUrl !== undefined) {
      current.materialUrl = dto.materialUrl.trim();
    }
    if (dto.materialNombreArchivo !== undefined) {
      current.materialNombreArchivo = dto.materialNombreArchivo.trim();
    }
    if (dto.materialMimeType !== undefined) {
      current.materialMimeType = dto.materialMimeType.trim();
    }

    const saved = await this.temarioRepo.save(current);
    return this.toResponse(saved);
  }

  async removeForDocente(userId: number, id: number): Promise<void> {
    const docente = await this.getDocenteByUserId(userId);
    const current = await this.getClaseOrFail(id);
    if (current.docenteId !== docente.id) {
      throw new ForbiddenException('Solo puede eliminar clases de su temario');
    }
    await this.temarioRepo.remove(current);
  }

  private async getDocenteByUserId(userId: number): Promise<Docente> {
    const docente = await this.docenteRepo.findOne({
      where: { userId, estado: 'activo' },
    });
    if (!docente) {
      throw new NotFoundException(
        'No hay un docente activo vinculado a este usuario',
      );
    }
    return docente;
  }

  private async getClaseOrFail(id: number): Promise<TemarioClase> {
    const row = await this.temarioRepo.findOneBy({ id });
    if (!row) throw new NotFoundException('Clase de temario no encontrada');
    return row;
  }

  private async assertDocentePuedeGestionar(
    docenteId: number,
    dto: Pick<
      CreateTemarioClaseDto,
      'nivel' | 'grado' | 'seccion' | 'cursoId' | 'anioEscolar'
    >,
  ): Promise<void> {
    const seccion = dto.seccion.trim().toUpperCase();
    const grado = normalizeGradoMatricula(dto.grado);
    const assignments = await this.assignmentRepo.find({
      where: { docenteId, activo: true, cursoId: dto.cursoId },
    });

    const ok = assignments.some(
      (a) =>
        a.nivel === dto.nivel.trim() &&
        normalizeGradoMatricula(a.grado) === grado &&
        (a.secciones ?? []).some((s) => s.trim().toUpperCase() === seccion),
    );

    if (!ok) {
      throw new ForbiddenException(
        'No tiene asignación activa para este curso y salón',
      );
    }
  }

  private async resolveEstudianteAula(
    userId: number,
    query: { nivel?: string; grado?: string; seccion?: string },
  ): Promise<{ nivel: string; grado: string; seccion: string }> {
    if (query.nivel && query.grado && query.seccion) {
      return {
        nivel: query.nivel.trim(),
        grado: normalizeGradoMatricula(query.grado),
        seccion: query.seccion.trim().toUpperCase(),
      };
    }

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const student = await this.studentRepo.findOne({
      where: { email: user.email, activo: true },
    });
    if (!student) {
      throw new NotFoundException(
        'No se encontró el perfil de estudiante vinculado',
      );
    }

    return {
      nivel: student.nivel,
      grado: normalizeGradoMatricula(student.grado),
      seccion: student.seccion.trim().toUpperCase(),
    };
  }

  private toResponse(row: TemarioClase): TemarioClaseResponse {
    const liberadoAlumno = this.isLiberadoAlumno(row);
    const materialUrlDisplay = this.materialUrlDisplay(row);
    const tieneMaterial = !!(
      row.materialTitulo?.trim() ||
      row.materialDescripcion?.trim() ||
      row.materialUrl?.trim() ||
      row.materialNombreArchivo?.trim()
    );

    return {
      id: row.id,
      docenteId: row.docenteId,
      docenteNombre: row.docenteNombre,
      assignmentId: row.assignmentId,
      cursoId: row.cursoId,
      cursoNombre: row.cursoNombre,
      nivel: row.nivel,
      grado: row.grado,
      seccion: row.seccion,
      anioEscolar: row.anioEscolar,
      numero: row.numero,
      titulo: row.titulo,
      descripcion: row.descripcion,
      objetivos: row.objetivos,
      contenidoClase: row.contenidoClase ?? '',
      imagenesClase: this.parseImagenesClase(row.imagenesClase),
      fechaClase: row.fechaClase,
      fechaClaseDisplay: this.formatFecha(row.fechaClase),
      estado: row.estado,
      visibleEstudiante: row.visibleEstudiante,
      modoLiberacion: this.inferModoLiberacion(row),
      fechaLiberacion: row.fechaLiberacion,
      fechaLiberacionDisplay: row.fechaLiberacion
        ? this.formatFechaHora(row.fechaLiberacion, row.horaLiberacion)
        : null,
      horaLiberacion: this.normalizeHora(row.horaLiberacion),
      diasAntesLiberacion: row.diasAntesLiberacion,
      liberadoAlumno,
      liberacionLabel: this.getLiberacionLabel(row),
      materialTitulo: row.materialTitulo,
      materialDescripcion: row.materialDescripcion,
      materialTipo: row.materialTipo,
      materialUrl: row.materialUrl,
      materialNombreArchivo: row.materialNombreArchivo,
      materialMimeType: row.materialMimeType,
      materialUrlDisplay,
      tieneMaterial,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private resolveLiberacion(input: {
    modoLiberacion?: ModoLiberacionDto;
    visibleEstudiante?: boolean;
    fechaClase: string;
    fechaLiberacion?: string | null;
    diasAntesLiberacion?: number | null;
    horaLiberacion?: string | null;
  }): {
    visibleEstudiante: boolean;
    fechaLiberacion: string | null;
    diasAntesLiberacion: number | null;
    horaLiberacion: string;
  } {
    const modo = input.modoLiberacion ?? 'inmediato';
    const horaLiberacion = this.normalizeHora(input.horaLiberacion);

    if (modo === 'oculto' || input.visibleEstudiante === false) {
      return {
        visibleEstudiante: false,
        fechaLiberacion: null,
        diasAntesLiberacion: null,
        horaLiberacion,
      };
    }

    if (modo === 'dias_antes') {
      const dias = input.diasAntesLiberacion ?? 3;
      return {
        visibleEstudiante: true,
        fechaLiberacion: this.subtractDays(input.fechaClase, dias),
        diasAntesLiberacion: dias,
        horaLiberacion,
      };
    }

    if (modo === 'programada' && input.fechaLiberacion) {
      return {
        visibleEstudiante: true,
        fechaLiberacion: input.fechaLiberacion.slice(0, 10),
        diasAntesLiberacion: null,
        horaLiberacion,
      };
    }

    return {
      visibleEstudiante: true,
      fechaLiberacion: null,
      diasAntesLiberacion: null,
      horaLiberacion,
    };
  }

  private inferModoLiberacion(row: TemarioClase): ModoLiberacionDto {
    if (!row.visibleEstudiante) return 'oculto';
    if (row.diasAntesLiberacion != null && row.diasAntesLiberacion >= 0) {
      return 'dias_antes';
    }
    if (row.fechaLiberacion) return 'programada';
    return 'inmediato';
  }

  private isLiberadoAlumno(row: TemarioClase): boolean {
    if (!row.visibleEstudiante) return false;
    const ts = this.releaseTimestamp(row);
    if (ts === null) return true;
    return Date.now() >= ts;
  }

  private getLiberacionLabel(row: TemarioClase): string {
    if (!row.visibleEstudiante) return 'Oculto para alumnos';
    if (!row.fechaLiberacion) return 'Visible para alumnos';
    const cuando = this.formatFechaHora(row.fechaLiberacion, row.horaLiberacion);
    if (this.isLiberadoAlumno(row)) {
      return `Liberado desde ${cuando}`;
    }
    return `Se libera el ${cuando}`;
  }

  private normalizeHora(hora?: string | null): string {
    const match = hora?.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '08:00';
    const h = Math.min(23, Math.max(0, Number(match[1])));
    const m = Math.min(59, Math.max(0, Number(match[2])));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private releaseTimestamp(row: TemarioClase): number | null {
    if (!row.fechaLiberacion) return null;
    const hora = this.normalizeHora(row.horaLiberacion);
    const [hh, mm] = hora.split(':').map(Number);
    const [y, mo, d] = row.fechaLiberacion.slice(0, 10).split('-').map(Number);
    return new Date(y, (mo ?? 1) - 1, d ?? 1, hh, mm, 0, 0).getTime();
  }

  private formatFechaHora(fecha: string, hora?: string | null): string {
    return `${this.formatFecha(fecha)} · ${this.normalizeHora(hora)}`;
  }

  private async assertLimiteTemasPorDia(
    docenteId: number,
    ctx: {
      cursoId: number;
      nivel: string;
      grado: string;
      seccion: string;
      anioEscolar: number;
      fechaClase: string;
      titulo?: string;
    },
    excludeId: number | null,
  ): Promise<void> {
    const fecha = ctx.fechaClase.slice(0, 10);
    const grado = normalizeGradoMatricula(ctx.grado);
    const seccion = ctx.seccion.trim().toUpperCase();
    const existing = await this.temarioRepo.find({
      where: {
        docenteId,
        cursoId: ctx.cursoId,
        nivel: ctx.nivel.trim(),
        grado,
        seccion,
        anioEscolar: ctx.anioEscolar,
        fechaClase: fecha,
      },
    });
    const others = existing.filter((row) => row.id !== excludeId);
    if (others.length >= 2) {
      throw new ConflictException(
        'Ya hay 2 temas registrados para este curso en la fecha indicada',
      );
    }
    const titulo = ctx.titulo?.trim().toLowerCase();
    if (
      titulo &&
      others.some((row) => row.titulo.trim().toLowerCase() === titulo)
    ) {
      throw new ConflictException(
        'Ya existe un tema con el mismo título en esta fecha',
      );
    }
  }

  private materialUrlDisplay(row: TemarioClase): string {
    const url = row.materialUrl?.trim() ?? '';
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  }

  private assetUrlDisplay(url: string): string {
    const raw = url?.trim() ?? '';
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  private parseImagenesClase(raw: string | null | undefined): TemarioImagenClaseResponse[] {
    if (!raw?.trim()) return [];
    try {
      const parsed = JSON.parse(raw) as TemarioImagenClaseDto[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((img) => img?.url?.trim())
        .map((img) => ({
          url: img.url.trim(),
          nombre: img.nombre?.trim() ?? 'Imagen',
          leyenda: img.leyenda?.trim() ?? '',
          urlDisplay: this.assetUrlDisplay(img.url),
        }));
    } catch {
      return [];
    }
  }

  private serializeImagenesClase(
    imgs: TemarioImagenClaseDto[] | undefined,
  ): string {
    if (!imgs?.length) return '[]';
    return JSON.stringify(
      imgs
        .filter((img) => img?.url?.trim())
        .map((img) => ({
          url: img.url.trim(),
          nombre: img.nombre?.trim() ?? 'Imagen',
          leyenda: img.leyenda?.trim() ?? '',
        })),
    );
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private subtractDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    dt.setDate(dt.getDate() - Math.max(0, days));
    return dt.toISOString().slice(0, 10);
  }

  private formatFecha(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dt.toLocaleDateString('es-PE', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
