import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { MaestroFeriado } from './entities/maestro-feriado.entity';
import {
  CreateMaestroFeriadoDto,
  UpdateMaestroFeriadoDto,
} from './dto/maestro-feriado.dto';
import { MAESTRO_FERIADOS_SEED } from './feriados-seed.data';

export interface DiasClaseResumen {
  anioEscolar: number;
  desde: string;
  hasta: string;
  diasLaborables: number;
  feriadosEnRango: Array<{ fecha: string; nombre: string; tipo: string }>;
  diasClase: number;
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

@Injectable()
export class FeriadosMaestrosService {
  constructor(
    @InjectRepository(MaestroFeriado)
    private readonly feriadoRepo: Repository<MaestroFeriado>,
  ) {}

  async seedCatalogIfEmpty(): Promise<void> {
    const count = await this.feriadoRepo.count();
    if (count > 0) return;
    await this.feriadoRepo.save(
      MAESTRO_FERIADOS_SEED.map((f) =>
        this.feriadoRepo.create({ ...f, activo: true, descripcion: '' }),
      ),
    );
  }

  findAll(query?: {
    anioEscolar?: number;
    activo?: boolean;
    desde?: string;
    hasta?: string;
  }): Promise<MaestroFeriado[]> {
    const qb = this.feriadoRepo
      .createQueryBuilder('f')
      .orderBy('f.fecha', 'ASC');

    if (query?.anioEscolar) {
      qb.andWhere('f.anioEscolar = :anioEscolar', {
        anioEscolar: query.anioEscolar,
      });
    }
    if (query?.activo !== undefined) {
      qb.andWhere('f.activo = :activo', { activo: query.activo });
    }
    if (query?.desde) {
      qb.andWhere('f.fecha >= :desde', { desde: query.desde });
    }
    if (query?.hasta) {
      qb.andWhere('f.fecha <= :hasta', { hasta: query.hasta });
    }

    return qb.getMany();
  }

  async create(dto: CreateMaestroFeriadoDto): Promise<MaestroFeriado> {
    const dup = await this.feriadoRepo.findOne({
      where: { anioEscolar: dto.anioEscolar, fecha: dto.fecha, activo: true },
    });
    if (dup) {
      throw new BadRequestException(
        `Ya existe un feriado activo el ${dto.fecha} para el año ${dto.anioEscolar}`,
      );
    }

    return this.feriadoRepo.save(
      this.feriadoRepo.create({
        ...dto,
        tipo: dto.tipo ?? 'institucional',
        descripcion: dto.descripcion?.trim() ?? '',
        activo: dto.activo ?? true,
      }),
    );
  }

  async update(id: number, dto: UpdateMaestroFeriadoDto): Promise<MaestroFeriado> {
    const feriado = await this.getOrFail(id);
    const anioEscolar = dto.anioEscolar ?? feriado.anioEscolar;
    const fecha = dto.fecha ?? feriado.fecha;

    if (dto.anioEscolar !== undefined || dto.fecha !== undefined) {
      const dup = await this.feriadoRepo.findOne({
        where: { anioEscolar, fecha, activo: true },
      });
      if (dup && dup.id !== id) {
        throw new BadRequestException(
          `Ya existe un feriado activo el ${fecha} para el año ${anioEscolar}`,
        );
      }
    }

    Object.assign(feriado, dto);
    if (dto.descripcion !== undefined) {
      feriado.descripcion = dto.descripcion.trim();
    }
    return this.feriadoRepo.save(feriado);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const feriado = await this.getOrFail(id);
    feriado.activo = false;
    await this.feriadoRepo.save(feriado);
    return { deleted: true, id };
  }

  async isFeriado(fecha: string, anioEscolar?: number): Promise<boolean> {
    const anio = anioEscolar ?? parseIsoDate(fecha).getUTCFullYear();
    const count = await this.feriadoRepo.count({
      where: { fecha, anioEscolar: anio, activo: true },
    });
    return count > 0;
  }

  async getFeriadoEnFecha(
    fecha: string,
    anioEscolar?: number,
  ): Promise<MaestroFeriado | null> {
    const anio = anioEscolar ?? parseIsoDate(fecha).getUTCFullYear();
    return this.feriadoRepo.findOne({
      where: { fecha, anioEscolar: anio, activo: true },
    });
  }

  async calcularDiasClase(
    desde: string,
    hasta: string,
    anioEscolar?: number,
  ): Promise<DiasClaseResumen> {
    const start = parseIsoDate(desde);
    const end = parseIsoDate(hasta);
    if (start > end) {
      throw new BadRequestException('La fecha "desde" debe ser anterior a "hasta"');
    }

    const anio = anioEscolar ?? start.getUTCFullYear();
    const feriados = await this.feriadoRepo.find({
      where: {
        anioEscolar: anio,
        activo: true,
        fecha: Between(desde, hasta),
      },
      order: { fecha: 'ASC' },
    });

    const feriadoSet = new Set(feriados.map((f) => f.fecha));
    let diasLaborables = 0;
    let feriadosLaborables = 0;

    const cursor = new Date(start);
    while (cursor <= end) {
      if (isWeekday(cursor)) {
        diasLaborables++;
        const iso = formatIsoDate(cursor);
        if (feriadoSet.has(iso)) feriadosLaborables++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      anioEscolar: anio,
      desde,
      hasta,
      diasLaborables,
      feriadosEnRango: feriados.map((f) => ({
        fecha: f.fecha,
        nombre: f.nombre,
        tipo: f.tipo,
      })),
      diasClase: diasLaborables - feriadosLaborables,
    };
  }

  private async getOrFail(id: number): Promise<MaestroFeriado> {
    const feriado = await this.feriadoRepo.findOneBy({ id });
    if (!feriado) {
      throw new NotFoundException(`Feriado ${id} no encontrado`);
    }
    return feriado;
  }
}

export { parseIsoDate, formatIsoDate, isWeekday };
