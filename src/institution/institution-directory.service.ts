import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { codigoNacionalDeAlumno } from '../students/codigo-alumno.util';
import { splitGradoLabel } from '../students/students.mapper';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { Student } from '../students/entities/student.entity';
import { TransferRequest } from '../transfers/entities/transfer-request.entity';
import { ESTADOS_TRASLADO_ACTIVOS } from '../transfers/transfer.constants';
import { validatePasswordPolicy } from '../auth/utils/password-policy.util';
import { hashPassword } from '../auth/utils/password-crypto.util';
import { codigoAdministradorSede, ensureAdministradorDeSede, ensureCredencialesAdministrador } from '../roles/sede-admin-role';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { Institution } from './entities/institution.entity';

interface PersonalAdministrativoRow {
  userId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  username: string;
  cargo: string;
  estado: string;
  roleCodigo: string;
  roleLabel: string | null;
  asignacionActiva: boolean;
  roleInstitutionId: number | null;
}

export interface UsuarioAdministrativo {
  userId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  username: string;
  cargo: string;
  estado: string;
  roles: { codigo: string; label: string; activo: boolean }[];
}

export interface TrayectoriaInstitucion {
  anio: string;
  codigoInstitucion: string;
  institutionId: number | null;
  institucionNombre: string;
  grado: string;
  seccion: string;
  estado: string;
}

