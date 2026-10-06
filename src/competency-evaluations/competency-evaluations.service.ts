import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EvaluationActa } from '../actas/entities/evaluation-acta.entity';
import { Institution } from '../institution/entities/institution.entity';
import { PromediosService } from '../promedios/promedios.service';
import { isStudentMatriculaActiva } from '../students/students-dedupe.util';
import { dedupeStudentsByPerson } from '../students/students-dedupe.util';
import { CurriculaService } from '../curricula/curricula.service';
import { CompetencyChangeAuditService } from './competency-change-audit.service';
import {
  esSuperusuarioSiagie,
  institutionIdDeAlcance,
} from '../auth/siagie-access.util';
import { Curriculum } from '../curricula/entities/curriculum.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { CurriculumTeacherAssignment } from '../curricula/entities/curriculum-teacher-assignment.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { StudentsService } from '../students/students.service';
import { listStudentsForAula } from '../students/students-dedupe.util';
import { SaveCompetencyEvaluationsBulkDto } from './dto/competency-evaluation.dto';
import {
  areaAbrev,
  areaEmoji,
  calcPromedioNivel,
  competenciaShort,
  gradosCoinciden,
} from './competency-evaluations.util';
import {
  CompetencyEvaluation,
  NivelLogro,
} from './entities/competency-evaluation.entity';

export interface CompetenciaMatrixItem {
  id: number;
  cursoId: number;
  codigo: string;
  nombre: string;
  short: string;
}

export interface AreaMatrixItem {
  id: number;
  nombre: string;
  emoji: string;
  competencias: CompetenciaMatrixItem[];
}

export interface AlumnoMatrixItem {
  id: number;
  nombre: string;
  grado: string;
  seccion: string;
}

export interface EvaluacionMatrixItem {
  id: number;
  studentId: number;
  competenciaId: number;
  bimestre: number;
  anio: number;
  nivelLogro: NivelLogro;
}

export interface CompetencyMatrixValidation {
  cursoEnMalla: boolean;
  gradoEnMalla: boolean;
  competenciasConfiguradas: boolean;
  competenciasCount: number;
  bimestre: number;
  bimestreActual: number;
  bimestreHabilitado: boolean;
  anioEscolar: number;
  periodosConfigurados: number;
  periodoBimestreConfigurado: boolean;
  mallaHoras?: number | null;
  mallaDocente?: string | null;
  enMallaPorAsignacion?: boolean;
  actaCerrada?: boolean;
  edicionBloqueada?: boolean;
  codigo:
    | 'ok'
    | 'curso_no_malla'
    | 'grado_no_malla'
    | 'sin_competencias'
    | 'bimestre_no_habilitado'
    | 'periodo_no_configurado'
    | 'acta_cerrada';
  mensaje: string;
}

export interface CompetencyRegistryContextCurso {
  cursoId: number;
  nombre: string;
  areaId: number;
  areaNombre: string;
  competenciasCount: number;
  conEvaluaciones: boolean;
}

export interface CompetencyRegistryContextItem {
  id: string;
  nivel: string;
  grado: string;
  seccion: string;
  totalAlumnos: number;
  curriculumId: number | null;
  cursos: CompetencyRegistryContextCurso[];
}

export interface CompetencyRegistryContextResponse {
  bimestreActual: number;
  anioEscolar: number;
  institucion: {
    id: number;
    nombre: string;
    siglas: string;
    ugel: string;
    dre: string;
  } | null;
  permisos: { consultar: boolean; registrar: boolean };
  contexts: CompetencyRegistryContextItem[];
}

export interface CompetencyMatrixResponse {
  curriculum: Pick<
    Curriculum,
    'id' | 'anio' | 'nivel' | 'tipoEscala' | 'tipoPeriodo'
  >;
  bimestre: number;
  bimestreActual: number;
  bimestreHabilitado: boolean;
  cursoId?: number;
  cursoNombre?: string;
  nivel: string;
  grado: string;
  seccion: string;
  areas: AreaMatrixItem[];
  alumnos: AlumnoMatrixItem[];
  evaluaciones: EvaluacionMatrixItem[];
  validacion: CompetencyMatrixValidation;
}

export interface StudentCompetencyProfile {
  student: AlumnoMatrixItem;
  bimestre: number;
  anio: number;
  areas: Array<
    AreaMatrixItem & {
      promedio: NivelLogro | null;
      evaluaciones: Array<{
        competenciaId: number;
        nivelLogro: NivelLogro | null;
      }>;
    }
  >;
  promedioGlobal: NivelLogro | null;
}

@Injectable()
export class CompetencyEvaluationsService {
  constructor(
    @InjectRepository(CompetencyEvaluation)
    private readonly evalRepo: Repository<CompetencyEvaluation>,
    @InjectRepository(Docente)
    private readonly docenteRepo: Repository<Docente>,
    @InjectRepository(CurriculumTeacherAssignment)
    private readonly assignmentRepo: Repository<CurriculumTeacherAssignment>,
    @InjectRepository(CurriculumSubject)
    private readonly subjectRepo: Repository<CurriculumSubject>,
    @InjectRepository(EvaluationActa)
    private readonly actaRepo: Repository<EvaluationActa>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly studentsService: StudentsService,
    private readonly curriculaService: CurriculaService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly promediosService: PromediosService,
    private readonly changeAudit: CompetencyChangeAuditService,
  ) {}

