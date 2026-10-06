import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  esSuperusuarioSiagie,
  institutionIdDeAlcance,
} from '../auth/siagie-access.util';
import {
  Curriculum,
  CurriculumTipoEscala,
} from '../curricula/entities/curriculum.entity';
import { Institution } from '../institution/entities/institution.entity';
import {
  UpdateGradingScaleConfigDto,
  UpdateNivelEscalaDto,
} from './dto/grading-scale-config.dto';
import { GradingScaleConfigHistory } from './entities/grading-scale-config-history.entity';
import { GradingConfigService } from './grading-config.service';
import {
  GradingConfigDto,
  normalizeSistemaEval,
  normalizeTipoPeriodo,
} from './grading-config.types';
import { buildRangeValidationContext } from './grading-range.util';
import {
  labelTipoEscala,
  modalidadFromSistemaEval,
  modalidadFromTipoEscala,
  snapshotInstitutionScale,
  validateEscalaLogro,
  validateNotaMinima,
} from './grading-scale-config.util';

export interface GradingScaleNivelItem {
  curriculumId: number;
  nivel: string;
  anio: number;
  estado: string;
  version: string;
  tipoEscala: CurriculumTipoEscala;
  tipoEscalaLabel: string;
  modalidad: string;
  editable: boolean;
}

export interface GradingScaleContextResponse {
  institucion: {
    id: number;
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel: string;
    dre: string;
  } | null;
  config: GradingConfigDto & { modalidad: string; modalidadLabel: string };
  escalasPorNivel: GradingScaleNivelItem[];
  permisos: {
    consultar: boolean;
    configurar: boolean;
  };
  validacionRangos: ReturnType<typeof buildRangeValidationContext>;
  alcance: 'IE' | 'SIAGIE' | 'UGEL' | 'DRE' | 'MINEDU';
}

