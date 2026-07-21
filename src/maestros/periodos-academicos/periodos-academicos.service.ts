import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  MaestroPeriodoAcademico,
  MaestroPeriodoEstado,
  MaestroPeriodoTipo,
} from './entities/maestro-periodo-academico.entity';
import {
  CreateMaestroPeriodoAcademicoDto,
  UpdateMaestroPeriodoAcademicoDto,
} from './dto/maestro-periodo-academico.dto';
import { MAESTRO_PERIODOS_ACADEMICOS_SEED } from './periodos-academicos-seed.data';
import { Institution } from '../../institution/entities/institution.entity';

export interface MaestroPeriodoAcademicoResponse {
  id: number;
  anioEscolar: number;
  numero: number;
  nombre: string;
  tipo: MaestroPeriodoTipo;
  inicio: string;
  fin: string;
  actual: boolean;
  descripcion: string;
  activo: boolean;
  estado: MaestroPeriodoEstado;
  inicioDisplay: string;
  finDisplay: string;
  duracionDias: number;
  duracionSemanas: number;
}

@Injectable()
export class PeriodosAcademicosMaestrosService {
  constructor(
    @InjectRepository(MaestroPeriodoAcademico)
    private readonly periodoRepo: Repository<MaestroPeriodoAcademico>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async seedCatalogIfEmpty(): Promise<void> {
    if ((await this.periodoRepo.count()) === 0) {
      await this.migrarDesdeInstitucion();
    }
    if ((await this.periodoRepo.count()) === 0) {
      await this.periodoRepo.save(
        MAESTRO_PERIODOS_ACADEMICOS_SEED.map((p) =>
          this.periodoRepo.create({
            ...p,
            descripcion: p.descripcion ?? '',
            activo: true,
          }),
        ),
      );
      return;
    }

    await this.ensureSeedPeriodos();
  }

  private async ensureSeedPeriodos(): Promise<void> {
    const existing = await this.periodoRepo.find({
      select: { anioEscolar: true, numero: true },
    });
    const keys = new Set(existing.map((p) => `${p.anioEscolar}-${p.numero}`));
    const missing = MAESTRO_PERIODOS_ACADEMICOS_SEED.filter(
      (p) => !keys.has(`${p.anioEscolar}-${p.numero}`),
    );
    if (!missing.length) return;

    await this.periodoRepo.save(
      missing.map((p) =>
        this.periodoRepo.create({
          ...p,
          descripcion: p.descripcion ?? '',
          activo: true,
        }),
      ),
    );
  }

  async findAll(query?: {
    anioEscolar?: number;
    tipo?: string;
    activo?: boolean;
  }): Promise<MaestroPeriodoAcademicoResponse[]> {
    const qb = this.periodoRepo
      .createQueryBuilder('p')
      .orderBy('p.anioEscolar', 'DESC')
      .addOrderBy('p.numero', 'ASC');

    if (query?.anioEscolar) {
      qb.andWhere('p.anioEscolar = :anio', { anio: query.anioEscolar });
    }
    if (query?.tipo) {
      qb.andWhere('p.tipo = :tipo', { tipo: query.tipo });
    }
    if (query?.activo !== undefined) {
      qb.andWhere('p.activo = :activo', { activo: query.activo });
    }

    const rows = await qb.getMany();
    return rows.map((r) => this.toResponse(r));
  }

  async findOne(id: number): Promise<MaestroPeriodoAcademicoResponse> {
    const row = await this.getOrFail(id);
    return this.toResponse(row);
  }

  async create(
    dto: CreateMaestroPeriodoAcademicoDto,
  ): Promise<MaestroPeriodoAcademicoResponse> {
    this.validarFechas(dto.inicio, dto.fin);
    await this.assertUniqueNumero(dto.anioEscolar, dto.numero);

    if (dto.actual) {
      await this.clearActual(dto.anioEscolar);
    }

    const saved = await this.periodoRepo.save(
      this.periodoRepo.create({
        anioEscolar: dto.anioEscolar,
        numero: dto.numero,
        nombre: dto.nombre.trim(),
        tipo: dto.tipo ?? 'bimestre',
        inicio: dto.inicio,
        fin: dto.fin,
        actual: dto.actual ?? false,
        descripcion: dto.descripcion?.trim() ?? '',
        activo: dto.activo ?? true,
      }),
    );
    return this.toResponse(saved);
  }

  async update(
    id: number,
    dto: UpdateMaestroPeriodoAcademicoDto,
  ): Promise<MaestroPeriodoAcademicoResponse> {
    const current = await this.getOrFail(id);
    const inicio = dto.inicio ?? current.inicio;
    const fin = dto.fin ?? current.fin;
    this.validarFechas(inicio, fin);

    const anio = dto.anioEscolar ?? current.anioEscolar;
    const numero = dto.numero ?? current.numero;
    if (anio !== current.anioEscolar || numero !== current.numero) {
      await this.assertUniqueNumero(anio, numero, id);
    }

    if (dto.actual === true) {
      await this.clearActual(anio, id);
    }

    Object.assign(current, {
      ...dto,
      nombre: dto.nombre !== undefined ? dto.nombre.trim() : current.nombre,
      descripcion:
        dto.descripcion !== undefined
          ? dto.descripcion.trim()
          : current.descripcion,
    });

    const saved = await this.periodoRepo.save(current);
    return this.toResponse(saved);
  }

  async marcarActual(id: number): Promise<MaestroPeriodoAcademicoResponse> {
    const current = await this.getOrFail(id);
    await this.clearActual(current.anioEscolar, id);
    current.actual = true;
    const saved = await this.periodoRepo.save(current);
    return this.toResponse(saved);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const current = await this.getOrFail(id);
    current.activo = false;
    current.actual = false;
    await this.periodoRepo.save(current);
    return { deleted: true, id };
  }

  private async migrarDesdeInstitucion(): Promise<void> {
    const inst = await this.dataSource.getRepository(Institution).findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!inst?.periodos?.length) return;

    const anio = Number(inst.anio) || new Date().getFullYear();
    await this.periodoRepo.save(
      inst.periodos.map((p) =>
        this.periodoRepo.create({
          anioEscolar: anio,
          numero: p.numero,
          nombre: p.nombre,
          tipo: (p.tipo as MaestroPeriodoTipo) ?? 'bimestre',
          inicio: p.inicio,
          fin: p.fin,
          actual: p.actual ?? false,
          descripcion: '',
          activo: true,
        }),
      ),
    );
  }

