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
  ) {}

  async findAll(query?: {
    anioEscolar?: number;
    nivel?: string;
    grado?: string;
    activo?: boolean;
  }): Promise<SalonResponse[]> {
    const qb = this.salonRepo
      .createQueryBuilder('s')
      .orderBy('s.nivel', 'ASC')
      .addOrderBy('s.grado', 'ASC')
      .addOrderBy('s.seccion', 'ASC');

    if (query?.anioEscolar) {
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

  async findVacancies(query?: {
    anioEscolar?: number;
    nivel?: string;
    grado?: string;
  }): Promise<VacancyResponse[]> {
    const anio = query?.anioEscolar ?? new Date().getFullYear();
    const salones = await this.findAll({
      anioEscolar: anio,
      nivel: query?.nivel,
      grado: query?.grado,
      activo: true,
    });

    const studentCounts = await this.countStudentsBySection();

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
    const gradoNorm = normalizeGradoMatricula(grado);
    const anio = anioEscolar ?? new Date().getFullYear();
    const vacancies = await this.findVacancies({
      anioEscolar: anio,
      nivel,
      grado: gradoNorm,
    });

    const esIngresante = isIngresanteGrade(nivel, gradoNorm);

    return vacancies
      .map((v) => ({
        seccion: v.seccion.trim().toUpperCase(),
        matriculados: v.matriculados,
        capacidad: v.aforo,
        disponibles: v.disponibles,
        esIngresante,
      }))
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

  async create(dto: CreateSalonDto): Promise<SalonResponse> {
    const grado = normalizeGradoMatricula(dto.grado);
    const seccion = dto.seccion.trim().toUpperCase();
    const existing = await this.salonRepo.findOne({
      where: {
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
        anioEscolar: dto.anioEscolar,
        nivel: dto.nivel,
        grado,
        seccion,
        aforo: dto.aforo,
        activo: dto.activo ?? true,
      }),
    );
    return this.toSalonResponse(saved);
  }

  async update(id: number, dto: UpdateSalonDto): Promise<SalonResponse> {
    const salon = await this.getOrFail(id);
    if (dto.aforo !== undefined) salon.aforo = dto.aforo;
    if (dto.activo !== undefined) salon.activo = dto.activo;
    const saved = await this.salonRepo.save(salon);
    return this.toSalonResponse(saved);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const salon = await this.getOrFail(id);
    await this.salonRepo.remove(salon);
    return { deleted: true, id };
  }

  async syncFromInstitution(
    dto: SyncSalonesDto,
  ): Promise<{ created: number; skipped: number }> {
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

    return { created, skipped };
  }

  private async countStudentsBySection(): Promise<Map<string, number>> {
    const students = await this.studentRepo.find({
      where: { activo: true, estadoMatricula: 'activo' },
    });
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
