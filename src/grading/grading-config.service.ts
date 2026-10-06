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
  private readonly cacheByInstitution = new Map<number, GradingConfigDto>();

  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(institutionId?: number): Promise<GradingConfigDto> {
    const row = institutionId
      ? await this.institutionRepo.findOneBy({ id: institutionId })
      : (await this.institutionRepo.find({ take: 1, order: { id: 'ASC' } }))[0];
    if (!row) {
      const fallback = DEFAULT_GRADING_CONFIG;
      if (institutionId != null && institutionId > 0) {
        this.cacheByInstitution.set(institutionId, fallback);
      } else {
        this.cache = fallback;
      }
      return fallback;
    }
    const config = buildGradingConfig({
      sistemaEval: row.sistemaEval,
      tipoPeriodo: row.tipoPeriodo,
      notaMinima: row.notaMinima,
      escalaLogro: row.escalaLogro,
    });
    if (institutionId != null && institutionId > 0) {
      this.cacheByInstitution.set(institutionId, config);
    } else {
      this.cache = config;
    }
    return config;
  }

  getConfig(): GradingConfigDto {
    return this.cache;
  }

  async getConfigForInstitution(
    institutionId?: number,
  ): Promise<GradingConfigDto> {
    if (institutionId == null || institutionId < 1) {
      return DEFAULT_GRADING_CONFIG;
    }
    const cached = this.cacheByInstitution.get(institutionId);
    if (cached) return cached;
    return this.refresh(institutionId);
  }

  async getConfigFresh(institutionId?: number): Promise<GradingConfigDto> {
    return this.refresh(institutionId);
  }

  nivelFromNota(nota: number, escalaOverride?: GradingConfigDto['escalaLogro']): string {
    const escala = escalaOverride ?? this.cache.escalaLogro;
    return nivelFromNotaConfig(nota, escala);
  }

  isAprobado(nota: number): boolean {
    return nota >= this.cache.notaMinima;
  }
}
