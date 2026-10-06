import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sede } from '../../institution/entities/sede.entity';
import { Institution } from '../../institution/entities/institution.entity';
import {
  CreateMaestroSedeDto,
  UpdateMaestroSedeDto,
} from './dto/maestro-sede.dto';
import { assertMaestroBelongsToInstitution } from '../common/maestros-tenant.util';

export interface MaestroSedeResponse {
  id: number;
  institutionId: number;
  nombre: string;
  codigo: string;
  direccion: string;
  distrito: string;
  provincia: string;
  region: string;
  telefono: string;
  email: string;
  director: string;
  niveles: string[];
  turnos: string[];
  estado: 'activo' | 'inactivo';
  institucionNombre?: string;
}

export interface MaestroSedesCatalogResponse {
  institution: {
    id: number;
    nombre: string;
    siglas: string;
    ruc: string;
    codigoModular: string;
  };
  sedes: MaestroSedeResponse[];
}

@Injectable()
export class SedesMaestrosService {
  constructor(
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async findCatalog(institutionId?: number): Promise<MaestroSedesCatalogResponse> {
    if (institutionId == null || institutionId < 1) {
      throw new BadRequestException(
        'Seleccione una institución educativa (header X-Institution-Id o query institutionId)',
      );
    }

    const institution = await this.getInstitutionOrFail(institutionId);

    const sedes = await this.sedeRepo.find({
      where: { institutionId: institution.id },
      order: { id: 'ASC' },
    });

    return {
      institution: {
        id: institution.id,
        nombre: institution.nombre,
        siglas: institution.siglas,
        ruc: institution.ruc,
        codigoModular: institution.codigoModular,
      },
      sedes: sedes.map((s) => this.toResponse(s, institution.id, institution.nombre)),
    };
  }

  async findTodas(): Promise<MaestroSedesCatalogResponse> {
    const institutions = await this.institutionRepo.find({ order: { nombre: 'ASC' } });
    const porId = new Map(institutions.map((ie) => [ie.id, ie]));
    const sedes = await this.sedeRepo.find({ order: { nombre: 'ASC' } });
    return {
      institution: {
        id: 0,
        nombre: 'Todas las instituciones',
        siglas: 'SIAGIE',
        ruc: '',
        codigoModular: '',
      },
      sedes: sedes.map((sede) =>
        this.toResponse(
          sede,
          sede.institutionId ?? 0,
          porId.get(sede.institutionId ?? 0)?.nombre ?? '',
        ),
      ),
    };
  }

  async create(
    dto: CreateMaestroSedeDto,
    institutionId?: number,
  ): Promise<MaestroSedeResponse> {
    const resolvedId = dto.institutionId ?? institutionId;
    if (!resolvedId) {
      throw new BadRequestException('Institución educativa requerida');
    }
    const institution = await this.getInstitutionOrFail(resolvedId);

    const nombre = dto.nombre.trim();
    const dup = await this.sedeRepo.findOne({
      where: { institutionId: institution.id, nombre },
    });
    if (dup) {
      throw new BadRequestException(
        `Ya existe la sede "${nombre}" para esta institución`,
      );
    }

    const saved = await this.sedeRepo.save(
      this.sedeRepo.create({
        institutionId: institution.id,
        nombre,
        codigo: dto.codigo?.trim() ?? '',
        direccion: dto.direccion?.trim() ?? '',
        distrito: dto.distrito?.trim() ?? '',
        provincia: dto.provincia?.trim() ?? '',
        region: dto.region?.trim() ?? '',
        telefono: dto.telefono?.trim() ?? '',
        email: dto.email?.trim() ?? '',
        director: dto.director?.trim() ?? '',
        niveles: dto.niveles ?? [],
        turnos: dto.turnos ?? [],
        estado: dto.estado ?? 'activo',
      }),
    );

    return this.toResponse(saved, institution.id);
  }

  async update(
    id: number,
    dto: UpdateMaestroSedeDto,
    institutionId?: number,
  ): Promise<MaestroSedeResponse> {
    const current = await this.getSedeOrFail(id);
    if (institutionId != null) {
      assertMaestroBelongsToInstitution(current, institutionId);
    }
    if (!current.institutionId) {
      throw new BadRequestException('Sede sin institución asignada');
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      const dup = await this.sedeRepo.findOne({
        where: { institutionId: current.institutionId, nombre },
      });
      if (dup && dup.id !== id) {
        throw new BadRequestException(
          `Ya existe la sede "${nombre}" para esta institución`,
        );
      }
      current.nombre = nombre;
    }

    if (dto.codigo !== undefined) current.codigo = dto.codigo.trim();
    if (dto.direccion !== undefined) current.direccion = dto.direccion.trim();
    if (dto.distrito !== undefined) current.distrito = dto.distrito.trim();
    if (dto.provincia !== undefined) current.provincia = dto.provincia.trim();
    if (dto.region !== undefined) current.region = dto.region.trim();
    if (dto.telefono !== undefined) current.telefono = dto.telefono.trim();
    if (dto.email !== undefined) current.email = dto.email.trim();
    if (dto.director !== undefined) current.director = dto.director.trim();
    if (dto.niveles !== undefined) current.niveles = dto.niveles;
    if (dto.turnos !== undefined) current.turnos = dto.turnos;
    if (dto.estado !== undefined) current.estado = dto.estado;

    const saved = await this.sedeRepo.save(current);
    return this.toResponse(saved, current.institutionId);
  }

  async remove(
    id: number,
    institutionId?: number,
  ): Promise<{ deleted: boolean; id: number }> {
    const current = await this.getSedeOrFail(id);
    if (institutionId != null) {
      assertMaestroBelongsToInstitution(current, institutionId);
    }
    if (!current.institutionId) {
      throw new BadRequestException('Sede sin institución asignada');
    }

    const activas = await this.sedeRepo.count({
      where: {
        institutionId: current.institutionId,
        estado: 'activo',
      },
    });
    if (current.estado === 'activo' && activas <= 1) {
      throw new BadRequestException(
        'Debe existir al menos una sede activa por institución',
      );
    }
    current.estado = 'inactivo';
    await this.sedeRepo.save(current);
    return { deleted: true, id };
  }

  private async getInstitutionOrFail(id: number): Promise<Institution> {
    const institution = await this.institutionRepo.findOneBy({ id });
    if (!institution) {
      throw new NotFoundException(`Institución ${id} no encontrada`);
    }
    return institution;
  }

  private async getSedeOrFail(id: number): Promise<Sede> {
    const sede = await this.sedeRepo.findOneBy({ id });
    if (!sede) throw new NotFoundException(`Sede ${id} no encontrada`);
    return sede;
  }

  private toResponse(sede: Sede, institutionId: number, institucionNombre = ''): MaestroSedeResponse {
    return {
      id: sede.id,
      institutionId: sede.institutionId ?? institutionId,
      nombre: sede.nombre,
      codigo: sede.codigo,
      direccion: sede.direccion,
      distrito: sede.distrito,
      provincia: sede.provincia,
      region: sede.region,
      telefono: sede.telefono,
      email: sede.email,
      director: sede.director,
      niveles: sede.niveles ?? [],
      turnos: sede.turnos ?? [],
      estado: sede.estado,
      institucionNombre,
    };
  }
}