  private async clearActual(anioEscolar: number, excludeId?: number): Promise<void> {
    const qb = this.periodoRepo
      .createQueryBuilder()
      .update(MaestroPeriodoAcademico)
      .set({ actual: false })
      .where('anioEscolar = :anio', { anio: anioEscolar })
      .andWhere('actual = true');
    if (excludeId) {
      qb.andWhere('id != :excludeId', { excludeId });
    }
    await qb.execute();
  }

  private async assertUniqueNumero(
    anioEscolar: number,
    numero: number,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.periodoRepo.findOne({
      where: { anioEscolar, numero },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(
        `Ya existe el periodo ${numero} para el año ${anioEscolar}`,
      );
    }
  }

  private validarFechas(inicio: string, fin: string): void {
    if (fin < inicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior al inicio',
      );
    }
  }

  private async getOrFail(id: number): Promise<MaestroPeriodoAcademico> {
    const row = await this.periodoRepo.findOneBy({ id });
    if (!row) throw new NotFoundException(`Periodo académico ${id} no encontrado`);
    return row;
  }

  private toResponse(row: MaestroPeriodoAcademico): MaestroPeriodoAcademicoResponse {
    const duracionDias = this.diffDays(row.inicio, row.fin) + 1;
    return {
      id: row.id,
      anioEscolar: row.anioEscolar,
      numero: row.numero,
      nombre: row.nombre,
      tipo: row.tipo,
      inicio: row.inicio,
      fin: row.fin,
      actual: row.actual,
      descripcion: row.descripcion,
      activo: row.activo,
      estado: this.resolveEstado(row),
      inicioDisplay: this.formatDate(row.inicio),
      finDisplay: this.formatDate(row.fin),
      duracionDias,
      duracionSemanas: Math.round(duracionDias / 7),
    };
  }

  private resolveEstado(row: MaestroPeriodoAcademico): MaestroPeriodoEstado {
    const today = new Date().toISOString().slice(0, 10);
    if (today < row.inicio) return 'pendiente';
    if (today > row.fin) return 'cerrado';
    return 'en_curso';
  }

  private formatDate(value: string): string {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }

  private diffDays(inicio: string, fin: string): number {
    const a = new Date(`${inicio}T00:00:00Z`).getTime();
    const b = new Date(`${fin}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86_400_000);
  }

  /** Número del bimestre marcado como periodo actual (fallback: 2). */
  async resolveBimestreActual(): Promise<number> {
    const row = await this.periodoRepo.findOne({
      where: { actual: true, tipo: 'bimestre', activo: true },
      order: { numero: 'DESC' },
    });
    return row?.numero ?? 2;
  }

  /** Año escolar del periodo actual (fallback: 2026). */
  async resolveAnioEscolarActual(): Promise<number> {
    const row = await this.periodoRepo.findOne({
      where: { actual: true, tipo: 'bimestre', activo: true },
    });
    return row?.anioEscolar ?? 2026;
  }

  /** Bimestres ya concluidos (fecha fin superada) — elegibles para acta de salon. */
  async resolveBimestresTerminados(anioEscolar?: number): Promise<number[]> {
    const anio = anioEscolar ?? (await this.resolveAnioEscolarActual());
    const rows = await this.periodoRepo.find({
      where: { anioEscolar: anio, tipo: 'bimestre', activo: true },
      order: { numero: 'ASC' },
    });
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((r) => today > r.fin).map((r) => r.numero);
  }
}