  async getPeriodMeta(): Promise<{ bimestreActual: number }> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    return { bimestreActual };
  }

  async getRegistryContext(
    bimestre: number,
    user?: RequestUser,
    institutionId?: number,
  ): Promise<CompetencyRegistryContextResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const institution = institutionId
      ? await this.institutionRepo.findOneBy({ id: institutionId })
      : await this.institutionRepo.findOne({ order: { id: 'ASC' } });

    const students = dedupeStudentsByPerson(
      (await this.studentsService.findAll(institutionId)).filter(
        isStudentMatriculaActiva,
      ),
    );

    const groups = new Map<
      string,
      { nivel: string; grado: string; seccion: string; studentIds: number[] }
    >();
    for (const student of students) {
      const seccion = student.seccion.trim().toUpperCase();
      const grado = normalizeGradoMatricula(student.grado);
      const key = `${student.nivel.trim()}|${grado}|${seccion}`;
      const group = groups.get(key) ?? {
        nivel: student.nivel.trim(),
        grado,
        seccion,
        studentIds: [],
      };
      group.studentIds.push(student.id);
      groups.set(key, group);
    }

    const contexts: CompetencyRegistryContextItem[] = [];

    for (const group of groups.values()) {
      let curriculumId: number | null = null;
      let cursos: CompetencyRegistryContextCurso[] = [];
      try {
        const curriculum = await this.curriculaService.resolveVigenteCurriculum(
          group.nivel,
          anioEscolar,
        );
        curriculumId = curriculum.id;
        const catalog = await this.curriculaService.getCatalog(
          curriculum.id,
          group.nivel,
        );
        const cursosGrado = catalog.cursos.filter(
          (c) =>
            c.activo &&
            Array.isArray(c.grados) &&
            c.grados.some((g) =>
              gradosCoinciden(group.nivel, g, group.grado),
            ),
        );
        const areaNames = new Map(
          catalog.areas.map((a) => [a.id, a.nombre]),
        );
        const compCounts = new Map<number, number>();
        for (const comp of catalog.competencias.filter((c) => c.activo)) {
          compCounts.set(comp.cursoId, (compCounts.get(comp.cursoId) ?? 0) + 1);
        }
        cursos = cursosGrado
          .map((c) => ({
            cursoId: c.id,
            nombre: c.nombre,
            areaId: c.areaId,
            areaNombre: areaNames.get(c.areaId) ?? '',
            competenciasCount: compCounts.get(c.id) ?? 0,
            conEvaluaciones: false,
          }))
          .filter((c) => c.competenciasCount > 0)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      } catch {
        cursos = [];
      }

      contexts.push({
        id: `${group.nivel}|${group.grado}|${group.seccion}`,
        nivel: group.nivel,
        grado: group.grado,
        seccion: group.seccion,
        totalAlumnos: group.studentIds.length,
        curriculumId,
        cursos,
      });
    }

    contexts.sort((a, b) =>
      `${a.nivel}${a.grado}${a.seccion}`.localeCompare(
        `${b.nivel}${b.grado}${b.seccion}`,
        'es',
      ),
    );

    return {
      bimestreActual,
      anioEscolar,
      institucion: institution
        ? {
            id: institution.id,
            nombre: institution.nombre,
            siglas: institution.siglas,
            ugel: institution.ugel,
            dre: institution.dre,
          }
        : null,
      permisos: {
        consultar: this.canConsult(user),
        registrar: this.canRegister(user),
      },
      contexts,
    };
  }

  async getMatrix(
    query: {
      nivel: string;
      grado: string;
      seccion: string;
      bimestre: number;
      anio?: number;
      curriculumId?: number;
      areaId?: number;
      cursoId?: number;
    },
    user?: RequestUser,
    institutionId?: number,
  ): Promise<CompetencyMatrixResponse> {
    const esDocentePortal = this.esDocentePortal(user);
    if (esDocentePortal) {
      if (!query.cursoId) {
        throw new BadRequestException(
          'Debe indicar el curso asignado para registrar competencias',
        );
      }
      await this.assertDocenteAsignado(user!, {
        nivel: query.nivel,
        grado: query.grado,
        seccion: query.seccion,
        cursoId: query.cursoId,
      });
    }

    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar =
      query.anio ?? (await this.periodosService.resolveAnioEscolarActual());
    const curriculumIdHint = query.cursoId
      ? await this.resolveCurriculumIdHint({
          cursoId: query.cursoId,
          nivel: query.nivel,
          grado: query.grado,
          anioEscolar,
          curriculumId: query.curriculumId,
          docenteUserId: esDocentePortal ? +user!.id : undefined,
        })
      : query.curriculumId;
    const curriculum = await this.curriculaService.resolveVigenteCurriculum(
      query.nivel,
      anioEscolar,
      curriculumIdHint,
    );
    const anio = query.anio ?? curriculum.anio;
    let catalog = await this.curriculaService.getCatalog(
      curriculum.id,
      query.nivel,
    );

    const periodosBimestre = await this.periodosService.findAll({
      anioEscolar: anioEscolar,
      tipo: 'bimestre',
      activo: true,
    });
    const periodoSel = periodosBimestre.find((p) => p.numero === query.bimestre);
    let subjectEnCatalogo = query.cursoId
      ? catalog.cursos.find((c) => c.id === query.cursoId && c.activo)
      : undefined;
    if (!subjectEnCatalogo && query.cursoId) {
      const subjectRow = await this.subjectRepo.findOneBy({ id: query.cursoId });
      if (
        subjectRow?.activo &&
        subjectRow.curriculumId === curriculum.id &&
        subjectRow.nivel.trim() === query.nivel.trim()
      ) {
        subjectEnCatalogo = subjectRow;
      }
    }

    const mallaAsignacion = query.cursoId
      ? await this.resolveMallaAsignacion({
          cursoId: query.cursoId,
          nivel: query.nivel,
          grado: query.grado,
          curriculumId: curriculum.id,
          horasFallback: subjectEnCatalogo?.horasSemanales,
        })
      : null;

    let cursosGrado = catalog.cursos.filter(
      (c) =>
        c.nivel === query.nivel &&
        c.activo &&
        Array.isArray(c.grados) &&
        c.grados.some((g) => gradosCoinciden(query.nivel, g, query.grado)),
    );

    if (query.cursoId) {
      cursosGrado = cursosGrado.filter((c) => c.id === query.cursoId);
    }

    const cursoFiltrado =
      cursosGrado[0] ??
      (subjectEnCatalogo && query.cursoId
        ? {
            id: subjectEnCatalogo.id,
            nombre: subjectEnCatalogo.nombre,
            areaId: subjectEnCatalogo.areaId,
            nivel: subjectEnCatalogo.nivel,
            grados: subjectEnCatalogo.grados,
            activo: subjectEnCatalogo.activo,
          }
        : undefined);

    const gradoEnMallaPorGrados = subjectEnCatalogo
      ? (subjectEnCatalogo.grados ?? []).some((g) =>
          gradosCoinciden(query.nivel, g, query.grado),
        )
      : false;
    const gradoEnMalla =
      gradoEnMallaPorGrados || !!mallaAsignacion || cursosGrado.length > 0;
    const cursoEnCatalogo = !!subjectEnCatalogo || !!mallaAsignacion;

    let competenciasCount = query.cursoId
      ? catalog.competencias.filter(
          (c) => c.cursoId === query.cursoId && c.activo,
        ).length
      : 0;

    if (
      query.cursoId &&
      gradoEnMalla &&
      competenciasCount === 0
    ) {
      competenciasCount = await this.curriculaService.ensureCompetenciasForSubject(
        query.cursoId,
      );
      if (competenciasCount > 0) {
        catalog = await this.curriculaService.getCatalog(
          curriculum.id,
          query.nivel,
        );
        cursosGrado = catalog.cursos.filter(
          (c) =>
            c.nivel === query.nivel &&
            c.activo &&
            Array.isArray(c.grados) &&
            c.grados.some((g) => gradosCoinciden(query.nivel, g, query.grado)) &&
            (!query.cursoId || c.id === query.cursoId),
        );
      }
    }

    const validacion = this.buildMallaValidacion({
      query,
      anioEscolar: anio,
      bimestreActual,
      periodosConfigurados: periodosBimestre.length,
      periodoBimestreConfigurado: !!periodoSel,
      cursoEnCatalogo,
      gradoEnMalla,
      competenciasCount,
      cursoNombre:
        cursoFiltrado?.nombre ??
        subjectEnCatalogo?.nombre ??
        (query.cursoId ? `Curso #${query.cursoId}` : 'Curso'),
      mallaAsignacion,
    });

    const cursoIds = new Set(cursosGrado.map((c) => c.id));
    const competencias = catalog.competencias.filter((c) =>
      cursoIds.has(c.cursoId),
    );

    const areaMap = new Map<number, AreaMatrixItem>();
    for (const area of catalog.areas.filter((a) => a.nivel === query.nivel)) {
      areaMap.set(area.id, {
        id: area.id,
        nombre: area.nombre,
        emoji: areaEmoji(area.nombre),
        competencias: [],
      });
    }

    for (const curso of cursosGrado) {
      const area = areaMap.get(curso.areaId);
      if (!area) continue;
      const comps = competencias
        .filter((c) => c.cursoId === curso.id)
        .sort((a, b) => a.id - b.id);
      for (const comp of comps) {
        const idx = area.competencias.length + 1;
        area.competencias.push({
          id: comp.id,
          cursoId: comp.cursoId,
          codigo: `${areaAbrev(area.nombre)}.${idx}`,
          nombre: comp.nombre,
          short: competenciaShort(comp.nombre),
        });
      }
    }

    let areas = [...areaMap.values()].filter((a) => a.competencias.length > 0);
    if (query.areaId) {
      areas = areas.filter((a) => a.id === query.areaId);
    }

    const alumnos = await this.filterStudents(
      query.nivel,
      query.grado,
      query.seccion,
      institutionId,
    );
    const competenciaIds = areas.flatMap((a) =>
      a.competencias.map((c) => c.id),
    );
    const studentIds = alumnos.map((a) => a.id);
    const bimestreHabilitado = query.bimestre <= bimestreActual;

    const evaluaciones =
      competenciaIds.length &&
      studentIds.length &&
      bimestreHabilitado &&
      validacion.codigo === 'ok'
        ? await this.evalRepo.find({
            where: {
              anio,
              bimestre: query.bimestre,
              competenciaId: In(competenciaIds),
              studentId: In(studentIds),
            },
          })
        : [];

    const actaCerrada = await this.isActaCerrada(
      query.nivel,
      query.grado,
      query.seccion,
      query.bimestre,
    );
    const validacionFinal = actaCerrada
      ? {
          ...validacion,
          actaCerrada: true,
          edicionBloqueada: true,
          codigo: 'acta_cerrada' as const,
          mensaje:
            'El acta de este salón y bimestre está cerrada. Las calificaciones por competencia no pueden modificarse.',
        }
      : { ...validacion, actaCerrada: false, edicionBloqueada: false };

    return {
      curriculum: {
        id: curriculum.id,
        anio: curriculum.anio,
        nivel: curriculum.nivel,
        tipoEscala: curriculum.tipoEscala,
        tipoPeriodo: curriculum.tipoPeriodo,
      },
      bimestre: query.bimestre,
      bimestreActual,
      bimestreHabilitado,
      cursoId: cursoFiltrado?.id ?? query.cursoId,
      cursoNombre: cursoFiltrado?.nombre ?? subjectEnCatalogo?.nombre,
      nivel: query.nivel,
      grado: query.grado,
      seccion: query.seccion,
      areas,
      alumnos,
      evaluaciones: evaluaciones.map((e) => ({
        id: e.id,
        studentId: e.studentId,
        competenciaId: e.competenciaId,
        bimestre: e.bimestre,
        anio: e.anio,
        nivelLogro: e.nivelLogro,
      })),
      validacion: validacionFinal,
    };
  }

  private async resolveMallaAsignacion(input: {
    cursoId: number;
    nivel: string;
    grado: string;
    curriculumId: number;
    horasFallback?: number;
  }): Promise<{ docenteNombre: string; horasSemanales: number } | null> {
    const grado = normalizeGradoMatricula(input.grado);
    const assignments = await this.assignmentRepo.find({
      where: { cursoId: input.cursoId, activo: true },
      order: { id: 'ASC' },
    });

    const match =
      assignments.find(
        (a) =>
          a.nivel.trim() === input.nivel.trim() &&
          normalizeGradoMatricula(a.grado) === grado &&
          (a.curriculumId == null || a.curriculumId === input.curriculumId),
      ) ??
      assignments.find(
        (a) =>
          a.nivel.trim() === input.nivel.trim() &&
          normalizeGradoMatricula(a.grado) === grado,
      );
    if (!match) return null;

    const horas =
      match.horasSemanales > 0
        ? match.horasSemanales
        : (input.horasFallback ?? 0);

    return { docenteNombre: match.docenteNombre, horasSemanales: horas };
  }

  private buildMallaValidacion(input: {
    query: {
      nivel: string;
      grado: string;
      bimestre: number;
      cursoId?: number;
    };
    anioEscolar: number;
    bimestreActual: number;
    periodosConfigurados: number;
    periodoBimestreConfigurado: boolean;
    cursoEnCatalogo: boolean;
    gradoEnMalla: boolean;
    competenciasCount: number;
    cursoNombre: string;
    mallaAsignacion: { docenteNombre: string; horasSemanales: number } | null;
  }): CompetencyMatrixValidation {
    const {
      query,
      anioEscolar,
      bimestreActual,
      periodosConfigurados,
      periodoBimestreConfigurado,
      cursoEnCatalogo,
      gradoEnMalla,
      competenciasCount,
      cursoNombre,
      mallaAsignacion,
    } = input;

    const bimestreHabilitado = query.bimestre <= bimestreActual;
    const cursoEnMalla = cursoEnCatalogo && gradoEnMalla;
    const competenciasConfiguradas = competenciasCount > 0;
    const mallaDetalle = mallaAsignacion
      ? `${mallaAsignacion.horasSemanales}h · ${this.abrevDocente(mallaAsignacion.docenteNombre)}`
      : null;

    let codigo: CompetencyMatrixValidation['codigo'] = 'ok';
    let mensaje = '';

    if (!bimestreHabilitado) {
      codigo = 'bimestre_no_habilitado';
      mensaje = `El ${query.bimestre}° bimestre aún no está habilitado. Periodo actual: ${bimestreActual}° bimestre.`;
    } else if (!periodoBimestreConfigurado) {
      codigo = 'periodo_no_configurado';
      mensaje = `El ${query.bimestre}° bimestre no está configurado en Períodos académicos (A.E. ${anioEscolar}). Configure los ${periodosConfigurados || 4} bimestres del año escolar.`;
    } else if (query.cursoId && !cursoEnCatalogo && !mallaAsignacion) {
      codigo = 'curso_no_malla';
      mensaje = `"${cursoNombre}" no figura en la malla curricular de ${query.nivel} (A.E. ${anioEscolar}). No puede registrarse en el ${query.bimestre}° bimestre.`;
    } else if (query.cursoId && cursoEnCatalogo && !gradoEnMalla) {
      codigo = 'grado_no_malla';
      mensaje = `"${cursoNombre}" está en la currícula pero no aplica al grado ${query.grado}. Verifique la columna del grado en Currículas → Malla curricular antes del ${query.bimestre}° bimestre.`;
    } else if (query.cursoId && cursoEnMalla && !competenciasConfiguradas) {
      codigo = 'sin_competencias';
      if (mallaDetalle) {
        mensaje = `"${cursoNombre}" está en la malla de ${query.grado} (${mallaDetalle}) pero no tiene competencias cargadas. Vaya a Currículas → Competencias para registrar el ${query.bimestre}° bimestre.`;
      } else {
        mensaje = `"${cursoNombre}" está en la malla de ${query.grado} pero no tiene competencias cargadas. Vaya a Currículas → Competencias para el ${query.bimestre}° bimestre.`;
      }
    }

    return {
      cursoEnMalla,
      gradoEnMalla,
      competenciasConfiguradas,
      competenciasCount,
      bimestre: query.bimestre,
      bimestreActual,
      bimestreHabilitado,
      anioEscolar,
      periodosConfigurados,
      periodoBimestreConfigurado,
      mallaHoras: mallaAsignacion?.horasSemanales ?? null,
      mallaDocente: mallaAsignacion
        ? this.abrevDocente(mallaAsignacion.docenteNombre)
        : null,
      enMallaPorAsignacion: !!mallaAsignacion,
      codigo,
      mensaje,
    };
  }

  private abrevDocente(nombreCompleto: string): string {
    const partes = nombreCompleto.trim().split(/\s+/);
    if (partes.length >= 2) return `${partes[0]} ${partes[1]}`;
    return nombreCompleto.trim();
  }

  async getStudentProfile(
    studentId: number,
    query: { bimestre: number; anio?: number; curriculumId?: number },
  ): Promise<StudentCompetencyProfile> {
    const student = await this.studentsService.findOne(studentId);
    if (!student.activo || student.estadoMatricula !== 'activo') {
      throw new NotFoundException('Estudiante no activo');
    }

    const anio = query.anio ?? new Date().getFullYear();
    const matrix = await this.getMatrix({
      nivel: student.nivel,
      grado: student.grado,
      seccion: student.seccion,
      bimestre: query.bimestre,
      anio,
      curriculumId: query.curriculumId,
    });

    const evalMap = new Map(
      matrix.evaluaciones
        .filter((e) => e.studentId === studentId)
        .map((e) => [e.competenciaId, e.nivelLogro]),
    );

    const areas = matrix.areas.map((area) => {
      const niveles = area.competencias
        .map((c) => evalMap.get(c.id))
        .filter(Boolean) as NivelLogro[];
      return {
        ...area,
        promedio: calcPromedioNivel(niveles),
        evaluaciones: area.competencias.map((c) => ({
          competenciaId: c.id,
          nivelLogro: evalMap.get(c.id) ?? null,
        })),
      };
    });

    const allNiveles = areas.flatMap((a) =>
      a.evaluaciones.map((e) => e.nivelLogro).filter(Boolean),
    ) as NivelLogro[];

    return {
      student: {
        id: student.id,
        nombre: `${student.nombre} ${student.apellido}`.trim(),
        grado: student.grado,
        seccion: student.seccion,
      },
      bimestre: query.bimestre,
      anio,
      areas,
      promedioGlobal: calcPromedioNivel(allNiveles),
    };
  }

  async computeAreaAverages(query: {
    nivel: string;
    grado: string;
    seccion: string;
    area?: string;
    busqueda?: string;
    bimestreActual: number;
    anio?: number;
  }) {
    const anio = query.anio ?? new Date().getFullYear();
    const matrix = await this.getMatrix({
      nivel: query.nivel,
      grado: query.grado,
      seccion: query.seccion,
      bimestre: 1,
      anio,
    });

    let areasMatrix = matrix.areas;
    if (query.area) {
      areasMatrix = areasMatrix.filter((a) => a.nombre === query.area);
    }

    let alumnos = matrix.alumnos;
    if (query.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      alumnos = alumnos.filter((a) => a.nombre.toLowerCase().includes(q));
    }

    const competenciaIds = areasMatrix.flatMap((a) =>
      a.competencias.map((c) => c.id),
    );
    const studentIds = alumnos.map((a) => a.id);
    const bimestres = [1, 2, 3, 4].filter((b) => b <= query.bimestreActual);

    const evaluaciones =
      competenciaIds.length && studentIds.length && bimestres.length
        ? await this.evalRepo.find({
            where: {
              anio,
              competenciaId: In(competenciaIds),
              studentId: In(studentIds),
              bimestre: In(bimestres),
            },
          })
        : [];

    const evalKey = (studentId: number, competenciaId: number, bimestre: number) =>
      `${studentId}|${competenciaId}|${bimestre}`;
    const evalMap = new Map(
      evaluaciones.map((e) => [
        evalKey(e.studentId, e.competenciaId, e.bimestre),
        e.nivelLogro,
      ]),
    );

    const nivelAreaBimestre = (
      studentId: number,
      area: (typeof areasMatrix)[number],
      bimestre: number,
    ): NivelLogro | null => {
      if (bimestre > query.bimestreActual) return null;
      const niveles = area.competencias
        .map((c) => evalMap.get(evalKey(studentId, c.id, bimestre)))
        .filter(Boolean) as NivelLogro[];
      return calcPromedioNivel(niveles);
    };

    const alumnosResult = alumnos.map((alumno) => {
      const areas = areasMatrix.map((area) => {
        const b1 = nivelAreaBimestre(alumno.id, area, 1);
        const b2 = nivelAreaBimestre(alumno.id, area, 2);
        const b3 = nivelAreaBimestre(alumno.id, area, 3);
        const b4 = nivelAreaBimestre(alumno.id, area, 4);
        const parciales = [b1, b2, b3, b4]
          .slice(0, query.bimestreActual)
          .filter(Boolean) as NivelLogro[];
        return {
          area: area.nombre,
          b1,
          b2,
          b3,
          b4,
          promedioParcial: calcPromedioNivel(parciales),
        };
      });

      const allNiveles = areas.flatMap((a) =>
        [a.b1, a.b2, a.b3, a.b4]
          .slice(0, query.bimestreActual)
          .filter(Boolean),
      ) as NivelLogro[];

      return {
        studentId: alumno.id,
        estudiante: alumno.nombre,
        nivel: query.nivel,
        grado: query.grado,
        seccion: query.seccion,
        areas,
        promedioGeneral: calcPromedioNivel(allNiveles),
      };
    });

    const rank = (n: NivelLogro | null) =>
      ({ AD: 4, A: 3, B: 2, C: 1 } as Record<NivelLogro, number>)[n ?? 'C'] ?? 0;
    alumnosResult.sort(
      (a, b) => rank(b.promedioGeneral) - rank(a.promedioGeneral),
    );

    const nivelesGlobales = alumnosResult
      .map((a) => a.promedioGeneral)
      .filter(Boolean) as NivelLogro[];

    return {
      anio,
      areasDisponibles: areasMatrix.map((a) => a.nombre),
      alumnos: alumnosResult,
      resumen: {
        totalAlumnos: alumnosResult.length,
        promedioAula: calcPromedioNivel(nivelesGlobales),
        aprobados: alumnosResult.filter(
          (a) => a.promedioGeneral && a.promedioGeneral !== 'C',
        ).length,
        enRiesgo: alumnosResult.filter((a) => a.promedioGeneral === 'C').length,
        destacados: alumnosResult.filter((a) => a.promedioGeneral === 'AD').length,
      },
    };
  }

  async saveBulk(
    dto: SaveCompetencyEvaluationsBulkDto,
    user?: RequestUser,
    institutionId?: number,
  ) {
    const esDocentePortal = this.esDocentePortal(user);
    if (!this.canRegister(user)) {
      throw new ForbiddenException(
        'No tiene permiso para registrar calificaciones por competencia',
      );
    }
    if (esDocentePortal) {
      if (!dto.cursoId) {
        throw new BadRequestException(
          'Debe indicar el curso asignado para registrar competencias',
        );
      }
      await this.assertDocenteAsignado(user!, {
        nivel: dto.nivel,
        grado: dto.grado,
        seccion: dto.seccion,
        cursoId: dto.cursoId,
      });
    }

    await this.assertActaEditable(dto);

    const bimestreActual = await this.periodosService.resolveBimestreActual();
    if (dto.bimestre > bimestreActual) {
      throw new BadRequestException(
        `El bimestre ${dto.bimestre} aún no está habilitado. Periodo actual: ${bimestreActual}° bimestre.`,
      );
    }

    const curriculumIdHint = dto.cursoId
      ? await this.resolveCurriculumIdHint({
          cursoId: dto.cursoId,
          nivel: dto.nivel,
          grado: dto.grado,
          anioEscolar: dto.anio ?? (await this.periodosService.resolveAnioEscolarActual()),
          curriculumId: dto.curriculumId,
          docenteUserId: esDocentePortal ? +user!.id : undefined,
        })
      : dto.curriculumId;
    const curriculum = await this.curriculaService.resolveVigenteCurriculum(
      dto.nivel,
      dto.anio ?? (await this.periodosService.resolveAnioEscolarActual()),
      curriculumIdHint,
    );
    const anio = dto.anio ?? curriculum.anio;

    const matrix = await this.getMatrix(
      {
        nivel: dto.nivel,
        grado: dto.grado,
        seccion: dto.seccion,
        bimestre: dto.bimestre,
        anio,
        curriculumId: curriculum.id,
        cursoId: dto.cursoId,
      },
      user,
      institutionId,
    );

    if (matrix.validacion.codigo === 'acta_cerrada') {
      throw new BadRequestException(matrix.validacion.mensaje);
    }

    const allowedCompetencias = new Set(
      matrix.areas.flatMap((a) => a.competencias.map((c) => c.id)),
    );
    const allowedStudents = new Set(matrix.alumnos.map((a) => a.id));
    const auditCtx = {
      actorUserId: user?.id ? Number(user.id) : null,
      actorNombre: user?.username ?? '',
      actorRol: user?.rolPrincipal ?? '',
      motivo: dto.motivo?.trim() || 'Registro masivo por competencia',
    };

    let saved = 0;
    let deleted = 0;

    await this.evalRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(CompetencyEvaluation);

      for (const entry of dto.entries) {
        if (!allowedStudents.has(entry.studentId)) {
          throw new BadRequestException(
            `El estudiante ${entry.studentId} no pertenece al aula indicada o no tiene matrícula activa`,
          );
        }
        if (dto.cursoId && !allowedCompetencias.has(entry.competenciaId)) {
          throw new BadRequestException(
            'Solo puede calificar competencias del curso o área autorizada',
          );
        }

        const student = await this.studentsService.findOne(entry.studentId);
        const institutionId = student.institutionId ?? null;

        const existing = entry.evaluationId
          ? await repo.findOneBy({ id: entry.evaluationId })
          : await repo.findOne({
              where: {
                studentId: entry.studentId,
                competenciaId: entry.competenciaId,
                bimestre: dto.bimestre,
                anio,
              },
            });

        if (!entry.nivelLogro) {
          if (existing) {
            await this.changeAudit.recordChange(
              'eliminar',
              existing,
              {
                nivelLogro: {
                  anterior: existing.nivelLogro,
                  nuevo: null,
                },
              },
              { ...auditCtx, institutionId },
            );
            await repo.remove(existing);
            deleted++;
          }
          continue;
        }

        if (existing) {
          const before = existing.nivelLogro;
          existing.nivelLogro = entry.nivelLogro;
          existing.curriculumId = curriculum.id;
          existing.institutionId = institutionId;
          existing.registradoPor = user?.id ? Number(user.id) : existing.registradoPor;
          existing.observacion = entry.observacion?.trim() || existing.observacion;
          const row = await repo.save(existing);
          if (before !== row.nivelLogro) {
            await this.changeAudit.recordChange(
              'actualizar',
              row,
              { nivelLogro: { anterior: before, nuevo: row.nivelLogro } },
              { ...auditCtx, institutionId },
            );
          }
        } else {
          const row = await repo.save(
            repo.create({
              studentId: entry.studentId,
              competenciaId: entry.competenciaId,
              curriculumId: curriculum.id,
              institutionId,
              bimestre: dto.bimestre,
              anio,
              nivelLogro: entry.nivelLogro,
              registradoPor: user?.id ? Number(user.id) : undefined,
              observacion: entry.observacion?.trim() || undefined,
            }),
          );
          await this.changeAudit.recordChange(
            'crear',
            row,
            { nivelLogro: { nuevo: row.nivelLogro } },
            { ...auditCtx, institutionId },
          );
        }
        saved++;
      }
    });

    if (dto.cursoId && matrix.cursoNombre) {
      const compIds = matrix.areas.flatMap((a) => a.competencias.map((c) => c.id));
      const syncRows = await this.evalRepo.find({
        where: {
          anio,
          bimestre: dto.bimestre,
          competenciaId: In(compIds),
          studentId: In(matrix.alumnos.map((a) => a.id)),
        },
      });
      const byStudent = new Map<number, NivelLogro[]>();
      for (const row of syncRows) {
        const list = byStudent.get(row.studentId) ?? [];
        list.push(row.nivelLogro);
        byStudent.set(row.studentId, list);
      }
      await this.promediosService.syncCompetencyCoursePromedios({
        cursoNombre: matrix.cursoNombre,
        bimestre: dto.bimestre,
        anio,
        alumnos: matrix.alumnos.map((a) => ({
          studentId: a.id,
          nivelLogro: calcPromedioNivel(byStudent.get(a.id) ?? []),
        })),
      });
    }

    return { saved, deleted, bimestre: dto.bimestre, anio };
  }

  async seedIfEmpty(): Promise<number> {
    if (await this.evalRepo.count()) return 0;

    try {
      const matrix = await this.getMatrix({
        nivel: 'Primaria',
        grado: '4°',
        seccion: 'A',
        bimestre: 1,
      });

      if (!matrix.alumnos.length || !matrix.areas.length) return 0;

      const niveles: NivelLogro[] = ['AD', 'A', 'A', 'B', 'B', 'C'];
      const rows: CompetencyEvaluation[] = [];

      for (const alumno of matrix.alumnos) {
        for (const area of matrix.areas) {
          for (const comp of area.competencias) {
            for (let bim = 1; bim <= 4; bim++) {
              const idx =
                (alumno.id * 11 + comp.id * 7 + bim * 3 + area.id * 5) %
                niveles.length;
              rows.push(
                this.evalRepo.create({
                  studentId: alumno.id,
                  competenciaId: comp.id,
                  curriculumId: matrix.curriculum.id,
                  bimestre: bim,
                  anio: matrix.curriculum.anio,
                  nivelLogro: niveles[idx],
                }),
              );
            }
          }
        }
      }

      await this.evalRepo.save(rows, { chunk: 200 });
      return rows.length;
    } catch {
      return 0;
    }
  }

  /** Usa la currícula de la asignación docente o del curso antes del catálogo activo genérico. */
  private async resolveCurriculumIdHint(input: {
    cursoId: number;
    nivel: string;
    grado: string;
    anioEscolar: number;
    curriculumId?: number;
    docenteUserId?: number;
  }): Promise<number | undefined> {
    if (input.curriculumId) return input.curriculumId;

    const grado = normalizeGradoMatricula(input.grado);
    const assignments = await this.assignmentRepo.find({
      where: { cursoId: input.cursoId, activo: true },
      order: { id: 'ASC' },
    });
    const contextMatches = assignments.filter(
      (a) =>
        a.nivel.trim() === input.nivel.trim() &&
        normalizeGradoMatricula(a.grado) === grado &&
        a.curriculumId != null,
    );

    let candidates = contextMatches;
    if (input.docenteUserId) {
      const docente = await this.docenteRepo.findOne({
        where: { userId: +input.docenteUserId, estado: 'activo' },
      });
      if (docente) {
        const mine = contextMatches.filter((a) => a.docenteId === docente.id);
        if (mine.length) candidates = mine;
      }
    }

    const fromAssignment = await this.curriculaService.pickPreferredCurriculumId(
      candidates.map((a) => a.curriculumId!),
      input.nivel,
      input.anioEscolar,
    );
    if (fromAssignment) return fromAssignment;

    const subject = await this.subjectRepo.findOneBy({ id: input.cursoId });
    if (
      subject?.curriculumId &&
      subject.nivel.trim() === input.nivel.trim()
    ) {
      return subject.curriculumId;
    }

    return undefined;
  }

  private async assertActaEditable(
    dto: Pick<
      SaveCompetencyEvaluationsBulkDto,
      'nivel' | 'grado' | 'seccion' | 'bimestre'
    >,
  ): Promise<void> {
    if (await this.isActaCerrada(dto.nivel, dto.grado, dto.seccion, dto.bimestre)) {
      throw new BadRequestException(
        'El acta de este salón y bimestre está cerrada. Las calificaciones por competencia no pueden modificarse.',
      );
    }
  }

  private async isActaCerrada(
    nivel: string,
    grado: string,
    seccion: string,
    bimestre: number,
  ): Promise<boolean> {
    const anio = String(await this.periodosService.resolveAnioEscolarActual());
    const acta = await this.actaRepo.findOne({
      where: {
        nivel: nivel.trim(),
        grado: grado.trim(),
        seccion: seccion.trim().toUpperCase(),
        bimestre,
        anio,
      },
    });
    return acta?.estado === 'cerrada';
  }

  private canConsult(user?: RequestUser): boolean {
    return (
      !!user?.permisos?.includes('evaluacion.ver') ||
      !!user?.permisos?.includes('evaluacion.registrar') ||
      !!user?.permisos?.includes('evaluacion.editar')
    );
  }

  private canRegister(user?: RequestUser): boolean {
    return (
      !!user?.permisos?.includes('evaluacion.registrar') ||
      !!user?.permisos?.includes('evaluacion.editar')
    );
  }

  private async filterStudents(
    nivel: string,
    grado: string,
    seccion: string,
    institutionId?: number,
  ): Promise<AlumnoMatrixItem[]> {
    const students = await this.studentsService.findAll(institutionId);
    return listStudentsForAula(students, nivel, grado, seccion).map((s) => ({
      id: s.id,
      nombre: `${s.nombre} ${s.apellido}`.trim(),
      grado: s.grado,
      seccion: s.seccion,
    }));
  }

  private esDocentePortal(user?: RequestUser): boolean {
    if (!user || user.esAdmin) return false;
    return user.roles.includes('DOCENTE');
  }

  private async assertDocenteAsignado(
    user: RequestUser,
    query: {
      nivel: string;
      grado: string;
      seccion: string;
      cursoId: number;
    },
  ): Promise<void> {
    const docente = await this.docenteRepo.findOne({
      where: { userId: +user.id, estado: 'activo' },
    });
    if (!docente) {
      throw new ForbiddenException(
        'No hay un docente activo vinculado a este usuario',
      );
    }

    const seccion = query.seccion.trim().toUpperCase();
    const grado = normalizeGradoMatricula(query.grado);
    const assignments = await this.assignmentRepo.find({
      where: { docenteId: docente.id, activo: true, cursoId: query.cursoId },
    });

    const ok = assignments.some(
      (a) =>
        a.nivel.trim() === query.nivel.trim() &&
        normalizeGradoMatricula(a.grado) === grado &&
        (a.secciones ?? []).some((s) => s.trim().toUpperCase() === seccion),
    );

    if (!ok) {
      throw new ForbiddenException(
        'No tiene asignación activa para calificar este curso en el salón indicado',
      );
    }
  }
}
