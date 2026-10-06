import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaestroConductaDescripcion } from './entities/maestro-conducta-descripcion.entity';
import { MaestroConductaTipo } from './entities/maestro-conducta-tipo.entity';
import {
  CreateMaestroConductaDescripcionDto,
  CreateMaestroConductaTipoDto,
  UpdateMaestroConductaDescripcionDto,
  UpdateMaestroConductaTipoDto,
} from './dto/faltas-reconocimientos.dto';
import { FALTAS_RECONOCIMIENTOS_SEED } from './faltas-reconocimientos-seed.data';
import { Institution } from '../../institution/entities/institution.entity';
import {
  applyInstitutionIdWhere,
  assertMaestroBelongsToInstitution,
  MaestrosAuthRequest,
  requireMaestrosInstitutionId,
  resolveMaestrosInstitutionId,
  resolveSeedInstitutionId,
} from '../common/maestros-tenant.util';

export interface MaestroConductaDescripcionResponse {
  id: number;
  tipoId: number;
  texto: string;
  orden: number;
  activo: boolean;
}

export interface MaestroConductaTipoResponse {
  id: number;
  codigo: string;
  nombre: string;
  categoria: 'falta' | 'reconocimiento';
  icon: string;
  orden: number;
  activo: boolean;
  descripciones: MaestroConductaDescripcionResponse[];
}

