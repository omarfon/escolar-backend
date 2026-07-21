import {

  BadRequestException,

  Injectable,

  NotFoundException,

} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { MaestroCurso } from './entities/maestro-curso.entity';

import {

  CreateMaestroCursoDto,

  UpdateMaestroCursoDto,

} from './dto/maestro-curso.dto';

import {

  MAESTRO_CURSOS_SEED,

} from './cursos-seed.data';



export interface SyncMaestroCursosResult {
  created: number;
  updated: number;
  total: number;
}

export interface MaestroCursosPage {
  items: MaestroCurso[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MaestroCursosQuery {
  nivel?: string;
  area?: string;
  activo?: boolean;
}



@Injectable()

export class CursosMaestrosService {

  constructor(

    @InjectRepository(MaestroCurso)

    private readonly cursoRepo: Repository<MaestroCurso>,

  ) {}

  /** Inserta el catálogo demo solo si la tabla está vacía (usado por DatabaseSeedService). */
  async seedCatalogIfEmpty(): Promise<SyncMaestroCursosResult> {
    const existing = await this.cursoRepo.count();
    if (existing > 0) {
      return { created: 0, updated: 0, total: existing };
    }

    let created = 0;
    for (const seed of MAESTRO_CURSOS_SEED) {
      await this.cursoRepo.save(
        this.cursoRepo.create({ ...seed, activo: true }),
      );
      created++;
    }

    return { created, updated: 0, total: MAESTRO_CURSOS_SEED.length };
  }



  findAll(query?: MaestroCursosQuery): Promise<MaestroCurso[]> {
    return this.buildQuery(query).getMany();
  }

  async findPaginated(
    query: MaestroCursosQuery = {},
    page = 1,
    pageSize = 10,
  ): Promise<MaestroCursosPage> {
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const qb = this.buildQuery(query);
    const total = await qb.getCount();
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const items = await qb
      .skip((safePage - 1) * safePageSize)
      .take(safePageSize)
      .getMany();

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
    };
  }

  private buildQuery(query?: MaestroCursosQuery) {
    const qb = this.cursoRepo
      .createQueryBuilder('c')
      .orderBy('c.nivel', 'ASC')
      .addOrderBy('c.area', 'ASC')
      .addOrderBy('c.nombre', 'ASC');

    if (query?.nivel) qb.andWhere('c.nivel = :nivel', { nivel: query.nivel });
    if (query?.area) {
      qb.andWhere('c.area ILIKE :area', { area: `%${query.area}%` });
    }
    if (query?.activo !== undefined) {
      qb.andWhere('c.activo = :activo', { activo: query.activo });
    }

    return qb;
  }



  async create(dto: CreateMaestroCursoDto): Promise<MaestroCurso> {

    const dup = await this.cursoRepo.findOne({

      where: { nombre: dto.nombre, nivel: dto.nivel, activo: true },

    });

    if (dup) {

      throw new BadRequestException(

        `Ya existe un curso activo "${dto.nombre}" en ${dto.nivel}`,

      );

    }



    return this.cursoRepo.save(

      this.cursoRepo.create({

        ...dto,

        activo: dto.activo ?? true,

      }),

    );

  }



  async update(id: number, dto: UpdateMaestroCursoDto): Promise<MaestroCurso> {

    const curso = await this.getOrFail(id);

    if (dto.nombre !== undefined || dto.nivel !== undefined) {

      const nombre = dto.nombre ?? curso.nombre;

      const nivel = dto.nivel ?? curso.nivel;

      const dup = await this.cursoRepo.findOne({

        where: { nombre, nivel, activo: true },

      });

      if (dup && dup.id !== id) {

        throw new BadRequestException(

          `Ya existe un curso activo "${nombre}" en ${nivel}`,

        );

      }

    }

    Object.assign(curso, dto);

    return this.cursoRepo.save(curso);

  }



  async remove(id: number): Promise<{ deleted: boolean; id: number }> {

    const curso = await this.getOrFail(id);

    curso.activo = false;

    await this.cursoRepo.save(curso);

    return { deleted: true, id };

  }



  private async getOrFail(id: number): Promise<MaestroCurso> {

    const curso = await this.cursoRepo.findOneBy({ id });

    if (!curso) throw new NotFoundException(`Curso maestro ${id} no encontrado`);

    return curso;

  }

}


