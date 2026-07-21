import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateMaestroFormulaEvaluacionDto,
  UpdateMaestroFormulaEvaluacionDto,
} from './dto/maestro-formula-evaluacion.dto';
import {
  MaestroFormulaEvaluacion,
  FormulaComponente,
  FormulaEscalaLogro,
} from './entities/maestro-formula-evaluacion.entity';
import { MAESTRO_FORMULAS_EVALUACION_SEED } from './formulas-evaluacion-seed.data';
import {
  normalizeComponentes,
  validateComponentes,
} from './evaluation-formula.util';

export interface MaestroFormulaEvaluacionResponse {
  id: number;
  nombre: string;
  codigo: string;
  nivel: string;
  grado: string;
  curso: string;
  bimestre: number | null;
  componentes: FormulaComponente[];
  escalaLogro: FormulaEscalaLogro;
  esDefault: boolean;
  orden: number;
  activo: boolean;
}

export interface ResolveFormulaQuery {
  nivel?: string;
  grado?: string;
  curso?: string;
  bimestre?: number;
}

@Injectable()
export class FormulasEvaluacionMaestrosService {
  constructor(
    @InjectRepository(MaestroFormulaEvaluacion)
    private readonly repo: Repository<MaestroFormulaEvaluacion>,
  ) {}

  async seedCatalogIfEmpty(): Promise<void> {
    await this.seedIfEmpty();
  }

  async findAll(): Promise<MaestroFormulaEvaluacionResponse[]> {
    const rows = await this.repo.find({
      order: { esDefault: 'DESC', orden: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => this.toResponse(row));
  }

  async findOne(id: number): Promise<MaestroFormulaEvaluacionResponse> {
    return this.toResponse(await this.getOrFail(id));
  }

  async resolve(
    query: ResolveFormulaQuery,
  ): Promise<MaestroFormulaEvaluacionResponse> {
    const formula = await this.resolveEntity(query);
    return this.toResponse(formula);
  }

  async resolveEntity(
    query: ResolveFormulaQuery,
  ): Promise<MaestroFormulaEvaluacion> {
    const rows = await this.repo.find({
      where: { activo: true },
      order: { esDefault: 'DESC', orden: 'ASC', id: 'ASC' },
    });

    const nivel = query.nivel?.trim() ?? '';
    const grado = query.grado?.trim() ?? '';
    const curso = query.curso?.trim() ?? '';
    const bimestre = query.bimestre ?? null;

    const scored = rows
      .map((row) => ({
        row,
        score: this.matchScore(row, nivel, grado, curso, bimestre),
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length) return scored[0].row;

    const fallback = rows.find((row) => row.esDefault) ?? rows[0];
    if (!fallback) {
      throw new NotFoundException(
        'No hay fórmulas de evaluación configuradas. Registre una en Maestros.',
      );
    }
    return fallback;
  }

  async create(
    dto: CreateMaestroFormulaEvaluacionDto,
  ): Promise<MaestroFormulaEvaluacionResponse> {
    const componentes = normalizeComponentes(dto.componentes);
    const validation = validateComponentes(componentes);
    if (validation) throw new BadRequestException(validation);

    if (dto.esDefault) {
      await this.repo.update({ esDefault: true }, { esDefault: false });
    }

    const saved = await this.repo.save(
      this.repo.create({
        nombre: dto.nombre.trim(),
        codigo: dto.codigo?.trim() ?? '',
        nivel: dto.nivel?.trim() ?? '',
        grado: dto.grado?.trim() ?? '',
        curso: dto.curso?.trim() ?? '',
        bimestre: dto.bimestre ?? null,
        componentes,
        escalaLogro: dto.escalaLogro ?? { AD: 17.5, A: 14, B: 11 },
        esDefault: dto.esDefault ?? false,
        orden: dto.orden ?? 0,
        activo: dto.estado !== 'inactivo',
      }),
    );

    return this.toResponse(saved);
  }

  async update(
    id: number,
    dto: UpdateMaestroFormulaEvaluacionDto,
  ): Promise<MaestroFormulaEvaluacionResponse> {
    const current = await this.getOrFail(id);

    if (dto.componentes) {
      const componentes = normalizeComponentes(dto.componentes);
      const validation = validateComponentes(componentes);
      if (validation) throw new BadRequestException(validation);
      current.componentes = componentes;
    }

    if (dto.nombre !== undefined) current.nombre = dto.nombre.trim();
    if (dto.codigo !== undefined) current.codigo = dto.codigo.trim();
    if (dto.nivel !== undefined) current.nivel = dto.nivel.trim();
    if (dto.grado !== undefined) current.grado = dto.grado.trim();
    if (dto.curso !== undefined) current.curso = dto.curso.trim();
    if (dto.bimestre !== undefined) current.bimestre = dto.bimestre;
    if (dto.escalaLogro !== undefined) current.escalaLogro = dto.escalaLogro;
    if (dto.orden !== undefined) current.orden = dto.orden;
    if (dto.estado !== undefined) current.activo = dto.estado === 'activo';

    if (dto.esDefault === true) {
      await this.repo.update({ esDefault: true }, { esDefault: false });
      current.esDefault = true;
    } else if (dto.esDefault === false) {
      current.esDefault = false;
    }

    const saved = await this.repo.save(current);
    return this.toResponse(saved);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const current = await this.getOrFail(id);
    if (current.esDefault) {
      throw new BadRequestException(
        'No se puede desactivar la fórmula predeterminada. Asigne otra como predeterminada primero.',
      );
    }
    current.activo = false;
    await this.repo.save(current);
    return { deleted: true, id };
  }

  private matchScore(
    row: MaestroFormulaEvaluacion,
    nivel: string,
    grado: string,
    curso: string,
    bimestre: number | null,
  ): number {
    let score = 0;
    if (row.nivel?.trim()) {
      if (!nivel || row.nivel.trim() !== nivel) return -1;
      score += 10;
    }
    if (row.grado?.trim()) {
      if (!grado || row.grado.trim() !== grado) return -1;
      score += 20;
    }
    if (row.curso?.trim()) {
      if (!curso || row.curso.trim() !== curso) return -1;
      score += 40;
    }
    if (row.bimestre !== null && row.bimestre !== undefined) {
      if (!bimestre || row.bimestre !== bimestre) return -1;
      score += 5;
    }
    if (row.esDefault) score += 1;
    return score;
  }

  private async seedIfEmpty(): Promise<void> {
    if (await this.repo.count()) return;
    await this.repo.save(
      MAESTRO_FORMULAS_EVALUACION_SEED.map((item) => this.repo.create(item)),
    );
  }

  private async getOrFail(id: number): Promise<MaestroFormulaEvaluacion> {
    const row = await this.repo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Fórmula de evaluación ${id} no encontrada`);
    }
    return row;
  }

  private toResponse(
    row: MaestroFormulaEvaluacion,
  ): MaestroFormulaEvaluacionResponse {
    return {
      id: row.id,
      nombre: row.nombre,
      codigo: row.codigo,
      nivel: row.nivel,
      grado: row.grado,
      curso: row.curso,
      bimestre: row.bimestre,
      componentes: normalizeComponentes(row.componentes ?? []),
      escalaLogro: row.escalaLogro ?? { AD: 17.5, A: 14, B: 11 },
      esDefault: row.esDefault,
      orden: row.orden,
      activo: row.activo,
    };
  }
}
