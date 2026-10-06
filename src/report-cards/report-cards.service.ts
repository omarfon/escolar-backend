import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CompetencyEvaluationsService,
  CompetencyMatrixResponse,
} from '../competency-evaluations/competency-evaluations.service';
import {
  calcPromedioNivel,
} from '../competency-evaluations/competency-evaluations.util';
import {
  CompetencyEvaluation,
  NivelLogro,
} from '../competency-evaluations/entities/competency-evaluation.entity';
import { InstitutionPeriodo } from '../institution/entities/institution.entity';
import { InstitutionService } from '../institution/institution.service';
import { Student } from '../students/entities/student.entity';
import { GenerateReportCardsDto, UpdateReportCardBodyDto } from './dto/report-card.dto';
import {
  ReportCard,
  ReportCardEstado,
} from './entities/report-card.entity';
import {
  InstitucionPdfInfo,
  ReportCardsPdfService,
} from './report-cards-pdf.service';

export interface LibretaFirmaDto {
  nombre: string;
  cargo: string;
  fechaFirma: string;
  firmado: boolean;
}

export interface LibretaCompetenciaDto {
  codigo: string;
  nombre: string;
  niveles: Record<number, NivelLogro | null>;
}

export interface LibretaAreaDto {
  nombre: string;
  emoji: string;
  competencias: LibretaCompetenciaDto[];
  promediosPorBimestre: Record<number, NivelLogro | null>;
}

export interface LibretaDto {
  id?: number;
  alumnoId: number;
  alumno: string;
  nivel: string;
  grado: string;
  seccion: string;
  bimestre: number;
  anio: number;
  bimestresVisibles: number[];
  estado: ReportCardEstado;
  areas: LibretaAreaDto[];
  promediosPorBimestre: Record<number, NivelLogro | null>;
  promedioGlobal: NivelLogro | null;
  firmaDirector: LibretaFirmaDto;
  firmaTutor: LibretaFirmaDto;
  observaciones: string;
}

export interface LibretaInstitucionDto {
  nombre: string;
  siglas: string;
  codigoModular: string;
  ruc: string;
  tipoGestion: string;
  ugel: string;
  dre: string;
  resolucion: string;
  direccion: string;
  distrito: string;
  provincia: string;
  region: string;
  telefono: string;
  email: string;
  director: string;
  subdirector: string;
  anioLectivo: number;
  tipoPeriodo: string;
  periodos: InstitutionPeriodo[];
}

export interface LibretaListResponse {
  institucion: LibretaInstitucionDto;
  bimestre: number;
  bimestresVisibles: number[];
  bimestresDisponibles: number[];
  nivel: string;
  grado: string;
  seccion: string;
  anio: number;
  resumen: {
    total: number;
    pendiente: number;
    generada: number;
    firmada: number;
  };
  libretas: LibretaDto[];
}

@Injectable()
export class ReportCardsService {
  constructor(
    @InjectRepository(ReportCard)
    private readonly reportCardRepo: Repository<ReportCard>,
    @InjectRepository(CompetencyEvaluation)
    private readonly evalRepo: Repository<CompetencyEvaluation>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly competencyService: CompetencyEvaluationsService,
    private readonly institutionService: InstitutionService,
    private readonly pdfService: ReportCardsPdfService,
  ) {}

