import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Salon } from './entities/salon.entity';
import { CreateSalonDto, SyncSalonesDto, UpdateSalonDto } from './dto/salon.dto';
import { Student } from '../../students/entities/student.entity';
import { EducationLevel } from '../../institution/entities/education-level.entity';
import { GradeLevel } from '../../institution/entities/grade-level.entity';
import { GradeSection } from '../../institution/entities/grade-section.entity';
import {
  defaultAforoForNivel,
  gradoInstitucionalToMatricula,
  isIngresanteGrade,
  normalizeGradoMatricula,
} from './salones.util';
import { CatalogCacheService } from '../../common/catalog-cache.service';
import { MaestroAnioEscolar } from '../anios-escolares/entities/maestro-anio-escolar.entity';
import {
  applyInstitutionIdWhere,
  assertMaestroBelongsToInstitution,
  filterAniosEscolaresPorInstitucion,
  MaestrosAuthRequest,
  requireMaestrosInstitutionId,
  resolveMaestrosAniosEscolares,
} from '../common/maestros-tenant.util';

export interface SalonResponse {
  id: number;
  anioEscolar: number;
  nivel: string;
  grado: string;
  seccion: string;
  aforo: number;
  activo: boolean;
  esIngresante: boolean;
}

export interface VacancyResponse extends SalonResponse {
  matriculados: number;
  pendientesContinuidad: number;
  ocupados: number;
  /** Aforo − matriculados (puede ser negativo si hay sobreocupacion) */
  vacantesActuales: number;
  /** max(0, vacantesActuales) */
  disponibles: number;
  estado: 'disponible' | 'completa' | 'sobreocupada';
}

export interface SectionOccupancyItem {
  seccion: string;
  matriculados: number;
  capacidad: number;
  disponibles: number;
  esIngresante: boolean;
}

@Injectable()
export class SalonesService {
  constructor(
    @InjectRepository(Salon)
    private readonly salonRepo: Repository<Salon>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(EducationLevel)
    private readonly nivelRepo: Repository<EducationLevel>,
    @InjectRepository(GradeLevel)
    private readonly gradoRepo: Repository<GradeLevel>,
    @InjectRepository(GradeSection)
    private readonly seccionRepo: Repository<GradeSection>,
    private readonly catalogCache: CatalogCacheService,
    @InjectRepository(MaestroAnioEscolar)
    private readonly anioEscolarRepo: Repository<MaestroAnioEscolar>,
  ) {}

  async findAll(
    query?: {
      anioEscolar?: number;
      nivel?: string;
      grado?: string;
      activo?: boolean;
    },
    req?: MaestrosAuthRequest,
  ): Promise<SalonResponse[]> {
    const scope = req
      ? await resolveMaestrosAniosEscolares(req, this.anioEscolarRepo)
      : null;
    const institutionId = scope?.institutionId;
    const aniosInstitucion = scope?.anios;
    if (req && !scope) return [];

    const cacheKey = `salones:list:${JSON.stringify({ ...query, institutionId, aniosInstitucion })}`;
    return this.catalogCache.wrap(cacheKey, () =>
      this.findAllUncached(query, institutionId, aniosInstitucion),
    );
  }

  private async findAllUncached(
    query?: {
      anioEscolar?: number;
      nivel?: string;
      grado?: string;
      activo?: boolean;
    },
    institutionId?: number,
    aniosInstitucion?: number[],
  ): Promise<SalonResponse[]> {
    const aniosFiltrados =
      aniosInstitucion !== undefined
        ? filterAniosEscolaresPorInstitucion(aniosInstitucion, query?.anioEscolar)
        : undefined;
    if (aniosFiltrados !== undefined && !aniosFiltrados.length) return [];

    const qb = this.salonRepo
      .createQueryBuilder('s')
      .orderBy('s.nivel', 'ASC')
      .addOrderBy('s.grado', 'ASC')
      .addOrderBy('s.seccion', 'ASC');

    applyInstitutionIdWhere(qb, 's', institutionId);

    if (aniosFiltrados?.length) {
      qb.andWhere('s.anioEscolar IN (:...aniosInstitucion)', {
        aniosInstitucion: aniosFiltrados,
      });
    } else if (query?.anioEscolar) {
      qb.andWhere('s.anioEscolar = :anio', { anio: query.anioEscolar });
    }
    if (query?.nivel) qb.andWhere('s.nivel = :nivel', { nivel: query.nivel });
    if (query?.grado) {
      const gradoNorm = normalizeGradoMatricula(query.grado);
      qb.andWhere('(s.grado = :gradoNorm OR s.grado LIKE :gradoPrefix)', {
        gradoNorm,
        gradoPrefix: `${gradoNorm}%`,
      });
    }
    if (query?.activo !== undefined) {
      qb.andWhere('s.activo = :activo', { activo: query.activo });
    }

    const rows = await qb.getMany();
    return rows.map((r) => this.toSalonResponse(r));
  }

