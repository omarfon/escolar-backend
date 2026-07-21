import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HorarioBlock } from '../../horarios/entities/horario-block.entity';
import { HorarioPeriodo } from '../../horarios/entities/horario-periodo.entity';
import { Student } from '../../students/entities/student.entity';
import { listStudentsForAula } from '../../students/students-dedupe.util';
import { CurriculumTeacherAssignment } from '../../curricula/entities/curriculum-teacher-assignment.entity';
import { CurriculumSubject } from '../../curricula/entities/curriculum-subject.entity';
import { Salon } from '../salones/entities/salon.entity';
import { normalizeGradoMatricula } from '../salones/salones.util';
import { CreateDocenteDto, UpdateDocenteDto } from './dto/docente.dto';
import {
  Docente,
  abrevDocente,
  maxHorasForTipo,
  tipoFromEspecialidad,
} from './entities/docente.entity';

export interface DocenteAsignacionItem {
  id: number;
  cursoId: number;
  cursoNombre: string;
  nivel: string;
  grado: string;
  secciones: string[];
  horasSemanales: number;
  salones: { seccion: string; aforo: number }[];
}

export interface DocenteSalonItem {
  nivel: string;
  grado: string;
  seccion: string;
  aforo: number;
  anioEscolar: number;
}

export interface DocenteSalonDetalle extends DocenteSalonItem {
  label: string;
  cursos: string[];
  totalAlumnos: number;
}

export interface DocenteMisSalonesResponse {
  docente: {
    id: number;
    nombreCompleto: string;
    especialidad: string;
  };
  anioEscolar: number;
  salones: DocenteSalonDetalle[];
}

export interface DocenteListItem {
  id: number;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  dni: string;
  email: string;
  username: string;
  telefono: string;
  sede: string;
  estado: string;
  especialidad: string;
  tipo: 'nombrado' | 'contratado';
  maxHoras: number;
  horasAsignadas: number;
  totalAsignaciones: number;
  totalSalones: number;
}

export interface DocenteDetail extends DocenteListItem {
  asignaciones: DocenteAsignacionItem[];
  salones: DocenteSalonItem[];
}

export interface PortalDocenteCursoCard {
  id: string;
  assignmentId: number;
  cursoId: number;
  cursoNombre: string;
  nivel: string;
  grado: string;
  seccion: string;
  gradoLabel: string;
  aulaLabel: string;
  alumnosCount: number;
  aforo: number;
  horario: string;
  horasSemanales: number;
}

export interface PortalDocenteMiAulaResponse {
  docente: {
    id: number;
    nombreCompleto: string;
    especialidad: string;
    sede: string;
    abrev: string;
  };
  anioEscolar: number;
  cursos: PortalDocenteCursoCard[];
  resumen: {
    totalCursos: number;
    totalSalones: number;
    totalAlumnos: number;
    horasSemanales: number;
  };
}

export interface DocentesPageMeta {
  activos: number;
  horasAsignadas: number;
  sobreCarga: number;
}

export interface DocentesPage {
  items: DocenteListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  meta: DocentesPageMeta;
}

@Injectable()
export class DocentesMaestrosService implements OnModuleInit {
  constructor(
    @InjectRepository(Docente)
    private readonly docenteRepo: Repository<Docente>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(CurriculumTeacherAssignment)
    private readonly assignmentRepo: Repository<CurriculumTeacherAssignment>,
    @InjectRepository(CurriculumSubject)
    private readonly subjectRepo: Repository<CurriculumSubject>,
    @InjectRepository(Salon)
    private readonly salonRepo: Repository<Salon>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(HorarioBlock)
    private readonly horarioBlockRepo: Repository<HorarioBlock>,
    @InjectRepository(HorarioPeriodo)
    private readonly horarioPeriodoRepo: Repository<HorarioPeriodo>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consolidateDuplicateAssignments();
  }

  async findAll(query?: {
    estado?: string;
    sede?: string;
    busqueda?: string;
    anioEscolar?: number;
  }): Promise<DocenteListItem[]> {
    const page = await this.findPaginated(query, 1, 10_000);
    return page.items;
  }