@Injectable()
export class GradingScaleConfigService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Curriculum)
    private readonly curriculumRepo: Repository<Curriculum>,
    @InjectRepository(GradingScaleConfigHistory)
    private readonly historyRepo: Repository<GradingScaleConfigHistory>,
    private readonly gradingConfigService: GradingConfigService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(
    user?: RequestUser,
    req?: { query?: Record<string, unknown>; headers?: Record<string, string | string[] | undefined> },
  ): Promise<GradingScaleContextResponse> {
    const institutionId = institutionIdDeAlcance(user, req);
    const institution = institutionId
      ? await this.institutionRepo.findOneBy({ id: institutionId })
      : await this.institutionRepo.findOne({ order: { id: 'ASC' } });

    const config = institution
      ? await this.gradingConfigService.getConfigForInstitution(institution.id)
      : await this.gradingConfigService.getConfig();

    const anio = institution
      ? Number(institution.anio) || new Date().getFullYear()
      : new Date().getFullYear();

    const curricula = institution
      ? await this.curriculumRepo.find({
          where: { institutionId: institution.id, anio },
          order: { nivel: 'ASC', estado: 'ASC' },
        })
      : [];

    const vigentes = this.pickVigentesPorNivel(curricula);

    return {
      institucion: institution
        ? {
            id: institution.id,
            nombre: institution.nombre,
            siglas: institution.siglas,
            anioEscolar: anio,
            ugel: institution.ugel,
            dre: institution.dre,
          }
        : null,
      config: {
        ...config,
        modalidad: modalidadFromSistemaEval(config.sistemaEval),
        modalidadLabel: this.labelModalidad(config.sistemaEval),
      },
      escalasPorNivel: vigentes.map((c) => ({
        curriculumId: c.id,
        nivel: c.nivel,
        anio: c.anio,
        estado: c.estado,
        version: c.version,
        tipoEscala: c.tipoEscala,
        tipoEscalaLabel: labelTipoEscala(c.tipoEscala),
        modalidad: modalidadFromTipoEscala(c.tipoEscala),
        editable: c.estado !== 'inactivo',
      })),
      permisos: {
        consultar: this.canConsult(user),
        configurar: this.canConfigure(user),
      },
      validacionRangos: buildRangeValidationContext(config),
      alcance: this.resolveAlcance(user),
    };
  }

  async updateInstitutionScale(
    dto: UpdateGradingScaleConfigDto,
    user?: RequestUser,
    institutionId?: number,
  ): Promise<GradingConfigDto> {
    this.assertCanConfigure(user);
    if (institutionId == null) {
      throw new BadRequestException(
        'Seleccione una institución educativa para configurar la escala',
      );
    }

    const institution = await this.institutionRepo.findOneBy({ id: institutionId });
    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    const before = snapshotInstitutionScale({
      sistemaEval: institution.sistemaEval,
      tipoPeriodo: institution.tipoPeriodo,
      notaMinima: institution.notaMinima,
      escalaLogro: institution.escalaLogro,
    });

    const nextSistema = dto.sistemaEval ?? institution.sistemaEval;
    const nextPeriodo = dto.tipoPeriodo ?? institution.tipoPeriodo;
    const nextMinima = dto.notaMinima ?? institution.notaMinima;
    const nextEscala = dto.escalaLogro ?? institution.escalaLogro;

    const minError = validateNotaMinima(nextMinima);
    if (minError) throw new BadRequestException(minError);

    const escalaError = validateEscalaLogro(nextEscala, nextMinima);
    if (escalaError) throw new BadRequestException(escalaError);

    institution.sistemaEval = normalizeSistemaEval(nextSistema);
    institution.tipoPeriodo = normalizeTipoPeriodo(nextPeriodo);
    institution.notaMinima = nextMinima;
    institution.escalaLogro = { AD: nextEscala.AD, A: nextEscala.A, B: nextEscala.B };

    const saved = await this.institutionRepo.manager.transaction(async (manager) => {
      const instRepo = manager.getRepository(Institution);
      const histRepo = manager.getRepository(GradingScaleConfigHistory);
      const row = await instRepo.save(institution);
      await histRepo.save(
        histRepo.create({
          institutionId,
          alcance: 'institucion',
          curriculumId: null,
          nivel: '',
          accion: 'actualizar',
          valorAnterior: before,
          valorNuevo: snapshotInstitutionScale(row),
          motivo: dto.motivo?.trim() || 'Actualización de escala institucional',
          actorUserId: user?.id ? Number(user.id) : null,
          actorNombre: user?.username ?? '',
          actorRol: user?.rolPrincipal ?? '',
        }),
      );
      return row;
    });

    const config = await this.gradingConfigService.refresh(saved.id);

    this.auditLogger.log({
      accion: 'configurar',
      modulo: 'evaluacion',
      entidad: 'escala_evaluacion',
      descripcion: 'Configuración de escala de evaluación institucional',
      institutionId,
      detalle: { valorAnterior: before, valorNuevo: snapshotInstitutionScale(saved) },
      usuarioNombre: user?.username,
      usuarioRol: user?.rolPrincipal,
    });

    return config;
  }

  async updateNivelScale(
    curriculumId: number,
    dto: UpdateNivelEscalaDto,
    user?: RequestUser,
    institutionId?: number,
  ): Promise<GradingScaleNivelItem> {
    this.assertCanConfigure(user);

    const curriculum = await this.curriculumRepo.findOneBy({ id: curriculumId });
    if (!curriculum) {
      throw new NotFoundException(`Currícula ${curriculumId} no encontrada`);
    }
    if (institutionId != null && curriculum.institutionId !== institutionId) {
      throw new NotFoundException(`Currícula ${curriculumId} no encontrada`);
    }
    if (curriculum.estado === 'inactivo') {
      throw new BadRequestException(
        'No se puede modificar la escala de una currícula inactiva',
      );
    }

    const before = {
      tipoEscala: curriculum.tipoEscala,
      version: curriculum.version,
      estado: curriculum.estado,
    };

    curriculum.tipoEscala = dto.tipoEscala;

    const saved = await this.curriculumRepo.manager.transaction(async (manager) => {
      const currRepo = manager.getRepository(Curriculum);
      const histRepo = manager.getRepository(GradingScaleConfigHistory);
      const row = await currRepo.save(curriculum);
      await histRepo.save(
        histRepo.create({
          institutionId: curriculum.institutionId,
          alcance: 'curriculum',
          curriculumId: curriculum.id,
          nivel: curriculum.nivel,
          accion: 'actualizar',
          valorAnterior: before,
          valorNuevo: {
            tipoEscala: row.tipoEscala,
            version: row.version,
            estado: row.estado,
          },
          motivo: dto.motivo?.trim() || `Escala por nivel ${curriculum.nivel}`,
          actorUserId: user?.id ? Number(user.id) : null,
          actorNombre: user?.username ?? '',
          actorRol: user?.rolPrincipal ?? '',
        }),
      );
      return row;
    });

    this.auditLogger.log({
      accion: 'configurar',
      modulo: 'evaluacion',
      entidad: 'escala_evaluacion_nivel',
      descripcion: `Escala de evaluación por nivel (${saved.nivel})`,
      institutionId: saved.institutionId,
      entidadId: String(saved.id),
      detalle: { valorAnterior: before, valorNuevo: { tipoEscala: saved.tipoEscala } },
      usuarioNombre: user?.username,
      usuarioRol: user?.rolPrincipal,
    });

    return {
      curriculumId: saved.id,
      nivel: saved.nivel,
      anio: saved.anio,
      estado: saved.estado,
      version: saved.version,
      tipoEscala: saved.tipoEscala,
      tipoEscalaLabel: labelTipoEscala(saved.tipoEscala),
      modalidad: modalidadFromTipoEscala(saved.tipoEscala),
      editable: saved.estado !== 'inactivo',
    };
  }

  async listHistory(
    institutionId: number | undefined,
    page = 1,
    pageSize = 20,
  ): Promise<{
    items: Array<{
      id: number;
      alcance: string;
      nivel: string;
      motivo: string;
      actorNombre: string;
      actorRol: string;
      valorAnterior: Record<string, unknown> | null;
      valorNuevo: Record<string, unknown>;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    if (institutionId == null) {
      throw new BadRequestException(
        'Seleccione una institución educativa para consultar el historial',
      );
    }

    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));

    const [rows, total] = await this.historyRepo.findAndCount({
      where: { institutionId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        alcance: r.alcance,
        nivel: r.nivel,
        motivo: r.motivo,
        actorNombre: r.actorNombre,
        actorRol: r.actorRol,
        valorAnterior: r.valorAnterior,
        valorNuevo: r.valorNuevo,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages: Math.max(1, Math.ceil(total / safeSize)),
    };
  }

  private pickVigentesPorNivel(curricula: Curriculum[]): Curriculum[] {
    const byNivel = new Map<string, Curriculum>();
    for (const row of curricula) {
      const current = byNivel.get(row.nivel);
      if (!current) {
        byNivel.set(row.nivel, row);
        continue;
      }
      const rank = (estado: string) =>
        estado === 'activo' ? 0 : estado === 'borrador' ? 1 : 2;
      if (rank(row.estado) < rank(current.estado)) {
        byNivel.set(row.nivel, row);
      }
    }
    return [...byNivel.values()].sort((a, b) => a.nivel.localeCompare(b.nivel));
  }

  private labelModalidad(sistema: string): string {
    const mod = modalidadFromSistemaEval(normalizeSistemaEval(sistema));
    if (mod === 'cualitativa') return 'Cualitativa (competencias / logro)';
    if (mod === 'mixta') return 'Mixta (numérica + competencias)';
    return 'Cuantitativa (0–20)';
  }

  private canConsult(user?: RequestUser): boolean {
    return (
      !!user?.permisos?.includes('evaluacion.ver') ||
      !!user?.permisos?.includes('evaluacion.configurar') ||
      !!user?.permisos?.includes('admin.institucional')
    );
  }

  private canConfigure(user?: RequestUser): boolean {
    return (
      !!user?.permisos?.includes('evaluacion.configurar') ||
      !!user?.permisos?.includes('admin.institucional')
    );
  }

  private assertCanConfigure(user?: RequestUser): void {
    if (!this.canConfigure(user)) {
      throw new ForbiddenException(
        'No tiene permiso para configurar escalas de evaluación',
      );
    }
  }

  private resolveAlcance(
    user?: RequestUser,
  ): GradingScaleContextResponse['alcance'] {
    if (!user) return 'IE';
    if (esSuperusuarioSiagie(user)) return 'SIAGIE';
    const roles = user.roles ?? [];
    if (roles.includes('MINEDU')) return 'MINEDU';
    if (roles.includes('DRE')) return 'DRE';
    if (roles.includes('UGEL')) return 'UGEL';
    return 'IE';
  }
}