  async list(query: {
    nivel: string;
    grado: string;
    seccion: string;
    bimestre: number;
    anio?: number;
    estado?: ReportCardEstado | 'todos';
  }): Promise<LibretaListResponse> {
    const institutionId = await this.resolveInstitutionIdForSection(
      query.nivel,
      query.grado,
      query.seccion,
    );
    const inst = await this.getInstitucionSnapshot(institutionId);
    const anioLectivo = query.anio ?? inst.anioLectivo;

    const matrix = await this.competencyService.getMatrix({
      nivel: query.nivel,
      grado: query.grado,
      seccion: query.seccion,
      bimestre: query.bimestre,
      anio: anioLectivo,
    });

    const competenciaIds = matrix.areas.flatMap((a) =>
      a.competencias.map((c) => c.id),
    );
    const studentIds = matrix.alumnos.map((a) => a.id);
    const evalAnio = matrix.curriculum.anio;

    const bimestresDisponibles = this.resolveBimestresDisponibles(
      inst.periodos,
    );
    const bimestreActivo = bimestresDisponibles.includes(query.bimestre)
      ? query.bimestre
      : (bimestresDisponibles[bimestresDisponibles.length - 1] ?? 1);

    const bimestresVisibles = this.resolveBimestresTranscurridos(
      inst.periodos,
      bimestreActivo,
    );

    const evaluaciones = await this.loadEvaluations(
      studentIds,
      competenciaIds,
      evalAnio,
      bimestresVisibles,
    );

    const cards = await this.loadCards(
      studentIds,
      bimestreActivo,
      anioLectivo,
    );

    let libretas = matrix.alumnos.map((al) =>
      this.buildLibreta(
        al.id,
        al.nombre,
        al.grado,
        al.seccion,
        query.nivel,
        matrix,
        evaluaciones.filter((e) => e.studentId === al.id),
        cards.get(al.id),
        inst,
        anioLectivo,
        bimestreActivo,
        bimestresVisibles,
      ),
    );

    if (query.estado && query.estado !== 'todos') {
      libretas = libretas.filter((l) => l.estado === query.estado);
    }

    return {
      institucion: inst,
      bimestre: bimestreActivo,
      bimestresVisibles,
      bimestresDisponibles,
      nivel: query.nivel,
      grado: query.grado,
      seccion: query.seccion,
      anio: anioLectivo,
      resumen: {
        total: libretas.length,
        pendiente: libretas.filter((l) => l.estado === 'pendiente').length,
        generada: libretas.filter((l) => l.estado === 'generada').length,
        firmada: libretas.filter((l) => l.estado === 'firmada').length,
      },
      libretas,
    };
  }

  async getOne(
    studentId: number,
    query: {
      nivel: string;
      grado: string;
      seccion: string;
      bimestre: number;
      anio?: number;
    },
  ): Promise<LibretaDto> {
    const list = await this.list({ ...query, estado: 'todos' });
    const found = list.libretas.find((l) => l.alumnoId === studentId);
    if (!found) {
      throw new NotFoundException('Libreta no encontrada para el alumno');
    }
    return found;
  }

  async generate(dto: GenerateReportCardsDto) {
    const list = await this.list({ ...dto, estado: 'todos' });
    const targets = dto.studentIds?.length
      ? list.libretas.filter((l) => dto.studentIds!.includes(l.alumnoId))
      : list.libretas.filter((l) => l.estado === 'pendiente');

    let generated = 0;
    for (const lib of targets) {
      await this.upsertCard(lib, { estado: 'generada', generadaAt: new Date() });
      generated++;
    }

    return { generated, bimestre: dto.bimestre, anio: list.anio };
  }

  async update(studentId: number, dto: UpdateReportCardBodyDto) {
    const lib = await this.getOne(studentId, dto);
    const patch = this.mapUpdateDto(dto);
    const merged: LibretaDto = {
      ...lib,
      observaciones: patch.observaciones ?? lib.observaciones,
      estado: patch.estado ?? lib.estado,
      firmaDirector: patch.firmaDirector
        ? { ...lib.firmaDirector, ...patch.firmaDirector }
        : lib.firmaDirector,
      firmaTutor: patch.firmaTutor
        ? { ...lib.firmaTutor, ...patch.firmaTutor }
        : lib.firmaTutor,
    };
    if (
      merged.firmaDirector.firmado &&
      merged.firmaTutor.firmado &&
      merged.estado !== 'firmada'
    ) {
      merged.estado = 'firmada';
    } else if (
      merged.estado === 'firmada' &&
      (!merged.firmaDirector.firmado || !merged.firmaTutor.firmado)
    ) {
      merged.estado = 'generada';
    }
    await this.upsertCard(merged);
    return this.getOne(studentId, dto);
  }