  async findPaginated(
    query?: {
      estado?: string;
      sede?: string;
      busqueda?: string;
      anioEscolar?: number;
    },
    page = 1,
    pageSize = 10,
  ): Promise<DocentesPage> {
    const anio = query?.anioEscolar ?? new Date().getFullYear();
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const docentes = await this.buildQuery(query).getMany();
    const enriched = await this.enrichDocentes(docentes, anio);
    const items = enriched.map(({ asignaciones, salones, ...rest }) => ({
      ...rest,
      totalAsignaciones: asignaciones.length,
      totalSalones: salones.length,
    }));

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * safePageSize;
    const pageItems = items.slice(start, start + safePageSize);

    const activos = items.filter((d) => d.estado === 'activo');
    const meta: DocentesPageMeta = {
      activos: activos.length,
      horasAsignadas: activos.reduce((s, d) => s + d.horasAsignadas, 0),
      sobreCarga: activos.filter((d) => d.horasAsignadas > d.maxHoras).length,
    };

    return {
      items: pageItems,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
      meta,
    };
  }

  private buildQuery(query?: {
    estado?: string;
    sede?: string;
    busqueda?: string;
  }): SelectQueryBuilder<Docente> {
    const qb = this.docenteRepo
      .createQueryBuilder('d')
      .orderBy('d.apellidos', 'ASC')
      .addOrderBy('d.nombres', 'ASC');

    if (query?.estado) {
      qb.andWhere('d.estado = :estado', { estado: query.estado });
    }
    if (query?.sede) {
      qb.andWhere('d.sede = :sede', { sede: query.sede });
    }

    const terminos = query?.busqueda
      ?.trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terminos?.length) {
      terminos.forEach((termino, index) => {
        const param = `busq${index}`;
        const pattern = `%${termino}%`;
        qb.andWhere(
          `(
            LOWER(d.nombres) LIKE :${param}
            OR LOWER(d.apellidos) LIKE :${param}
            OR LOWER(CONCAT(d.nombres, ' ', d.apellidos)) LIKE :${param}
            OR LOWER(CONCAT(d.apellidos, ' ', d.nombres)) LIKE :${param}
            OR LOWER(CONCAT(d.apellidos, ', ', d.nombres)) LIKE :${param}
            OR LOWER(d.email) LIKE :${param}
            OR LOWER(d.username) LIKE :${param}
            OR d.dni LIKE :${param}
            OR LOWER(d.especialidad) LIKE :${param}
            OR LOWER(d.sede) LIKE :${param}
            OR LOWER(d.telefono) LIKE :${param}
          )`,
          { [param]: pattern },
        );
      });
    }