  async findVacancies(
    query?: {
      anioEscolar?: number;
      nivel?: string;
      grado?: string;
    },
    req?: MaestrosAuthRequest,
  ): Promise<VacancyResponse[]> {
    const anio = query?.anioEscolar ?? new Date().getFullYear();
    const salones = await this.findAll(
      {
        anioEscolar: anio,
        nivel: query?.nivel,
        grado: query?.grado,
        activo: true,
      },
      req,
    );

    const scope = req
      ? await resolveMaestrosAniosEscolares(req, this.anioEscolarRepo)
      : null;
    const studentCounts = await this.countStudentsBySection(scope?.institutionId);

    return salones.map((salon) => {
      const key = this.sectionKey(salon.nivel, salon.grado, salon.seccion);
      const matriculados = studentCounts.get(key) ?? 0;
      /** Vacantes actuales = aforo del maestro salones − alumnos matriculados en ese salon */
      const vacantesActuales = salon.aforo - matriculados;
      const disponibles = Math.max(0, vacantesActuales);
      let estado: VacancyResponse['estado'] = 'disponible';
      if (matriculados > salon.aforo) estado = 'sobreocupada';
      else if (matriculados >= salon.aforo) estado = 'completa';

      return {
        ...salon,
        matriculados,
        pendientesContinuidad: 0,
        ocupados: matriculados,
        disponibles,
        vacantesActuales,
        estado,
      };
    });
  }

  async getSectionOccupancy(
    nivel: string,
    grado: string,
    anioEscolar?: number,
  ): Promise<SectionOccupancyItem[]> {
    return this.getSectionOccupancyForInstitution(undefined, nivel, grado, anioEscolar);
  }

  async getSectionOccupancyForInstitution(
    institutionId: number | undefined,
    nivel: string,
    grado: string,
    anioEscolar?: number,
  ): Promise<SectionOccupancyItem[]> {
    const gradoNorm = normalizeGradoMatricula(grado);
    const anio = anioEscolar ?? new Date().getFullYear();
    const salones = await this.findAllUncached(
      { anioEscolar: anio, nivel, grado: gradoNorm, activo: true },
      institutionId,
    );
    const studentCounts = await this.countStudentsBySection(institutionId);
    const esIngresante = isIngresanteGrade(nivel, gradoNorm);

    return salones
      .map((salon) => {
        const key = this.sectionKey(salon.nivel, salon.grado, salon.seccion);
        const matriculados = studentCounts.get(key) ?? 0;
        const disponibles = Math.max(0, salon.aforo - matriculados);
        return {
          seccion: salon.seccion.trim().toUpperCase(),
          matriculados,
          capacidad: salon.aforo,
          disponibles,
          esIngresante,
        };
      })
      .sort((a, b) => a.seccion.localeCompare(b.seccion));
  }

  async assertVacancyAvailable(
    nivel: string,
    grado: string,
    seccion: string,
    anioEscolar: number,
  ): Promise<void> {
    const gradoNorm = normalizeGradoMatricula(grado);
    const seccionNorm = seccion.trim().toUpperCase();
    const salon = await this.salonRepo.findOne({
      where: {
        anioEscolar,
        nivel,
        grado: gradoNorm,
        seccion: seccionNorm,
        activo: true,
      },
    });

    const aforo = salon?.aforo ?? defaultAforoForNivel(nivel);
    const key = this.sectionKey(nivel, gradoNorm, seccionNorm);
    const studentCounts = await this.countStudentsBySection();
    const matriculados = studentCounts.get(key) ?? 0;

    if (matriculados >= aforo) {
      throw new BadRequestException(
        `No hay vacantes en ${gradoNorm} ${nivel} seccion ${seccionNorm} (aforo ${aforo}, matriculados ${matriculados})`,
      );
    }
  }

