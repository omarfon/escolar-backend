import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurriculaService } from '../curricula/curricula.service';
import { Curriculum } from '../curricula/entities/curriculum.entity';
import { StudentsService } from '../students/students.service';
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

export interface CompetencyMatrixResponse {
  curriculum: Pick<
    Curriculum,
    'id' | 'anio' | 'nivel' | 'tipoEscala' | 'tipoPeriodo'
  >;
  bimestre: number;
  nivel: string;
  grado: string;
  seccion: string;
  areas: AreaMatrixItem[];
  alumnos: AlumnoMatrixItem[];
  evaluaciones: EvaluacionMatrixItem[];
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
    private readonly studentsService: StudentsService,
    private readonly curriculaService: CurriculaService,
  ) {}

  async getMatrix(query: {
    nivel: string;
    grado: string;
    seccion: string;
    bimestre: number;
    anio?: number;
    curriculumId?: number;
    areaId?: number;
  }): Promise<CompetencyMatrixResponse> {
    const curriculum = await this.resolveCurriculum(
      query.nivel,
      query.anio ?? new Date().getFullYear(),
      query.curriculumId,
    );
    const anio = query.anio ?? curriculum.anio;
    const catalog = await this.curriculaService.getCatalog(
      curriculum.id,
      query.nivel,
    );

    const cursosGrado = catalog.cursos.filter(
      (c) =>
        c.nivel === query.nivel &&
        c.activo &&
        Array.isArray(c.grados) &&
        c.grados.some((g) => gradosCoinciden(query.nivel, g, query.grado)),
    );
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

    const compByArea = new Map<number, number>();
    for (const curso of cursosGrado) {
      const area = areaMap.get(curso.areaId);
      if (!area) continue;
      const comps = competencias
        .filter((c) => c.cursoId === curso.id)
        .sort((a, b) => a.id - b.id);
      for (const comp of comps) {
        compByArea.set(comp.id, curso.areaId);
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
    );
    const competenciaIds = areas.flatMap((a) =>
      a.competencias.map((c) => c.id),
    );
    const studentIds = alumnos.map((a) => a.id);

    const evaluaciones =
      competenciaIds.length && studentIds.length
        ? await this.evalRepo.find({
            where: {
              anio,
              bimestre: query.bimestre,
              competenciaId: In(competenciaIds),
              studentId: In(studentIds),
            },
          })
        : [];

    return {
      curriculum: {
        id: curriculum.id,
        anio: curriculum.anio,
        nivel: curriculum.nivel,
        tipoEscala: curriculum.tipoEscala,
        tipoPeriodo: curriculum.tipoPeriodo,
      },
      bimestre: query.bimestre,
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
    };
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

  async saveBulk(dto: SaveCompetencyEvaluationsBulkDto) {
    const curriculum = await this.resolveCurriculum(
      dto.nivel,
      dto.anio ?? new Date().getFullYear(),
      dto.curriculumId,
    );
    const anio = dto.anio ?? curriculum.anio;

    let saved = 0;
    let deleted = 0;

    for (const entry of dto.entries) {
      const existing = entry.evaluationId
        ? await this.evalRepo.findOneBy({ id: entry.evaluationId })
        : await this.evalRepo.findOne({
            where: {
              studentId: entry.studentId,
              competenciaId: entry.competenciaId,
              bimestre: dto.bimestre,
              anio,
            },
          });

      if (!entry.nivelLogro) {
        if (existing) {
          await this.evalRepo.remove(existing);
          deleted++;
        }
        continue;
      }

      if (existing) {
        existing.nivelLogro = entry.nivelLogro;
        existing.curriculumId = curriculum.id;
        await this.evalRepo.save(existing);
      } else {
        await this.evalRepo.save(
          this.evalRepo.create({
            studentId: entry.studentId,
            competenciaId: entry.competenciaId,
            curriculumId: curriculum.id,
            bimestre: dto.bimestre,
            anio,
            nivelLogro: entry.nivelLogro,
          }),
        );
      }
      saved++;
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

  private async resolveCurriculum(
    nivel: string,
    anio: number,
    curriculumId?: number,
  ): Promise<Curriculum> {
    if (curriculumId) {
      const catalog = await this.curriculaService.getCatalog(curriculumId);
      const found = catalog.curriculas.find((c) => c.id === curriculumId);
      if (!found) {
        throw new NotFoundException(`Currícula ${curriculumId} no encontrada`);
      }
      if (found.nivel === nivel) {
        return found;
      }
    }

    let curriculas = await this.curriculaService.findCurriculas({
      anio,
      nivel,
      estado: 'activo',
    });
    if (!curriculas.length) {
      curriculas = await this.curriculaService.findCurriculas({
        nivel,
        estado: 'activo',
      });
    }
    const curriculum = curriculas[0];
    if (!curriculum) {
      throw new BadRequestException(
        `No hay currícula activa para ${nivel}`,
      );
    }
    return curriculum;
  }

  private async filterStudents(
    nivel: string,
    grado: string,
    seccion: string,
  ): Promise<AlumnoMatrixItem[]> {
    const students = await this.studentsService.findAll();
    return students
      .filter((s) => s.activo && s.estadoMatricula === 'activo')
      .filter((s) => s.nivel === nivel)
      .filter((s) => gradosCoinciden(nivel, s.grado, grado))
      .filter((s) => s.seccion.toUpperCase() === seccion.toUpperCase())
      .sort((a, b) =>
        `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`),
      )
      .map((s) => ({
        id: s.id,
        nombre: `${s.nombre} ${s.apellido}`.trim(),
        grado: s.grado,
        seccion: s.seccion,
      }));
  }
}
