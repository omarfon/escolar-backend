import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sede } from './entities/sede.entity';
import { EducationLevel } from './entities/education-level.entity';
import { GradeLevel } from './entities/grade-level.entity';
import { GradeSection } from './entities/grade-section.entity';
import { Institution } from './entities/institution.entity';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import {
  CreateEducationLevelDto,
  UpdateEducationLevelDto,
} from './dto/education-level.dto';
import {
  CreateGradeLevelDto,
  UpdateGradeLevelDto,
} from './dto/grade-level.dto';
import {
  CreateGradeSectionDto,
  UpdateGradeSectionDto,
} from './dto/grade-section.dto';

interface NivelEstructura {
  nombre: string;
  activo: boolean;
  grados: { nombre: string; secciones: string[] }[];
}

const DEFAULT_ESTRUCTURA: NivelEstructura[] = [
  {
    nombre: 'Inicial',
    activo: true,
    grados: [
      { nombre: '3 anos', secciones: ['Anaranjado'] },
      { nombre: '4 anos', secciones: ['Verde'] },
      { nombre: '5 anos', secciones: ['Azul'] },
    ],
  },
  {
    nombre: 'Primaria',
    activo: true,
    grados: [
      { nombre: '1 Grado', secciones: ['A', 'B'] },
      { nombre: '2 Grado', secciones: ['A', 'B'] },
      { nombre: '3 Grado', secciones: ['A', 'B'] },
      { nombre: '4 Grado', secciones: ['A'] },
      { nombre: '5 Grado', secciones: ['A'] },
      { nombre: '6 Grado', secciones: ['A'] },
    ],
  },
  {
    nombre: 'Secundaria',
    activo: true,
    grados: [
      { nombre: '1 Ano', secciones: ['A', 'B'] },
      { nombre: '2 Ano', secciones: ['A', 'B'] },
      { nombre: '3 Ano', secciones: ['A'] },
      { nombre: '4 Ano', secciones: ['A'] },
      { nombre: '5 Ano', secciones: ['A'] },
    ],
  },
];

export interface NivelResponse {
  id: number;
  nombre: string;
  activo: boolean;
  orden: number;
  grados: {
    id: number;
    nombre: string;
    orden: number;
    secciones: { id: number; nombre: string }[];
  }[];
}