@Injectable()
export class InstitutionDirectoryService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentAcademicHistory)
    private readonly historyRepo: Repository<StudentAcademicHistory>,
    @InjectRepository(TransferRequest)
    private readonly transferRepo: Repository<TransferRequest>,
  ) {}

  async listInstitutions() {
    const institutions = await this.institutionRepo.find({ order: { nombre: 'ASC' } });
    const counts = await this.studentRepo
      .createQueryBuilder('s')
      .select('s.institutionId', 'institutionId')
      .addSelect('COUNT(*)', 'total')
      .where('s.institutionId IS NOT NULL')
      .groupBy('s.institutionId')
      .getRawMany<{ institutionId: number; total: string }>();
    const porId = new Map(counts.map((row) => [Number(row.institutionId), Number(row.total)]));
    const solicitudes = await this.transferRepo.find();
    return institutions.map((ie) => ({
      id: ie.id,
      nombre: ie.nombre,
      siglas: ie.siglas,
      codigoModular: ie.codigoModular,
      ugel: ie.ugel ?? '',
      dre: ie.dre ?? '',
      distrito: ie.distrito ?? '',
      alumnos: porId.get(ie.id) ?? 0,
      solicitudes: solicitudes.filter((row) => this.solicitudDeInstitucion(row, ie)).length,
    }));
  }

  async crearInstitucion(dto: CreateInstitutionDto) {
    const nombre = dto.nombre.trim();
    const codigoModular = dto.codigoModular.trim();
    if (!nombre || !codigoModular) {
      throw new BadRequestException('El nombre y el código modular son obligatorios.');
    }
    const repetida = await this.institutionRepo.findOne({ where: { codigoModular } });
    if (repetida) {
      throw new ConflictException('Ya existe una institución con ese código modular.');
    }
    const texto = (value?: string) => value?.trim() ?? '';
    const saved = await this.institutionRepo.save(
      this.institutionRepo.create({
        nombre,
        codigoModular,
        siglas: texto(dto.siglas),
        ruc: texto(dto.ruc),
        tipoGestion: dto.tipoGestion ?? 'publica',
        ugel: texto(dto.ugel),
        dre: texto(dto.dre),
        resolucion: texto(dto.resolucion),
        direccion: texto(dto.direccion),
        distrito: texto(dto.distrito),
        provincia: texto(dto.provincia),
        region: texto(dto.region),
        codigoPostal: texto(dto.codigoPostal),
        telefono: texto(dto.telefono),
        telefono2: texto(dto.telefono2),
        email: texto(dto.email),
        web: texto(dto.web),
        facebook: texto(dto.facebook),
        director: texto(dto.director),
        subdirector: texto(dto.subdirector),
        administrador: texto(dto.administrador),
        anio: texto(dto.anio) || String(new Date().getFullYear()),
        sistemaEval: dto.sistemaEval ?? 'numerico',
        tipoPeriodo: dto.tipoPeriodo ?? 'bimestre',
        notaMinima: dto.notaMinima ?? 11,
        escalaLogro: dto.escalaLogro ?? { AD: 17.5, A: 14, B: 11 },
      }),
    );
    const rolAdministrativo = await ensureAdministradorDeSede(this.institutionRepo.manager, {
      id: saved.id,
      nombre: saved.nombre,
    });
    const credenciales = await ensureCredencialesAdministrador(this.institutionRepo.manager, {
      id: saved.id,
      nombre: saved.nombre,
      codigoModular: saved.codigoModular,
    });
    return {
      id: saved.id,
      nombre: saved.nombre,
      siglas: saved.siglas,
      codigoModular: saved.codigoModular,
      ugel: saved.ugel ?? '',
      dre: saved.dre ?? '',
      distrito: saved.distrito ?? '',
      alumnos: 0,
      solicitudes: 0,
      rolAdministrativo,
      credenciales: {
        username: credenciales.username,
        password: credenciales.password,
      },
    };
  }

  async detalle(institutionId: number) {
    const institution = await this.institutionRepo.findOneBy({ id: institutionId });
    if (!institution) throw new NotFoundException('Institución no encontrada');
    return {
      institucion: this.fichaInstitucion(institution),
      personal: await this.personalAdministrativo(institutionId),
    };
  }

  async cambiarCredencial(institutionId: number, userId: number, password: string) {
    await this.usuarioAdministrativo(institutionId, userId);
    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      throw new BadRequestException(policy.errors[0]);
    }
    await this.institutionRepo.manager.query(
      `UPDATE users SET password = $1, "sessionVersion" = "sessionVersion" + 1 WHERE id = $2`,
      [hashPassword(password), userId],
    );
    const personal = await this.personalAdministrativo(institutionId);
    return { message: 'Credencial actualizada.', usuario: personal.find((row) => row.userId === userId) };
  }

  async cambiarEstado(institutionId: number, userId: number, estado: 'activo' | 'inactivo') {
    await this.usuarioAdministrativo(institutionId, userId);
    const activar = estado === 'activo';
    if (activar) {
      await this.institutionRepo.manager.query(
        `UPDATE users SET estado = 'activo', "sessionVersion" = "sessionVersion" + 1 WHERE id = $1`,
        [userId],
      );
      await this.institutionRepo.manager.query(
        `UPDATE user_role_assignments
         SET activo = true, "revokedAt" = NULL
         WHERE "userId" = $1 AND "institutionId" = $2`,
        [userId, institutionId],
      );
    } else {
      await this.institutionRepo.manager.query(
        `UPDATE user_role_assignments
         SET activo = false, "revokedAt" = NOW()
         WHERE "userId" = $1 AND "institutionId" = $2 AND activo = true`,
        [userId, institutionId],
      );
      const otras = (await this.institutionRepo.manager.query(
        `SELECT id FROM user_role_assignments WHERE "userId" = $1 AND activo = true AND "institutionId" IS DISTINCT FROM $2`,
        [userId, institutionId],
      )) as { id: number }[];
      if (!otras.length) {
        await this.institutionRepo.manager.query(
          `UPDATE users SET estado = 'inactivo', "sessionVersion" = "sessionVersion" + 1 WHERE id = $1`,
          [userId],
        );
      }
    }
    const personal = await this.personalAdministrativo(institutionId);
    return {
      message: activar ? 'Usuario administrativo activado.' : 'Usuario administrativo desactivado.',
      usuario: personal.find((row) => row.userId === userId),
    };
  }

  async listStudents(
    institutionId: number,
    query: { q?: string; grado?: string; page?: number; pageSize?: number } = {},
    alcanceInstitutionId?: number,
  ) {
    if (alcanceInstitutionId !== undefined && alcanceInstitutionId !== institutionId) {
      throw new ForbiddenException('Los alumnos de esta institución no están en su alcance.');
    }
    const institution = await this.institutionRepo.findOneBy({ id: institutionId });
    if (!institution) throw new NotFoundException('Institución no encontrada');
    const size = Math.min(50, Math.max(1, query.pageSize ?? 10));
    const current = Math.max(1, query.page ?? 1);
    const qb = this.studentRepo
      .createQueryBuilder('s')
      .where('s.institutionId = :institutionId', { institutionId })
      .orderBy('s.apellido', 'ASC')
      .addOrderBy('s.nombre', 'ASC');
    const term = query.q?.trim() ?? '';
    if (term) {
      qb.andWhere(
        `(s.nombre ILIKE :q OR s.apellido ILIKE :q OR (s.apellido || ' ' || s.nombre) ILIKE :q OR (s.nombre || ' ' || s.apellido) ILIKE :q)`,
        { q: `%${term}%` },
      );
    }
    this.filtrarGrado(qb, query.grado ?? '');
    const [rows, total] = await qb
      .skip((current - 1) * size)
      .take(size)
      .getManyAndCount();
    const solicitudes = await this.solicitudesDe(institution);
    const destinoPorAlumno = new Map<number, ReturnType<InstitutionDirectoryService['solicitudResumen']>>();
    for (const solicitud of solicitudes) {
      if (!ESTADOS_TRASLADO_ACTIVOS.includes(solicitud.estado)) continue;
      if (!destinoPorAlumno.has(solicitud.studentId)) {
        destinoPorAlumno.set(solicitud.studentId, solicitud);
      }
    }
    return {
      institucion: this.institucionResumen(institution),
      items: rows.map((student) => ({
        ...this.alumnoBasico(student, institution),
        traslado: destinoPorAlumno.get(student.id) ?? null,
      })),
      solicitudes,
      total,
      page: current,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(total / size)),
    };
  }

  private filtrarGrado(
    qb: ReturnType<Repository<Student>['createQueryBuilder']>,
    grado: string,
  ): void {
    const term = grado.trim();
    if (!term) return;
    const conNivel = /primaria|secundaria|inicial/i.test(term);
    if (conNivel) {
      const parsed = splitGradoLabel(term);
      qb.andWhere('s.nivel ILIKE :nivel', { nivel: parsed.nivel });
      if (parsed.grado) {
        qb.andWhere('s.grado ILIKE :grado', { grado: `%${parsed.grado}%` });
      }
      return;
    }
    qb.andWhere(
      `(s.grado ILIKE :grado OR s.nivel ILIKE :grado OR (s.grado || ' ' || s.nivel) ILIKE :grado)`,
      { grado: `%${term}%` },
    );
  }

  async findPersona(studentId: number, alcanceInstitutionId?: number) {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) throw new NotFoundException('Alumno no encontrado');
    if (
      alcanceInstitutionId !== undefined &&
      student.institutionId !== alcanceInstitutionId
    ) {
      throw new NotFoundException('Alumno no encontrado');
    }
    const codigo = student.codigoNacional || codigoNacionalDeAlumno(student);
    const mismos = await this.studentRepo.find({
      where: codigo ? { codigoNacional: codigo } : { id: student.id },
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
    const personas = (mismos.length ? mismos : [student]).filter(
      (row) =>
        alcanceInstitutionId === undefined || row.institutionId === alcanceInstitutionId,
    );
    const ids = personas.map((row) => row.id);
    const history = await this.historyRepo.find({
      where: { studentId: In(ids) },
      order: { anio: 'ASC' },
    });
    const institutionIds = [
      ...new Set(
        [
          ...personas.map((row) => row.institutionId),
          ...history.map((row) => row.institutionId),
        ].filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const institutions = institutionIds.length
      ? await this.institutionRepo.findBy({ id: In(institutionIds) })
      : [];
    const porId = new Map(institutions.map((ie) => [ie.id, ie]));
    return {
      codigoNacional: codigo,
      alumnos: personas.map((row) => {
        const actual = row.institutionId ? porId.get(row.institutionId) : undefined;
        const trayectoria = history
          .filter((item) => item.studentId === row.id)
          .map((item) => this.trayectoria(item, porId));
        return {
          ...this.alumnoBasico(row, actual),
          trayectoria,
        };
      }),
    };
  }

  private async solicitudesDe(institution: Institution) {
    const rows = await this.transferRepo.find({ order: { createdAt: 'DESC' } });
    return rows
      .filter((row) => this.solicitudDeInstitucion(row, institution))
      .map((row) => this.solicitudResumen(row, institution));
  }

  private solicitudDeInstitucion(row: TransferRequest, institution: Institution): boolean {
    const modular = (institution.codigoModular ?? '').trim();
    return (
      row.ieOrigenInstitutionId === institution.id ||
      row.ieDestinoInstitutionId === institution.id ||
      (!!modular &&
        (row.ieOrigenCodigoModular === modular || row.ieDestinoCodigoModular === modular))
    );
  }

  private solicitudResumen(row: TransferRequest, institution?: Institution) {
    const modular = (institution?.codigoModular ?? '').trim();
    const esOrigen =
      !institution ||
      row.ieOrigenInstitutionId === institution.id ||
      (!!modular && row.ieOrigenCodigoModular === modular);
    return {
      id: row.id,
      codigo: row.codigo,
      studentId: row.studentId,
      studentNombre: row.studentNombre,
      studentDni: row.studentDni,
      estado: row.estado,
      anioEscolar: row.anioEscolar,
      plazoHasta: row.plazoHasta,
      createdAt: row.createdAt,
      ieOrigenNombre: row.ieOrigenNombre,
      ieOrigenCodigoModular: row.ieOrigenCodigoModular,
      ieDestinoNombre: row.ieDestinoNombre,
      ieDestinoCodigoModular: row.ieDestinoCodigoModular,
      sentido: esOrigen ? 'salida' : 'entrada',
    };
  }

  private institucionResumen(ie: Institution) {
    return {
      id: ie.id,
      nombre: ie.nombre,
      codigoModular: ie.codigoModular,
      ugel: ie.ugel ?? '',
      dre: ie.dre ?? '',
    };
  }

  private alumnoBasico(student: Student, institution?: Institution) {
    return {
      id: student.id,
      codigoNacional: student.codigoNacional || codigoNacionalDeAlumno(student),
      codigo: student.codigo,
      nombres: student.nombre,
      apellidos: student.apellido,
      dni: student.dni,
      nivel: student.nivel,
      grado: student.grado,
      seccion: student.seccion,
      estadoMatricula: student.estadoMatricula,
      indicadorInstitucion: institution?.codigoModular ?? '',
      institucion: institution ? this.institucionResumen(institution) : null,
    };
  }

  private fichaInstitucion(ie: Institution) {
    return {
      id: ie.id,
      nombre: ie.nombre,
      siglas: ie.siglas,
      ruc: ie.ruc,
      codigoModular: ie.codigoModular,
      tipoGestion: ie.tipoGestion,
      ugel: ie.ugel,
      dre: ie.dre,
      resolucion: ie.resolucion,
      direccion: ie.direccion,
      distrito: ie.distrito,
      provincia: ie.provincia,
      region: ie.region,
      codigoPostal: ie.codigoPostal,
      telefono: ie.telefono,
      telefono2: ie.telefono2,
      email: ie.email,
      web: ie.web,
      facebook: ie.facebook,
      director: ie.director,
      subdirector: ie.subdirector,
      administrador: ie.administrador,
      anio: ie.anio,
      sistemaEval: ie.sistemaEval,
      tipoPeriodo: ie.tipoPeriodo,
      notaMinima: ie.notaMinima,
      escalaLogro: ie.escalaLogro,
      niveles: (ie.niveles ?? []).map((nivel) => ({
        nombre: nivel.nombre,
        activo: nivel.activo,
        grados: (nivel.grados ?? []).map((grado) => ({
          nombre: grado.nombre,
          secciones: grado.secciones ?? [],
        })),
      })),
      periodos: ie.periodos ?? [],
      modulos: (ie.modulos ?? []).map((modulo) => ({
        key: modulo.key,
        label: modulo.label,
        activo: modulo.activo,
      })),
    };
  }

  private async personalAdministrativo(institutionId: number) {
    const rows = (await this.institutionRepo.manager.query(
      `SELECT u.id AS "userId", u.nombres, u.apellidos, u.dni, u.email, u.username,
              u.cargo, u.estado, a."roleCodigo", a.activo AS "asignacionActiva",
              r.label AS "roleLabel", r."institutionId" AS "roleInstitutionId"
       FROM user_role_assignments a
       JOIN users u ON u.id = a."userId"
       LEFT JOIN roles r ON r.codigo = a."roleCodigo"
       WHERE a."institutionId" = $1
       ORDER BY u.apellidos, u.nombres, a."roleCodigo"`,
      [institutionId],
    )) as PersonalAdministrativoRow[];

    const porUsuario = new Map<number, UsuarioAdministrativo>();
    for (const row of rows) {
      if (!this.esUsuarioAdministrativo(row, institutionId)) continue;
      const actual = porUsuario.get(row.userId) ?? {
        userId: row.userId,
        nombres: row.nombres,
        apellidos: row.apellidos,
        dni: row.dni,
        email: row.email,
        username: row.username,
        cargo: row.cargo,
        estado: row.estado,
        roles: [],
      };
      actual.roles.push({
        codigo: row.roleCodigo,
        label: row.roleLabel || row.roleCodigo,
        activo: row.asignacionActiva,
      });
      porUsuario.set(row.userId, actual);
    }
    return [...porUsuario.values()];
  }

  private async usuarioAdministrativo(institutionId: number, userId: number) {
    const institution = await this.institutionRepo.findOneBy({ id: institutionId });
    if (!institution) throw new NotFoundException('Institución no encontrada');
    const personal = await this.personalAdministrativo(institutionId);
    const usuario = personal.find((row) => row.userId === userId);
    if (!usuario) {
      throw new NotFoundException('Ese usuario administrativo no está asignado a la institución.');
    }
    return usuario;
  }

  private esUsuarioAdministrativo(row: PersonalAdministrativoRow, institutionId: number): boolean {
    if (row.roleCodigo === 'ESTUDIANTE' || row.roleCodigo === 'PADRE' || row.roleCodigo === 'DOCENTE') {
      return false;
    }
    if (row.roleCodigo === codigoAdministradorSede(institutionId)) return true;
    if (Number(row.roleInstitutionId) === institutionId) return true;
    return ['ADMIN', 'DIRECTOR', 'SECRETARIA', 'TESORERO', 'BIBLIOTECARIO'].includes(row.roleCodigo);
  }

  private trayectoria(
    row: StudentAcademicHistory,
    instituciones: Map<number, Institution>,
  ): TrayectoriaInstitucion {
    const ie = row.institutionId ? instituciones.get(row.institutionId) : undefined;
    return {
      anio: row.anio,
      codigoInstitucion: row.codigoInstitucion || ie?.codigoModular || '',
      institutionId: row.institutionId,
      institucionNombre: ie?.nombre ?? '',
      grado: row.grado,
      seccion: row.seccion,
      estado: row.estado,
    };
  }
}