    return qb;
  }

  async findOne(id: number, anioEscolar?: number): Promise<DocenteDetail> {
    const docente = await this.getDocenteOrFail(id);
    const anio = anioEscolar ?? new Date().getFullYear();
    const [enriched] = await this.enrichDocentes([docente], anio);
    return {
      ...enriched,
      totalAsignaciones: enriched.asignaciones.length,
      totalSalones: enriched.salones.length,
    };
  }

  async getMiPerfil(
    userId: number,
    anioEscolar?: number,
  ): Promise<DocenteDetail> {
    const docente = await this.docenteRepo.findOne({ where: { userId } });
    if (!docente) {
      throw new NotFoundException(
        'No se encontró un perfil docente vinculado a este usuario',
      );
    }
    return this.findOne(docente.id, anioEscolar);
  }

  async getMiAula(
    userId: number,
    anioEscolar?: number,
  ): Promise<PortalDocenteMiAulaResponse> {
    const docente = await this.docenteRepo.findOne({
      where: { userId, estado: 'activo' },
    });
    if (!docente) {
      throw new NotFoundException(
        'No hay un docente activo vinculado a este usuario',
      );
    }

    const anio = anioEscolar ?? new Date().getFullYear();
    const detail = await this.findOne(docente.id, anio);
    const students = await this.studentRepo.find();
    const periodos = await this.horarioPeriodoRepo.find({
      where: { anioEscolar: anio, activo: true },
      order: { orden: 'ASC' },
    });
    const blocks = await this.horarioBlockRepo.find({
      where: { anioEscolar: anio, docenteId: docente.id, activo: true },
    });

    const cursos: PortalDocenteCursoCard[] = [];
    const salonKeys = new Set<string>();
    const cursoKeys = new Set<string>();

    for (const asg of detail.asignaciones) {
      const gradoNorm = normalizeGradoMatricula(asg.grado);
      for (const seccion of asg.secciones ?? []) {
        const sec = seccion.trim().toUpperCase();
        const cursoKey = `${asg.cursoNombre}|${this.salonKey(asg.nivel, gradoNorm, sec)}`;
        if (cursoKeys.has(cursoKey)) continue;
        cursoKeys.add(cursoKey);

        const alumnos = listStudentsForAula(
          students,
          asg.nivel,
          gradoNorm,
          sec,
        );
        const salon = asg.salones.find((s) => s.seccion === sec);
        const cardBlocks = blocks.filter(
          (b) =>
            b.cursoId === asg.cursoId &&
            b.nivel === asg.nivel &&
            normalizeGradoMatricula(b.grado) === gradoNorm &&
            b.seccion.trim().toUpperCase() === sec,
        );

        cursos.push({
          id: cursoKey,
          assignmentId: asg.id,
          cursoId: asg.cursoId,
          cursoNombre: asg.cursoNombre,
          nivel: asg.nivel.trim(),
          grado: gradoNorm,
          seccion: sec,
          gradoLabel: `${gradoNorm} ${sec}`,
          aulaLabel: `${asg.nivel.trim()} · ${gradoNorm} · ${sec}`,
          alumnosCount: alumnos.length,
          aforo: salon?.aforo ?? 0,
          horario: this.formatHorario(cardBlocks, periodos),
          horasSemanales: asg.horasSemanales,
        });
        salonKeys.add(this.salonKey(asg.nivel, gradoNorm, sec));
      }
    }

    cursos.sort((a, b) =>
      `${a.nivel}${a.grado}${a.seccion}${a.cursoNombre}`.localeCompare(
        `${b.nivel}${b.grado}${b.seccion}${b.cursoNombre}`,
        'es',
      ),
    );

    const totalAlumnos = [
      ...new Set(
        cursos.map((c) => `${c.nivel}|${c.grado}|${c.seccion}`),
      ),
    ].reduce((sum, key) => {
      const [nivel, grado, seccion] = key.split('|');
      return (
        sum +
        listStudentsForAula(students, nivel, grado, seccion).length
      );
    }, 0);

    return {
      docente: {
        id: docente.id,
        nombreCompleto: detail.nombreCompleto,
        especialidad: detail.especialidad,
        sede: detail.sede,
        abrev: docente.abrev || detail.nombreCompleto,
      },
      anioEscolar: anio,
      cursos,
      resumen: {
        totalCursos: cursos.length,
        totalSalones: salonKeys.size,
        totalAlumnos,
        horasSemanales: detail.horasAsignadas,
      },
    };
  }

  async findSalonesForUser(
    userId: number,
    username?: string,
    anioEscolar?: number,
  ): Promise<DocenteMisSalonesResponse> {
    let docente = await this.docenteRepo.findOne({ where: { userId } });
    if (!docente && username) {
      docente = await this.docenteRepo.findOne({
        where: { username: username.trim() },
      });
    }
    if (!docente) {
      throw new NotFoundException(
        'No se encontró un perfil docente vinculado a este usuario',
      );
    }
    if (docente.estado !== 'activo') {
      throw new BadRequestException('El docente no está activo');
    }

    const anio = anioEscolar ?? new Date().getFullYear();
    const [detail] = await this.enrichDocentes([docente], anio);
    const alumnos = await this.studentRepo.find({
      where: { activo: true, estadoMatricula: 'activo' },
    });

    const salonesDb = await this.salonRepo.find({
      where: { anioEscolar: anio, activo: true },
    });
    const salonIndex = new Map<string, Salon>();
    for (const salon of salonesDb) {
      salonIndex.set(
        this.salonKey(salon.nivel, salon.grado, salon.seccion),
        salon,
      );
    }

    const salones = this.buildSalonesFromAsignaciones(
      detail.asignaciones,
      anio,
      alumnos,
      salonIndex,
    );

    return {
      docente: {
        id: docente.id,
        nombreCompleto: `${docente.apellidos}, ${docente.nombres}`,
        especialidad: docente.especialidad || 'Docente',
      },
      anioEscolar: anio,
      salones,
    };
  }

  async create(dto: CreateDocenteDto): Promise<DocenteDetail> {
    const username = dto.username?.trim() || dto.email.split('@')[0];
    const especialidad = dto.especialidad.trim();
    const tipo = dto.tipo ?? tipoFromEspecialidad(especialidad);

    const user = this.usersRepo.create({
      nombres: dto.nombres.trim(),
      apellidos: dto.apellidos.trim(),
      dni: dto.dni.trim(),
      email: dto.email.trim().toLowerCase(),
      username,
      telefono: dto.telefono?.trim() ?? '',
      rol: 'DOCENTE',
      sede: dto.sede?.trim() ?? 'Sede Central',
      estado: dto.estado ?? 'activo',
      cargo: especialidad,
      password: dto.password,
      ultimoAcceso: null,
    });

    try {
      const savedUser = await this.usersRepo.save(user);
      const docente = this.docenteRepo.create({
        userId: savedUser.id,
        nombres: savedUser.nombres,
        apellidos: savedUser.apellidos,
        dni: savedUser.dni,
        email: savedUser.email,
        username: savedUser.username,
        telefono: savedUser.telefono,
        sede: savedUser.sede,
        estado: savedUser.estado as Docente['estado'],
        especialidad,
        tipo,
        maxHoras: maxHorasForTipo(tipo),
        abrev: abrevDocente(savedUser.nombres, savedUser.apellidos),
      });
      const saved = await this.docenteRepo.save(docente);
      return this.findOne(saved.id);
    } catch (err: unknown) {
      throw new BadRequestException(this.extractUniqueError(err));
    }
  }

  async update(id: number, dto: UpdateDocenteDto): Promise<DocenteDetail> {
    const current = await this.getDocenteOrFail(id);

    if (dto.nombres !== undefined) current.nombres = dto.nombres.trim();
    if (dto.apellidos !== undefined) current.apellidos = dto.apellidos.trim();
    if (dto.dni !== undefined) current.dni = dto.dni.trim();
    if (dto.email !== undefined) current.email = dto.email.trim().toLowerCase();
    if (dto.username !== undefined) current.username = dto.username.trim();
    if (dto.telefono !== undefined) current.telefono = dto.telefono.trim();
    if (dto.sede !== undefined) current.sede = dto.sede.trim();
    if (dto.estado !== undefined) current.estado = dto.estado;
    if (dto.especialidad !== undefined) {
      current.especialidad = dto.especialidad.trim();
      if (!dto.tipo) current.tipo = tipoFromEspecialidad(current.especialidad);
    }
    if (dto.tipo !== undefined) {
      current.tipo = dto.tipo;
      current.maxHoras = maxHorasForTipo(dto.tipo);
    }
    current.abrev = abrevDocente(current.nombres, current.apellidos);

    try {
      await this.docenteRepo.save(current);

      if (current.userId) {
        const user = await this.usersRepo.findOneBy({ id: current.userId });
        if (user) {
          user.nombres = current.nombres;
          user.apellidos = current.apellidos;
          user.dni = current.dni;
          user.email = current.email;
          user.username = current.username;
          user.telefono = current.telefono;
          user.sede = current.sede;
          user.estado = current.estado as User['estado'];
          user.cargo = current.especialidad;
          if (dto.password) user.password = dto.password;
          await this.usersRepo.save(user);
        }
      }

      return this.findOne(id);
    } catch (err: unknown) {
      throw new BadRequestException(this.extractUniqueError(err));
    }
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const current = await this.getDocenteOrFail(id);
    current.estado = 'inactivo';
    await this.docenteRepo.save(current);

    if (current.userId) {
      const user = await this.usersRepo.findOneBy({ id: current.userId });
      if (user) {
        user.estado = 'inactivo';
        await this.usersRepo.save(user);
      }
    }

    return { deleted: true, id };
  }

  /** Docentes activos para asignación académica y horarios. */
  async findActivosParaAsignacion(): Promise<Docente[]> {
    return this.docenteRepo.find({
      where: { estado: 'activo' },
      order: { apellidos: 'ASC', nombres: 'ASC' },
    });
  }

  async getDocenteOrFail(id: number): Promise<Docente> {
    const docente = await this.docenteRepo.findOneBy({ id });
    if (!docente) throw new NotFoundException(`Docente ${id} no encontrado`);
    if (docente.estado !== 'activo') {
      throw new BadRequestException('El docente seleccionado no está activo');
    }
    return docente;
  }

  private async enrichDocentes(
    docentes: Docente[],
    anioEscolar: number,
  ): Promise<DocenteDetail[]> {
    if (!docentes.length) return [];

    const docenteIds = docentes.map((d) => d.id);
    const assignments = await this.assignmentRepo.find({
      where: { docenteId: In(docenteIds), activo: true },
      order: { id: 'ASC' },
    });

    const cursoIds = [...new Set(assignments.map((a) => a.cursoId))];
    const subjects = cursoIds.length
      ? await this.subjectRepo.find({ where: { id: In(cursoIds) } })
      : [];
    const subjectById = new Map(subjects.map((s) => [s.id, s]));

    const salones = await this.salonRepo.find({
      where: { anioEscolar, activo: true },
      order: { nivel: 'ASC', grado: 'ASC', seccion: 'ASC' },
    });
    const salonIndex = new Map<string, Salon>();
    for (const salon of salones) {
      salonIndex.set(
        this.salonKey(salon.nivel, salon.grado, salon.seccion),
        salon,
      );
    }

    const byDocente = new Map<number, CurriculumTeacherAssignment[]>();
    for (const a of assignments) {
      if (a.docenteId == null) continue;
      const list = byDocente.get(a.docenteId) ?? [];
      list.push(a);
      byDocente.set(a.docenteId, list);
    }

    return docentes.map((docente) => {
      const meta = this.mapDocenteMeta(docente);
      const userAssignments = byDocente.get(docente.id) ?? [];

      const asignaciones = this.mergeAsignacionesDuplicadas(
        userAssignments.map((a) => {
          const subject = subjectById.get(a.cursoId);
          const horas =
            a.horasSemanales > 0
              ? a.horasSemanales
              : (subject?.horasSemanales ?? 0);
          const gradoNorm = normalizeGradoMatricula(a.grado);
          const assignmentSalones = (a.secciones ?? []).map((sec) => {
            const salon = salonIndex.get(
              this.salonKey(a.nivel, gradoNorm, sec),
            );
            return {
              seccion: sec.trim().toUpperCase(),
              aforo: salon?.aforo ?? 0,
            };
          });

          return {
            id: a.id,
            cursoId: a.cursoId,
            cursoNombre: subject?.nombre ?? `Curso #${a.cursoId}`,
            nivel: a.nivel.trim(),
            grado: gradoNorm,
            secciones: (a.secciones ?? []).map((s) => s.trim().toUpperCase()),
            horasSemanales: horas,
            salones: assignmentSalones,
          };
        }),
      );

      const horasAsignadas = asignaciones.reduce(
        (sum, a) => sum + a.horasSemanales,
        0,
      );

      const salonSet = new Map<string, DocenteSalonItem>();
      for (const a of asignaciones) {
        for (const sec of a.secciones ?? []) {
          const key = this.salonKey(a.nivel, a.grado, sec);
          const salon = salonIndex.get(key);
          if (!salonSet.has(key)) {
            salonSet.set(key, {
              nivel: a.nivel.trim(),
              grado: normalizeGradoMatricula(a.grado),
              seccion: sec.trim().toUpperCase(),
              aforo: salon?.aforo ?? 0,
              anioEscolar,
            });
          }
        }
      }

      return {
        ...meta,
        horasAsignadas,
        totalAsignaciones: asignaciones.length,
        totalSalones: salonSet.size,
        asignaciones,
        salones: [...salonSet.values()].sort((x, y) =>
          `${x.nivel}${x.grado}${x.seccion}`.localeCompare(
            `${y.nivel}${y.grado}${y.seccion}`,
          ),
        ),
      };
    });
  }

  private mapDocenteMeta(docente: Docente): Omit<
    DocenteListItem,
    'horasAsignadas' | 'totalAsignaciones' | 'totalSalones'
  > {
    return {
      id: docente.id,
      nombres: docente.nombres,
      apellidos: docente.apellidos,
      nombreCompleto: `${docente.apellidos}, ${docente.nombres}`,
      dni: docente.dni,
      email: docente.email,
      username: docente.username,
      telefono: docente.telefono,
      sede: docente.sede,
      estado: docente.estado,
      especialidad: docente.especialidad || 'Docente',
      tipo: docente.tipo,
      maxHoras: docente.maxHoras,
    };
  }

  private salonKey(nivel: string, grado: string, seccion: string): string {
    return `${nivel.trim()}|${normalizeGradoMatricula(grado)}|${seccion.trim().toUpperCase()}`;
  }

  private assignmentKey(
    docenteId: number,
    cursoNombre: string,
    nivel: string,
    grado: string,
  ): string {
    return `${docenteId}|${cursoNombre.trim().toLowerCase()}|${nivel.trim()}|${normalizeGradoMatricula(grado)}`;
  }

  /** Fusiona filas repetidas del mismo docente/curso/nivel/grado (p. ej. 5° A suelta + 5° B suelta + 5° A,B). */
  private mergeAsignacionesDuplicadas(
    asignaciones: DocenteAsignacionItem[],
  ): DocenteAsignacionItem[] {
    const map = new Map<string, DocenteAsignacionItem>();

    for (const asg of asignaciones) {
      const key = `${asg.cursoNombre.trim().toLowerCase()}|${asg.nivel}|${asg.grado}`;
      const secciones = [
        ...new Set((asg.secciones ?? []).map((s) => s.trim().toUpperCase())),
      ];

      if (map.has(key)) {
        const cur = map.get(key)!;
        for (const sec of secciones) {
          if (!cur.secciones.includes(sec)) cur.secciones.push(sec);
          const salon = asg.salones.find((s) => s.seccion === sec);
          if (salon && !cur.salones.some((s) => s.seccion === sec)) {
            cur.salones.push(salon);
          }
        }
        cur.horasSemanales = Math.max(cur.horasSemanales, asg.horasSemanales);
        continue;
      }

      map.set(key, {
        ...asg,
        secciones,
        salones: secciones.map((sec) => {
          const salon = asg.salones.find((s) => s.seccion === sec);
          return salon ?? { seccion: sec, aforo: 0 };
        }),
      });
    }

    return [...map.values()].sort((a, b) => a.id - b.id);
  }

  /** Desactiva asignaciones duplicadas en BD dejando una fila por docente/curso/nivel/grado. */
  async consolidateDuplicateAssignments(): Promise<void> {
    const rows = await this.assignmentRepo.find({
      where: { activo: true },
      order: { id: 'ASC' },
    });
    const subjectIds = [...new Set(rows.map((row) => row.cursoId))];
    const subjects = subjectIds.length
      ? await this.subjectRepo.find({ where: { id: In(subjectIds) } })
      : [];
    const subjectById = new Map(subjects.map((s) => [s.id, s]));

    const groups = new Map<string, CurriculumTeacherAssignment[]>();

    for (const row of rows) {
      if (row.docenteId == null) continue;
      const cursoNombre =
        subjectById.get(row.cursoId)?.nombre ?? `curso-${row.cursoId}`;
      const key = this.assignmentKey(
        row.docenteId,
        cursoNombre,
        row.nivel,
        row.grado,
      );
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    for (const group of groups.values()) {
      if (group.length <= 1) continue;

      const keeper = group.reduce((best, row) =>
        (row.secciones?.length ?? 0) >= (best.secciones?.length ?? 0)
          ? row
          : best,
      );
      const mergedSecciones = [
        ...new Set(
          group.flatMap((row) =>
            (row.secciones ?? []).map((s) => s.trim().toUpperCase()),
          ),
        ),
      ].sort();

      keeper.secciones = mergedSecciones;
      keeper.grado = normalizeGradoMatricula(keeper.grado);
      keeper.horasSemanales = Math.max(
        ...group.map((row) => row.horasSemanales ?? 0),
      );
      await this.assignmentRepo.save(keeper);

      for (const dup of group) {
        if (dup.id === keeper.id) continue;
        dup.activo = false;
        await this.assignmentRepo.save(dup);
      }
    }
  }

  /** Una entrada por aula (nivel + grado + sección), fusionando cursos duplicados. */
  private buildSalonesFromAsignaciones(
    asignaciones: DocenteAsignacionItem[],
    anioEscolar: number,
    alumnos: Student[],
    salonIndex: Map<string, Salon>,
  ): DocenteSalonDetalle[] {
    const map = new Map<string, DocenteSalonDetalle>();

    for (const asg of asignaciones) {
      const gradoNorm = normalizeGradoMatricula(asg.grado);
      for (const sec of asg.secciones ?? []) {
        const seccionNorm = sec.trim().toUpperCase();
        const key = this.salonKey(asg.nivel, gradoNorm, seccionNorm);
        const salon = salonIndex.get(key);
        const cursosAsg = [asg.cursoNombre];

        if (map.has(key)) {
          const cur = map.get(key)!;
          cur.cursos = [...new Set([...cur.cursos, ...cursosAsg])];
          continue;
        }

        const totalAlumnos = alumnos.filter(
          (s) =>
            s.nivel === asg.nivel.trim() &&
            normalizeGradoMatricula(s.grado) === gradoNorm &&
            s.seccion.toUpperCase() === seccionNorm,
        ).length;

        map.set(key, {
          nivel: asg.nivel.trim(),
          grado: gradoNorm,
          seccion: seccionNorm,
          aforo: salon?.aforo ?? 0,
          anioEscolar,
          label: `${asg.nivel.trim()} · ${gradoNorm} "${seccionNorm}"`,
          cursos: cursosAsg,
          totalAlumnos,
        });
      }
    }

    return [...map.values()].sort((a, b) =>
      `${a.nivel}${a.grado}${a.seccion}`.localeCompare(
        `${b.nivel}${b.grado}${b.seccion}`,
        'es',
      ),
    );
  }

  private formatHorario(
    blocks: HorarioBlock[],
    periodos: HorarioPeriodo[],
  ): string {
    if (!blocks.length) return 'Sin horario registrado';

    const periodoMap = new Map(periodos.map((p) => [p.id, p]));
    const DIA_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
    const byTime = new Map<string, number[]>();

    for (const block of blocks) {
      const periodo = periodoMap.get(block.periodoId);
      if (!periodo || periodo.esReceso) continue;
      const key = `${periodo.horaInicio}-${periodo.horaFin}`;
      const dias = byTime.get(key) ?? [];
      dias.push(block.dia);
      byTime.set(key, dias);
    }

    const parts: string[] = [];
    for (const [time, dias] of byTime) {
      const [inicio, fin] = time.split('-');
      const diasLabel = [...new Set(dias)]
        .sort((a, b) => a - b)
        .map((d) => DIA_LABELS[d] ?? `D${d}`)
        .join('/');
      parts.push(`${diasLabel} ${inicio}–${fin}`);
    }

    return parts.length ? parts.join(' · ') : 'Sin horario registrado';
  }

  private extractUniqueError(err: unknown): string {
    if (err && typeof err === 'object' && 'code' in err) {
      if (String((err as { code: string }).code) === '23505') {
        return 'DNI, email o usuario ya registrado';
      }
    }
    return 'No se pudo guardar el docente';
  }
}