  async create(dto: CreateSalonDto, req: MaestrosAuthRequest): Promise<SalonResponse> {
    const institutionId = requireMaestrosInstitutionId(req);
    const grado = normalizeGradoMatricula(dto.grado);
    const seccion = dto.seccion.trim().toUpperCase();
    const existing = await this.salonRepo.findOne({
      where: {
        institutionId,
        anioEscolar: dto.anioEscolar,
        nivel: dto.nivel,
        grado,
        seccion,
      },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un salon con esa combinacion');
    }

    const saved = await this.salonRepo.save(
      this.salonRepo.create({
        institutionId,
        anioEscolar: dto.anioEscolar,
        nivel: dto.nivel,
        grado,
        seccion,
        aforo: dto.aforo,
        activo: dto.activo ?? true,
      }),
    );
    this.catalogCache.invalidate('salones:');
    return this.toSalonResponse(saved);
  }

  async update(
    id: number,
    dto: UpdateSalonDto,
    req: MaestrosAuthRequest,
  ): Promise<SalonResponse> {
    const institutionId = requireMaestrosInstitutionId(req);
    const salon = await this.getOrFail(id);
    assertMaestroBelongsToInstitution(salon, institutionId);
    if (dto.aforo !== undefined) salon.aforo = dto.aforo;
    if (dto.activo !== undefined) salon.activo = dto.activo;
    const saved = await this.salonRepo.save(salon);
    this.catalogCache.invalidate('salones:');
    return this.toSalonResponse(saved);
  }

  async remove(
    id: number,
    req: MaestrosAuthRequest,
  ): Promise<{ deleted: boolean; id: number }> {
    const institutionId = requireMaestrosInstitutionId(req);
    const salon = await this.getOrFail(id);
    assertMaestroBelongsToInstitution(salon, institutionId);
    await this.salonRepo.remove(salon);
    this.catalogCache.invalidate('salones:');
    return { deleted: true, id };
  }

  async syncFromInstitution(
    dto: SyncSalonesDto,
    req: MaestrosAuthRequest,
  ): Promise<{ created: number; skipped: number }> {
    const institutionId = requireMaestrosInstitutionId(req);
    const niveles = await this.nivelRepo.find({
      where: { activo: true },
      order: { orden: 'ASC' },
    });

    let created = 0;
    let skipped = 0;

    for (const nivel of niveles) {
      const grados = await this.gradoRepo.find({
        where: { nivelId: nivel.id },
        order: { orden: 'ASC' },
      });
      for (const grado of grados) {
        const gradoMat = gradoInstitucionalToMatricula(nivel.nombre, grado.nombre);
        const secciones = await this.seccionRepo.find({
          where: { gradoId: grado.id },
        });
        for (const seccion of secciones) {
          const seccionNorm = seccion.nombre.trim().toUpperCase();
          const exists = await this.salonRepo.findOne({
            where: {
              institutionId,
              anioEscolar: dto.anioEscolar,
              nivel: nivel.nombre,
              grado: gradoMat,
              seccion: seccionNorm,
            },
          });
          if (exists) {
            skipped++;
            continue;
          }
          await this.salonRepo.save(
            this.salonRepo.create({
              institutionId,
              anioEscolar: dto.anioEscolar,
              nivel: nivel.nombre,
              grado: gradoMat,
              seccion: seccionNorm,
              aforo: defaultAforoForNivel(nivel.nombre),
              activo: true,
            }),
          );
          created++;
        }
      }
    }

    this.catalogCache.invalidate('salones:');
    return { created, skipped };
  }

  private async countStudentsBySection(
    institutionId?: number,
  ): Promise<Map<string, number>> {
    const qb = this.studentRepo
      .createQueryBuilder('s')
      .where('s.activo = :activo', { activo: true })
      .andWhere("s.estadoMatricula = 'activo'");
    if (institutionId !== undefined && institutionId > 0) {
      qb.andWhere('s.institutionId = :institutionId', { institutionId });
    }
    const students = await qb.getMany();
    const map = new Map<string, number>();
    for (const s of students) {
      const key = this.sectionKey(
        s.nivel,
        normalizeGradoMatricula(s.grado),
        s.seccion,
      );
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  private sectionKey(nivel: string, grado: string, seccion: string): string {
    return `${nivel}|${normalizeGradoMatricula(grado)}|${seccion.trim().toUpperCase()}`;
  }

  private toSalonResponse(salon: Salon): SalonResponse {
    return {
      id: salon.id,
      anioEscolar: salon.anioEscolar,
      nivel: salon.nivel,
      grado: salon.grado,
      seccion: salon.seccion,
      aforo: salon.aforo,
      activo: salon.activo,
      esIngresante: isIngresanteGrade(salon.nivel, salon.grado),
    };
  }

  private async getOrFail(id: number): Promise<Salon> {
    const salon = await this.salonRepo.findOne({ where: { id } });
    if (!salon) throw new NotFoundException(`Salon ${id} no encontrado`);
    return salon;
  }
}
