import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sede } from '../../institution/entities/sede.entity';
import { Institution } from '../../institution/entities/institution.entity';
import {
  CreateMaestroSedeDto,
  UpdateMaestroSedeDto,
} from './dto/maestro-sede.dto';

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
export class SedesMaestrosService implements OnModuleInit {
  constructor(
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async onModuleInit(): Promise<void> {
    const institution = await this.findFirstInstitution();
    if (!institution) return;
    await this.backfillInstitutionId(institution.id);
  }

  async findCatalog(institutionId?: number): Promise<MaestroSedesCatalogResponse> {
    const institution = institutionId
      ? await this.getInstitutionOrFail(institutionId)
      : await this.ensureInstitution();

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
      sedes: sedes.map((s) => this.toResponse(s, institution.id)),
    };
  }

  async create(dto: CreateMaestroSedeDto): Promise<MaestroSedeResponse> {
    const institution = dto.institutionId
      ? await this.getInstitutionOrFail(dto.institutionId)
      : await this.ensureInstitution();

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

  async update(id: number, dto: UpdateMaestroSedeDto): Promise<MaestroSedeResponse> {
    const current = await this.getSedeOrFail(id);
    const institutionId = current.institutionId ?? (await this.ensureInstitution()).id;

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      const dup = await this.sedeRepo.findOne({
        where: { institutionId, nombre },
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
    if (!current.institutionId) current.institutionId = institutionId;

    const saved = await this.sedeRepo.save(current);
    return this.toResponse(saved, institutionId);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const current = await this.getSedeOrFail(id);
    const activas = await this.sedeRepo.count({
      where: {
        institutionId: current.institutionId ?? undefined,
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

  private async backfillInstitutionId(institutionId: number): Promise<void> {
    await this.sedeRepo
      .createQueryBuilder()
      .update(Sede)
      .set({ institutionId })
      .where('"institutionId" IS NULL')
      .execute();
  }

  private async findFirstInstitution(): Promise<Institution | null> {
    return this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
  }

  private async ensureInstitution(): Promise<Institution> {
    const institution = await this.findFirstInstitution();
    if (!institution) {
      throw new NotFoundException(
        'No hay institución registrada. Ejecute npm run db:sedes-data o inicie el backend con seed.',
      );
    }
    return institution;
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

  private toResponse(sede: Sede, institutionId: number): MaestroSedeResponse {
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
    };
  }
}
