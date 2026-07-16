import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Classroom } from './entities/classroom.entity';
import {
  CreateClassroomDto,
  SyncClassroomsDto,
  UpdateClassroomDto,
} from './dto/classroom.dto';
import { Student } from '../students/entities/student.entity';
import { ContinuityEnrollment } from '../continuity-enrollment/entities/continuity-enrollment.entity';
import { EducationLevel } from '../institution/entities/education-level.entity';
import { GradeLevel } from '../institution/entities/grade-level.entity';
import { GradeSection } from '../institution/entities/grade-section.entity';
import {
  defaultAforoForNivel,
  gradoInstitucionalToMatricula,
  isIngresanteGrade,
  normalizeGradoMatricula,
  splitGradoLabel,
} from './classrooms.util';

export interface ClassroomResponse {
  id: number;
  anioEscolar: number;
  nivel: string;
  grado: string;
  seccion: string;
  aforo: number;
  activo: boolean;
  esIngresante: boolean;
}

export interface VacancyResponse extends ClassroomResponse {
  matriculados: number;
  pendientesContinuidad: number;
  ocupados: number;
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
export class ClassroomsService {
  constructor(
    @InjectRepository(Classroom)
    private readonly classroomRepo: Repository<Classroom>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ContinuityEnrollment)
    private readonly continuityRepo: Repository<ContinuityEnrollment>,
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
  }): Promise<ClassroomResponse[]> {
    const qb = this.classroomRepo
      .createQueryBuilder('c')
      .orderBy('c.nivel', 'ASC')
      .addOrderBy('c.grado', 'ASC')
      .addOrderBy('c.seccion', 'ASC');

    if (query?.anioEscolar) {
      qb.andWhere('c.anioEscolar = :anio', { anio: query.anioEscolar });
    }
    if (query?.nivel) qb.andWhere('c.nivel = :nivel', { nivel: query.nivel });
    if (query?.grado) {
      qb.andWhere('c.grado = :grado', {
        grado: normalizeGradoMatricula(query.grado),
      });
    }
    if (query?.activo !== undefined) {
      qb.andWhere('c.activo = :activo', { activo: query.activo });
    }

    const rows = await qb.getMany();
    return rows.map((r) => this.toClassroomResponse(r));
  }

  async findVacancies(query?: {
    anioEscolar?: number;
    nivel?: string;
    grado?: string;
  }): Promise<VacancyResponse[]> {
    const anio = query?.anioEscolar ?? new Date().getFullYear();
    const classrooms = await this.findAll({
      anioEscolar: anio,
      nivel: query?.nivel,
      grado: query?.grado,
      activo: true,
    });

    const [studentCounts, pendingCounts] = await Promise.all([
      this.countStudentsBySection(),
      this.countPendingContinuityByTarget(anio),
    ]);

    return classrooms.map((room) => {
      const key = this.sectionKey(room.nivel, room.grado, room.seccion);
      const matriculados = studentCounts.get(key) ?? 0;
      const pendientesContinuidad = room.esIngresante
        ? 0
        : pendingCounts.get(key) ?? 0;
      const ocupados = matriculados + pendientesContinuidad;
      const disponibles = Math.max(0, room.aforo - ocupados);
      let estado: VacancyResponse['estado'] = 'disponible';
      if (ocupados > room.aforo) estado = 'sobreocupada';
      else if (ocupados >= room.aforo) estado = 'completa';

      return {
        ...room,
        matriculados,
        pendientesContinuidad,
        ocupados,
        disponibles,
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
    const vacancies = await this.findVacancies({ anioEscolar: anio, nivel, grado: gradoNorm });

    if (vacancies.length) {
      return vacancies.map((v) => ({
        seccion: v.seccion,
        matriculados: v.matriculados,
        capacidad: v.aforo,
        disponibles: v.disponibles,
        esIngresante: v.esIngresante,
      }));
    }

    const students = await this.studentRepo.find({
      where: { nivel, grado: gradoNorm, activo: true },
    });
    const counts = new Map<string, number>();
    for (const s of students) {
      counts.set(s.seccion, (counts.get(s.seccion) ?? 0) + 1);
    }
    const esIngresante = isIngresanteGrade(nivel, gradoNorm);
    const defaultCap = defaultAforoForNivel(nivel);
    return [...counts.keys()].sort().map((seccion) => {
      const matriculados = counts.get(seccion) ?? 0;
      return {
        seccion,
        matriculados,
        capacidad: defaultCap,
        disponibles: Math.max(0, defaultCap - matriculados),
        esIngresante,
      };
    });
  }

  async assertVacancyAvailable(
    nivel: string,
    grado: string,
    seccion: string,
    anioEscolar: number,
    excludeContinuityId?: number,
  ): Promise<void> {
    const gradoNorm = normalizeGradoMatricula(grado);
    const seccionNorm = seccion.trim().toUpperCase();
    const room = await this.classroomRepo.findOne({
      where: {
        anioEscolar,
        nivel,
        grado: gradoNorm,
        seccion: seccionNorm,
        activo: true,
      },
    });

    const aforo = room?.aforo ?? defaultAforoForNivel(nivel);
    const key = this.sectionKey(nivel, gradoNorm, seccionNorm);
    const studentCounts = await this.countStudentsBySection();
    const matriculados = studentCounts.get(key) ?? 0;

    let pendientes = 0;
    if (!isIngresanteGrade(nivel, gradoNorm)) {
      const pending = await this.continuityRepo.find({
        where: { anioNuevo: anioEscolar, estado: 'pendiente' },
      });
      pendientes = pending.filter((p) => {
        if (excludeContinuityId && p.id === excludeContinuityId) return false;
        const target = splitGradoLabel(p.gradoNuevo);
        if (target.nivel !== nivel || target.grado !== gradoNorm) return false;
        return p.seccionNueva.trim().toUpperCase() === seccionNorm;
      }).length;
    }

    const ocupados = matriculados + pendientes;
    if (ocupados >= aforo) {
      throw new BadRequestException(
        `No hay vacantes en ${gradoNorm} ${nivel} seccion ${seccionNorm} (aforo ${aforo}, ocupados ${ocupados})`,
      );
    }
  }

  async create(dto: CreateClassroomDto): Promise<ClassroomResponse> {
    const grado = normalizeGradoMatricula(dto.grado);
    const seccion = dto.seccion.trim().toUpperCase();
    const existing = await this.classroomRepo.findOne({
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

    const saved = await this.classroomRepo.save(
      this.classroomRepo.create({
        anioEscolar: dto.anioEscolar,
        nivel: dto.nivel,
        grado,
        seccion,
        aforo: dto.aforo,
        activo: dto.activo ?? true,
      }),
    );
    return this.toClassroomResponse(saved);
  }

  async update(id: number, dto: UpdateClassroomDto): Promise<ClassroomResponse> {
    const room = await this.getOrFail(id);
    if (dto.aforo !== undefined) room.aforo = dto.aforo;
    if (dto.activo !== undefined) room.activo = dto.activo;
    const saved = await this.classroomRepo.save(room);
    return this.toClassroomResponse(saved);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const room = await this.getOrFail(id);
    await this.classroomRepo.remove(room);
    return { deleted: true, id };
  }

  async syncFromInstitution(dto: SyncClassroomsDto): Promise<{ created: number; skipped: number }> {
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
          const exists = await this.classroomRepo.findOne({
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
          await this.classroomRepo.save(
            this.classroomRepo.create({
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

  async ensureSeedForYear(anioEscolar: number): Promise<void> {
    const count = await this.classroomRepo.count({ where: { anioEscolar } });
    if (count === 0) {
      await this.syncFromInstitution({ anioEscolar });
    }
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

  private async countPendingContinuityByTarget(
    anioEscolar: number,
  ): Promise<Map<string, number>> {
    const pending = await this.continuityRepo.find({
      where: { anioNuevo: anioEscolar, estado: 'pendiente' },
    });
    const map = new Map<string, number>();
    for (const p of pending) {
      const target = splitGradoLabel(p.gradoNuevo);
      if (!target.nivel || p.seccionNueva === '—') continue;
      const key = this.sectionKey(
        target.nivel,
        target.grado,
        p.seccionNueva.trim().toUpperCase(),
      );
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  private sectionKey(nivel: string, grado: string, seccion: string): string {
    return `${nivel}|${normalizeGradoMatricula(grado)}|${seccion.trim().toUpperCase()}`;
  }

  private toClassroomResponse(room: Classroom): ClassroomResponse {
    return {
      id: room.id,
      anioEscolar: room.anioEscolar,
      nivel: room.nivel,
      grado: room.grado,
      seccion: room.seccion,
      aforo: room.aforo,
      activo: room.activo,
      esIngresante: isIngresanteGrade(room.nivel, room.grado),
    };
  }

  private async getOrFail(id: number): Promise<Classroom> {
    const room = await this.classroomRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException(`Salon ${id} no encontrado`);
    return room;
  }
}