@Injectable()
export class InstitutionService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(EducationLevel)
    private readonly nivelRepo: Repository<EducationLevel>,
    @InjectRepository(GradeLevel)
    private readonly gradoRepo: Repository<GradeLevel>,
    @InjectRepository(GradeSection)
    private readonly seccionRepo: Repository<GradeSection>,
  ) {}

  async getConfig() {
    const institution = await this.ensureInstitution();
    const campuses = await this.sedeRepo.find({ order: { id: 'ASC' } });
    const niveles = await this.findAllEducationLevels();
    return {
      institution: { ...institution, niveles },
      campuses,
    };
  }

  async updateInstitution(dto: UpdateInstitutionDto) {
    const current = await this.ensureInstitution();
    const { niveles: _niveles, ...rest } = dto;
    const merged = this.institutionRepo.merge(current, rest);
    return this.institutionRepo.save(merged);
  }

  findAllCampuses() {
    return this.sedeRepo.find({ order: { id: 'ASC' } });
  }

  async findCampus(id: number) {
    return this.getCampusOrFail(id);
  }

  createCampus(dto: CreateCampusDto) {
    return this.ensureInstitution().then((institution) => {
      const entity = this.sedeRepo.create({
        ...dto,
        institutionId: institution.id,
      });
      return this.sedeRepo.save(entity);
    });
  }

  async updateCampus(id: number, dto: UpdateCampusDto) {
    const current = await this.getCampusOrFail(id);
    const merged = this.sedeRepo.merge(current, dto);
    return this.sedeRepo.save(merged);
  }

  async removeCampus(id: number) {
    const current = await this.getCampusOrFail(id);
    await this.sedeRepo.remove(current);
    return { deleted: true, id };
  }

  async findAllEducationLevels(): Promise<NivelResponse[]> {
    await this.ensureEducationLevels();
    const niveles = await this.queryEducationLevels();
    return niveles.map((nivel) => this.mapNivel(nivel));
  }

  private async queryEducationLevels(): Promise<EducationLevel[]> {
    return this.nivelRepo
      .createQueryBuilder('nivel')
      .leftJoinAndSelect('nivel.grados', 'grado')
      .leftJoinAndSelect('grado.secciones', 'seccion')
      .orderBy('nivel.orden', 'ASC')
      .addOrderBy('nivel.id', 'ASC')
      .addOrderBy('grado.orden', 'ASC')
      .addOrderBy('grado.id', 'ASC')
      .addOrderBy('seccion.id', 'ASC')
      .getMany();
  }

  private async ensureEducationLevels(): Promise<void> {
    const count = await this.nivelRepo.count();
    if (count > 0) return;

    const institution = await this.ensureInstitution();
    const raw = (institution.niveles ?? []) as NivelEstructura[];

    const estructura = raw.length
      ? raw.map((nivel) => ({
          nombre: nivel.nombre,
          activo: nivel.activo ?? true,
          grados: (nivel.grados ?? []).map((grado) => ({
            nombre: grado.nombre,
            secciones: Array.isArray(grado.secciones)
              ? grado.secciones
              : String(grado.secciones ?? '')
                  .split(/[\s,]+/)
                  .filter(Boolean),
          })),
        }))
      : DEFAULT_ESTRUCTURA;

    await this.populateEducationLevels(estructura);
  }

  private async populateEducationLevels(estructura: NivelEstructura[]): Promise<void> {
    for (const [ni, nivelData] of estructura.entries()) {
      const nivel = await this.nivelRepo.save(
        this.nivelRepo.create({
          nombre: nivelData.nombre,
          activo: nivelData.activo,
          orden: ni,
        }),
      );

      for (const [gi, gradoData] of nivelData.grados.entries()) {
        const grado = await this.gradoRepo.save(
          this.gradoRepo.create({
            nivelId: nivel.id,
            nombre: gradoData.nombre,
            orden: gi,
          }),
        );

        for (const seccionNombre of gradoData.secciones) {
          await this.seccionRepo.save(
            this.seccionRepo.create({
              gradoId: grado.id,
              nombre: seccionNombre.trim().toUpperCase(),
            }),
          );
        }
      }
    }
  }

  async createEducationLevel(dto: CreateEducationLevelDto): Promise<NivelResponse> {
    const count = await this.nivelRepo.count();
    const entity = this.nivelRepo.create({
      nombre: dto.nombre.trim(),
      activo: dto.activo ?? true,
      orden: dto.orden ?? count,
      grados: [],
    });
    const saved = await this.nivelRepo.save(entity);
    return this.mapNivel({ ...saved, grados: [] });
  }

  async updateEducationLevel(id: number, dto: UpdateEducationLevelDto): Promise<NivelResponse> {
    const current = await this.getNivelOrFail(id);
    if (dto.nombre !== undefined) current.nombre = dto.nombre.trim();
    if (dto.activo !== undefined) current.activo = dto.activo;
    if (dto.orden !== undefined) current.orden = dto.orden;
    await this.nivelRepo.save(current);
    return this.findEducationLevel(id);
  }

  async removeEducationLevel(id: number) {
    const current = await this.getNivelOrFail(id);
    await this.nivelRepo.remove(current);
    return { deleted: true, id };
  }

  async findEducationLevel(id: number): Promise<NivelResponse> {
    const nivel = await this.nivelRepo
      .createQueryBuilder('nivel')
      .leftJoinAndSelect('nivel.grados', 'grado')
      .leftJoinAndSelect('grado.secciones', 'seccion')
      .where('nivel.id = :id', { id })
      .orderBy('grado.orden', 'ASC')
      .addOrderBy('grado.id', 'ASC')
      .addOrderBy('seccion.id', 'ASC')
      .getOne();
    if (!nivel) throw new NotFoundException(`Nivel ${id} no encontrado`);
    return this.mapNivel(nivel);
  }

  async createGradeLevel(nivelId: number, dto: CreateGradeLevelDto) {
    await this.getNivelOrFail(nivelId);
    const count = await this.gradoRepo.count({ where: { nivelId } });
    const entity = this.gradoRepo.create({
      nivelId,
      nombre: dto.nombre.trim(),
      orden: dto.orden ?? count,
      secciones: [],
    });
    const saved = await this.gradoRepo.save(entity);
    return {
      id: saved.id,
      nombre: saved.nombre,
      orden: saved.orden,
      secciones: [],
    };
  }

  async updateGradeLevel(id: number, dto: UpdateGradeLevelDto) {
    const current = await this.getGradoOrFail(id);
    if (dto.nombre !== undefined) current.nombre = dto.nombre.trim();
    if (dto.orden !== undefined) current.orden = dto.orden;
    const saved = await this.gradoRepo.save(current);
    const secciones = await this.seccionRepo.find({ where: { gradoId: id }, order: { id: 'ASC' } });
    return {
      id: saved.id,
      nombre: saved.nombre,
      orden: saved.orden,
      secciones: secciones.map((s) => ({ id: s.id, nombre: s.nombre })),
    };
  }

  async removeGradeLevel(id: number) {
    const current = await this.getGradoOrFail(id);
    await this.gradoRepo.remove(current);
    return { deleted: true, id };
  }

  async createGradeSection(gradoId: number, dto: CreateGradeSectionDto) {
    await this.getGradoOrFail(gradoId);
    const entity = this.seccionRepo.create({
      gradoId,
      nombre: dto.nombre.trim().toUpperCase(),
    });
    const saved = await this.seccionRepo.save(entity);
    return { id: saved.id, nombre: saved.nombre };
  }

  async updateGradeSection(id: number, dto: UpdateGradeSectionDto) {
    const current = await this.getSeccionOrFail(id);
    current.nombre = dto.nombre.trim().toUpperCase();
    const saved = await this.seccionRepo.save(current);
    return { id: saved.id, nombre: saved.nombre };
  }

  async removeGradeSection(id: number) {
    const current = await this.getSeccionOrFail(id);
    await this.seccionRepo.remove(current);
    return { deleted: true, id };
  }

  private mapNivel(nivel: EducationLevel): NivelResponse {
    return {
      id: nivel.id,
      nombre: nivel.nombre,
      activo: nivel.activo,
      orden: nivel.orden,
      grados: (nivel.grados ?? [])
        .sort((a, b) => a.orden - b.orden || a.id - b.id)
        .map((grado) => ({
          id: grado.id,
          nombre: grado.nombre,
          orden: grado.orden,
          secciones: (grado.secciones ?? [])
            .sort((a, b) => a.id - b.id)
            .map((seccion) => ({ id: seccion.id, nombre: seccion.nombre })),
        })),
    };
  }

  private async ensureInstitution(): Promise<Institution> {
    let institution = await this.institutionRepo.findOne({ where: {}, order: { id: 'ASC' } });
    if (!institution) {
      institution = this.institutionRepo.create({});
      institution = await this.institutionRepo.save(institution);
    }
    return institution;
  }

  private async getCampusOrFail(id: number): Promise<Sede> {
    const campus = await this.sedeRepo.findOneBy({ id });
    if (!campus) throw new NotFoundException(`Campus ${id} no encontrado`);
    return campus;
  }

  private async getNivelOrFail(id: number): Promise<EducationLevel> {
    const nivel = await this.nivelRepo.findOneBy({ id });
    if (!nivel) throw new NotFoundException(`Nivel ${id} no encontrado`);
    return nivel;
  }

  private async getGradoOrFail(id: number): Promise<GradeLevel> {
    const grado = await this.gradoRepo.findOneBy({ id });
    if (!grado) throw new NotFoundException(`Grado ${id} no encontrado`);
    return grado;
  }

  private async getSeccionOrFail(id: number): Promise<GradeSection> {
    const seccion = await this.seccionRepo.findOneBy({ id });
    if (!seccion) throw new NotFoundException(`Seccion ${id} no encontrada`);
    return seccion;
  }
}