  async pdfOne(
    studentId: number,
    query: {
      nivel: string;
      grado: string;
      seccion: string;
      bimestre: number;
      anio?: number;
    },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const lib = await this.getOne(studentId, query);
    const institutionId = await this.resolveInstitutionIdForSection(
      query.nivel,
      query.grado,
      query.seccion,
    );
    const inst = await this.getInstitucionPdf(institutionId);
    const buffer = await this.pdfService.buildSingle(lib, inst);
    const safeName = lib.alumno.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    return {
      buffer,
      filename: `libreta_${safeName}_B${lib.bimestre}.pdf`,
    };
  }

  async pdfSalon(query: {
    nivel: string;
    grado: string;
    seccion: string;
    bimestre: number;
    anio?: number;
    studentIds?: number[];
  }): Promise<{ buffer: Buffer; filename: string }> {
    const list = await this.list({ ...query, estado: 'todos' });
    const libretas = query.studentIds?.length
      ? list.libretas.filter((l) => query.studentIds!.includes(l.alumnoId))
      : list.libretas;

    if (!libretas.length) {
      throw new NotFoundException('No hay libretas para generar el PDF');
    }

    const institutionId = await this.resolveInstitutionIdForSection(
      query.nivel,
      query.grado,
      query.seccion,
    );
    const inst = await this.getInstitucionPdf(institutionId);
    const buffer = await this.pdfService.buildSalon(libretas, inst);
    const gradoSafe = query.grado.replace(/[^\w°]/g, '');
    return {
      buffer,
      filename: `libretas_${query.nivel}_${gradoSafe}_${query.seccion}_B${query.bimestre}.pdf`,
    };
  }

  private async loadCards(
    studentIds: number[],
    bimestre: number,
    anio: number,
  ): Promise<Map<number, ReportCard>> {
    if (!studentIds.length) return new Map();
    const rows = await this.reportCardRepo
      .createQueryBuilder('r')
      .where('r.studentId IN (:...ids)', { ids: studentIds })
      .andWhere('r.bimestre = :bimestre', { bimestre })
      .andWhere('r.anio = :anio', { anio })
      .getMany();
    return new Map(rows.map((r) => [r.studentId, r]));
  }

  private async loadEvaluations(
    studentIds: number[],
    competenciaIds: number[],
    anio: number,
    bimestres: number[],
  ): Promise<CompetencyEvaluation[]> {
    if (!studentIds.length || !competenciaIds.length || !bimestres.length) {
      return [];
    }
    return this.evalRepo.find({
      where: {
        anio,
        bimestre: In(bimestres),
        studentId: In(studentIds),
        competenciaId: In(competenciaIds),
      },
    });
  }

  private resolveBimestresDisponibles(
    periodos: InstitutionPeriodo[] | undefined,
  ): number[] {
    return [1, 2, 3, 4].filter((b) =>
      this.esBimestreTranscurrido(periodos, b),
    );
  }

