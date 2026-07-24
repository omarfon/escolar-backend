import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from '../institution/entities/institution.entity';
import {
  buildGradingConfig,
  DEFAULT_GRADING_CONFIG,
  GradingConfigDto,
  nivelFromNotaConfig,
} from './grading-config.types';

@Injectable()
export class GradingConfigService implements OnModuleInit {
  private cache: GradingConfigDto = DEFAULT_GRADING_CONFIG;

  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<GradingConfigDto> {
    const institution = await this.institutionRepo.find({
      take: 1,
      order: { id: 'ASC' },
    });
    const row = institution[0];
    if (!row) {
      this.cache = DEFAULT_GRADING_CONFIG;
      return this.cache;
    }
    this.cache = buildGradingConfig({
      sistemaEval: row.sistemaEval,
      tipoPeriodo: row.tipoPeriodo,
      notaMinima: row.notaMinima,
      escalaLogro: row.escalaLogro,
    });
    return this.cache;
  }

  getConfig(): GradingConfigDto {
    return this.cache;
  }

  async getConfigFresh(): Promise<GradingConfigDto> {
    return this.refresh();
  }

  nivelFromNota(nota: number, escalaOverride?: GradingConfigDto['escalaLogro']): string {
    const escala = escalaOverride ?? this.cache.escalaLogro;
    return nivelFromNotaConfig(nota, escala);
  }

  isAprobado(nota: number): boolean {
    return nota >= this.cache.notaMinima;
  }
}