function slugCodigo(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

@Injectable()
export class FaltasReconocimientosService {
  constructor(
    @InjectRepository(MaestroConductaTipo)
    private readonly tipoRepo: Repository<MaestroConductaTipo>,
    @InjectRepository(MaestroConductaDescripcion)
    private readonly descRepo: Repository<MaestroConductaDescripcion>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async seedCatalogIfEmpty(): Promise<void> {
    const count = await this.tipoRepo.count();
    if (count > 0) return;
    const institutionId = await resolveSeedInstitutionId(this.institutionRepo);

    for (const seed of FALTAS_RECONOCIMIENTOS_SEED) {
      const tipo = await this.tipoRepo.save(
        this.tipoRepo.create({
          institutionId,
          codigo: seed.codigo,
          nombre: seed.nombre,
          categoria: seed.categoria,
          icon: seed.icon,
          orden: seed.orden,
          activo: true,
        }),
      );

      await this.descRepo.save(
        seed.descripciones.map((texto, index) =>
          this.descRepo.create({
            tipoId: tipo.id,
            texto,
            orden: index + 1,
            activo: true,
          }),
        ),
      );
    }
  }

  async findAll(
    activo?: boolean,
    req?: MaestrosAuthRequest,
  ): Promise<MaestroConductaTipoResponse[]> {
    const institutionId = resolveMaestrosInstitutionId(req);
    if (req && institutionId == null) return [];

    const qb = this.tipoRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.descripciones', 'd')
      .orderBy('t.orden', 'ASC')
      .addOrderBy('t.nombre', 'ASC')
      .addOrderBy('d.orden', 'ASC')
      .addOrderBy('d.id', 'ASC');

    applyInstitutionIdWhere(qb, 't', institutionId);

    if (activo !== undefined) {
      qb.andWhere('t.activo = :activo', { activo });
    }

    const tipos = await qb.getMany();
    return tipos.map((t) => this.toTipoResponse(t, activo));
  }

  async createTipo(
    dto: CreateMaestroConductaTipoDto,
    req: MaestrosAuthRequest,
  ): Promise<MaestroConductaTipoResponse> {
    const institutionId = requireMaestrosInstitutionId(req);
    const codigo = (dto.codigo?.trim() || slugCodigo(dto.nombre)).slice(0, 40);
    if (!codigo) {
      throw new BadRequestException('No se pudo generar un código para el tipo');
    }

    const dup = await this.tipoRepo.findOneBy({ institutionId, codigo });
    if (dup) {
      throw new BadRequestException(`Ya existe un tipo con código "${codigo}"`);
    }

    const saved = await this.tipoRepo.save(
      this.tipoRepo.create({
        institutionId,
        codigo,
        nombre: dto.nombre.trim(),
        categoria: dto.categoria,
        icon: dto.icon?.trim() || 'description',
        orden: dto.orden ?? 0,
        activo: true,
      }),
    );

    return this.findTipo(saved.id, institutionId);
  }

  async updateTipo(
    id: number,
    dto: UpdateMaestroConductaTipoDto,
    req: MaestrosAuthRequest,
  ): Promise<MaestroConductaTipoResponse> {
    const institutionId = requireMaestrosInstitutionId(req);
    const tipo = await this.getTipoOrFail(id);
    assertMaestroBelongsToInstitution(tipo, institutionId);
    if (dto.nombre !== undefined) tipo.nombre = dto.nombre.trim();
    if (dto.categoria !== undefined) tipo.categoria = dto.categoria;
    if (dto.icon !== undefined) tipo.icon = dto.icon.trim() || 'description';
    if (dto.orden !== undefined) tipo.orden = dto.orden;
    if (dto.activo !== undefined) tipo.activo = dto.activo;
    await this.tipoRepo.save(tipo);
    return this.findTipo(id, institutionId);
  }

  async removeTipo(
    id: number,
    req: MaestrosAuthRequest,
  ): Promise<{ deleted: boolean; id: number }> {
    const institutionId = requireMaestrosInstitutionId(req);
    const tipo = await this.getTipoOrFail(id);
    assertMaestroBelongsToInstitution(tipo, institutionId);
    tipo.activo = false;
    await this.tipoRepo.save(tipo);
    await this.descRepo.update({ tipoId: id }, { activo: false });
    return { deleted: true, id };
  }

  async createDescripcion(
    tipoId: number,
    dto: CreateMaestroConductaDescripcionDto,
    req: MaestrosAuthRequest,
  ): Promise<MaestroConductaDescripcionResponse> {
    const institutionId = requireMaestrosInstitutionId(req);
    const tipo = await this.getTipoOrFail(tipoId);
    assertMaestroBelongsToInstitution(tipo, institutionId);
    const texto = dto.texto.trim();
    if (!texto) {
      throw new BadRequestException('La descripción no puede estar vacía');
    }

    const saved = await this.descRepo.save(
      this.descRepo.create({
        tipoId,
        texto,
        orden: dto.orden ?? 0,
        activo: true,
      }),
    );

    return this.toDescripcionResponse(saved);
  }

  async updateDescripcion(
    id: number,
    dto: UpdateMaestroConductaDescripcionDto,
    req: MaestrosAuthRequest,
  ): Promise<MaestroConductaDescripcionResponse> {
    const institutionId = requireMaestrosInstitutionId(req);
    const desc = await this.getDescripcionOrFail(id);
    const tipo = await this.getTipoOrFail(desc.tipoId);
    assertMaestroBelongsToInstitution(tipo, institutionId);
    if (dto.texto !== undefined) {
      const texto = dto.texto.trim();
      if (!texto) {
        throw new BadRequestException('La descripción no puede estar vacía');
      }
      desc.texto = texto;
    }
    if (dto.orden !== undefined) desc.orden = dto.orden;
    if (dto.activo !== undefined) desc.activo = dto.activo;
    const saved = await this.descRepo.save(desc);
    return this.toDescripcionResponse(saved);
  }

  async removeDescripcion(
    id: number,
    req: MaestrosAuthRequest,
  ): Promise<{ deleted: boolean; id: number }> {
    const institutionId = requireMaestrosInstitutionId(req);
    const desc = await this.getDescripcionOrFail(id);
    const tipo = await this.getTipoOrFail(desc.tipoId);
    assertMaestroBelongsToInstitution(tipo, institutionId);
    desc.activo = false;
    await this.descRepo.save(desc);
    return { deleted: true, id };
  }

  private async findTipo(
    id: number,
    institutionId?: number,
  ): Promise<MaestroConductaTipoResponse> {
    const tipo = await this.tipoRepo.findOne({
      where: { id },
      relations: { descripciones: true },
    });
    if (!tipo) throw new NotFoundException(`Tipo de conducta ${id} no encontrado`);
    if (institutionId != null) {
      assertMaestroBelongsToInstitution(tipo, institutionId);
    }
    return this.toTipoResponse(tipo);
  }

  private toTipoResponse(
    tipo: MaestroConductaTipo,
    activoFilter?: boolean,
  ): MaestroConductaTipoResponse {
    let descripciones = (tipo.descripciones ?? []).slice();
    if (activoFilter !== undefined) {
      descripciones = descripciones.filter((d) => d.activo === activoFilter);
    }
    descripciones.sort(
      (a, b) => a.orden - b.orden || a.id - b.id,
    );

    return {
      id: tipo.id,
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      categoria: tipo.categoria,
      icon: tipo.icon,
      orden: tipo.orden,
      activo: tipo.activo,
      descripciones: descripciones.map((d) => this.toDescripcionResponse(d)),
    };
  }

  private toDescripcionResponse(
    desc: MaestroConductaDescripcion,
  ): MaestroConductaDescripcionResponse {
    return {
      id: desc.id,
      tipoId: desc.tipoId,
      texto: desc.texto,
      orden: desc.orden,
      activo: desc.activo,
    };
  }

  private async getTipoOrFail(id: number): Promise<MaestroConductaTipo> {
    const tipo = await this.tipoRepo.findOneBy({ id });
    if (!tipo) throw new NotFoundException(`Tipo de conducta ${id} no encontrado`);
    return tipo;
  }

  private async getDescripcionOrFail(
    id: number,
  ): Promise<MaestroConductaDescripcion> {
    const desc = await this.descRepo.findOneBy({ id });
    if (!desc) {
      throw new NotFoundException(`Descripción de conducta ${id} no encontrada`);
    }
    return desc;
  }
}