  private esBimestreTranscurrido(
    periodos: InstitutionPeriodo[] | undefined,
    bimestre: number,
  ): boolean {
    const periodo = (periodos ?? []).find(
      (p) => p.tipo === 'bimestre' && p.numero === bimestre,
    );

    if (!periodo) {
      return bimestre <= 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fin = new Date(periodo.fin);
    fin.setHours(23, 59, 59, 999);
    return fin < today || periodo.actual;
  }

  private resolveBimestresTranscurridos(
    periodos: InstitutionPeriodo[] | undefined,
    hastaBimestre: number,
  ): number[] {
    return [1, 2, 3, 4]
      .filter(
        (b) =>
          b <= hastaBimestre && this.esBimestreTranscurrido(periodos, b),
      );
  }

  private buildLibreta(
    studentId: number,
    nombre: string,
    grado: string,
    seccion: string,
    nivel: string,
    matrix: CompetencyMatrixResponse,
    evaluaciones: CompetencyEvaluation[],
    card: ReportCard | undefined,
    inst: LibretaInstitucionDto,
    anioLectivo: number,
    bimestreActivo: number,
    bimestresVisibles: number[],
  ): LibretaDto {
    const evalMap = new Map<string, NivelLogro>();
    for (const e of evaluaciones) {
      evalMap.set(`${e.competenciaId}-${e.bimestre}`, e.nivelLogro);
    }

    const areas: LibretaAreaDto[] = matrix.areas.map((area) => {
      const competencias = area.competencias.map((c) => {
        const niveles: Record<number, NivelLogro | null> = {};
        for (const b of bimestresVisibles) {
          niveles[b] = evalMap.get(`${c.id}-${b}`) ?? null;
        }
        return {
          codigo: c.codigo,
          nombre: c.nombre,
          niveles,
        };
      });

      const promediosPorBimestre: Record<number, NivelLogro | null> = {};
      for (const b of bimestresVisibles) {
        const vals = competencias
          .map((c) => c.niveles[b])
          .filter((n): n is NivelLogro => n != null);
        promediosPorBimestre[b] = calcPromedioNivel(vals);
      }

      return {
        nombre: area.nombre,
        emoji: area.emoji,
        competencias,
        promediosPorBimestre,
      };
    });

    const promediosPorBimestre: Record<number, NivelLogro | null> = {};
    for (const b of bimestresVisibles) {
      const vals = evaluaciones
        .filter((e) => e.bimestre === b)
        .map((e) => e.nivelLogro);
      promediosPorBimestre[b] = calcPromedioNivel(vals);
    }

    const evalsActivo = evaluaciones.filter((e) => e.bimestre === bimestreActivo);
    const hasEval = evalsActivo.length > 0;
    let estado: ReportCardEstado = card?.estado ?? (hasEval ? 'pendiente' : 'pendiente');

    const firmaDirector: LibretaFirmaDto = {
      nombre: inst.director,
      cargo: 'Director(a)',
      fechaFirma: card?.firmaDirectorFecha || '',
      firmado: card?.firmaDirectorFirmado ?? false,
    };
    const firmaTutor: LibretaFirmaDto = {
      nombre: card?.firmaTutorNombre || '',
      cargo: card?.firmaTutorCargo || 'Docente Tutor(a)',
      fechaFirma: card?.firmaTutorFecha || '',
      firmado: card?.firmaTutorFirmado ?? false,
    };

    if (card) {
      estado = card.estado;
    } else if (firmaDirector.firmado && firmaTutor.firmado) {
      estado = 'firmada';
    }

    return {
      id: card?.id,
      alumnoId: studentId,
      alumno: nombre,
      nivel,
      grado,
      seccion,
      bimestre: bimestreActivo,
      anio: anioLectivo,
      bimestresVisibles,
      estado,
      areas,
      promediosPorBimestre,
      promedioGlobal: promediosPorBimestre[bimestreActivo] ?? null,
      firmaDirector,
      firmaTutor,
      observaciones: card?.observaciones ?? '',
    };
  }

  private async upsertCard(
    lib: LibretaDto,
    extra?: Partial<ReportCard>,
  ): Promise<ReportCard> {
    let card = lib.id
      ? await this.reportCardRepo.findOneBy({ id: lib.id })
      : await this.reportCardRepo.findOneBy({
          studentId: lib.alumnoId,
          bimestre: lib.bimestre,
          anio: lib.anio,
        });

    const data: Partial<ReportCard> = {
      studentId: lib.alumnoId,
      bimestre: lib.bimestre,
      anio: lib.anio,
      estado: lib.estado,
      observaciones: lib.observaciones,
      firmaDirectorNombre: lib.firmaDirector.nombre,
      firmaDirectorCargo: lib.firmaDirector.cargo,
      firmaDirectorFirmado: lib.firmaDirector.firmado,
      firmaDirectorFecha: lib.firmaDirector.fechaFirma,
      firmaTutorNombre: lib.firmaTutor.nombre,
      firmaTutorCargo: lib.firmaTutor.cargo,
      firmaTutorFirmado: lib.firmaTutor.firmado,
      firmaTutorFecha: lib.firmaTutor.fechaFirma,
      ...extra,
    };

    if (card) {
      Object.assign(card, data);
    } else {
      card = this.reportCardRepo.create(data);
    }

    return this.reportCardRepo.save(card);
  }

  private mapUpdateDto(dto: UpdateReportCardBodyDto): Partial<LibretaDto> {
    const patch: Partial<LibretaDto> = {};
    if (dto.observaciones !== undefined) patch.observaciones = dto.observaciones;
    if (dto.estado !== undefined) patch.estado = dto.estado;
    if (
      dto.firmaDirectorNombre !== undefined ||
      dto.firmaDirectorCargo !== undefined ||
      dto.firmaDirectorFirmado !== undefined ||
      dto.firmaDirectorFecha !== undefined
    ) {
      patch.firmaDirector = {
        nombre: dto.firmaDirectorNombre ?? '',
        cargo: dto.firmaDirectorCargo ?? 'Director(a)',
        firmado: dto.firmaDirectorFirmado ?? false,
        fechaFirma: dto.firmaDirectorFecha ?? '',
      };
    }
    if (
      dto.firmaTutorNombre !== undefined ||
      dto.firmaTutorCargo !== undefined ||
      dto.firmaTutorFirmado !== undefined ||
      dto.firmaTutorFecha !== undefined
    ) {
      patch.firmaTutor = {
        nombre: dto.firmaTutorNombre ?? '',
        cargo: dto.firmaTutorCargo ?? 'Docente Tutor(a)',
        firmado: dto.firmaTutorFirmado ?? false,
        fechaFirma: dto.firmaTutorFecha ?? '',
      };
    }
    return patch;
  }

  private async getInstitucionSnapshot(institutionId: number): Promise<LibretaInstitucionDto> {
    const config = await this.institutionService.getConfig(institutionId);
    const inst = config?.institution;
    const anioLectivo =
      parseInt(String(inst?.anio ?? new Date().getFullYear()), 10) ||
      new Date().getFullYear();

    return {
      nombre: inst?.nombre ?? 'Institución Educativa',
      siglas: inst?.siglas ?? '',
      codigoModular: inst?.codigoModular ?? '',
      ruc: inst?.ruc ?? '',
      tipoGestion: inst?.tipoGestion ?? '',
      ugel: inst?.ugel ?? '',
      dre: inst?.dre ?? '',
      resolucion: inst?.resolucion ?? '',
      direccion: inst?.direccion ?? '',
      distrito: inst?.distrito ?? '',
      provincia: inst?.provincia ?? '',
      region: inst?.region ?? '',
      telefono: inst?.telefono ?? '',
      email: inst?.email ?? '',
      director: inst?.director ?? '',
      subdirector: inst?.subdirector ?? '',
      anioLectivo,
      tipoPeriodo: inst?.tipoPeriodo ?? 'bimestre',
      periodos: (inst?.periodos as InstitutionPeriodo[] | undefined) ?? [],
    };
  }

  private async getInstitucionPdf(institutionId: number): Promise<InstitucionPdfInfo> {
    const inst = await this.getInstitucionSnapshot(institutionId);
    return {
      ...inst,
      anioLectivo: String(inst.anioLectivo),
    };
  }

  private async resolveInstitutionIdForSection(
    nivel: string,
    grado: string,
    seccion: string,
  ): Promise<number> {
    const student = await this.studentRepo.findOne({
      where: { nivel, grado, seccion },
      select: { institutionId: true },
    });
    if (!student?.institutionId) {
      throw new BadRequestException(
        'No se pudo determinar la institución del aula indicada',
      );
    }
    return student.institutionId;
  }
}
