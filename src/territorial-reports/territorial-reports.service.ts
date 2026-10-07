import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Request } from 'express';
import { Attendance } from '../attendances/entities/attendance.entity';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { Grade } from '../grades/entities/grade.entity';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { Student } from '../students/entities/student.entity';
import type { NormalizedTerritorialReportQuery } from './dto/territorial-report-query.dto';
import { REPORT_SOURCE } from './territorial-reports.constants';
import {
  esAlcanceTerritorial,
  nivelAlcanceReporte,
  resolveReportScope,
  type ReportScope,
} from '../evaluation-reports/evaluation-reports-scope.util';
import {
  paginateRows,
  type EvaluationReportResponse,
  type ReportColumn,
  type ReportMeta,
  type ReportRow,
  matchesBusqueda as matchSearch,
} from '../evaluation-reports/evaluation-reports.util';

export interface TerritorialReportContext {
  institucion: {
    id: number;
    nombre: string;
    siglas: string;
    dre: string;
    ugel: string;
    anioEscolar: number;
  };
  alcance: {
    nivel: string;
    dre: string | null;
    ugel: string | null;
    label: string;
    consolidado: boolean;
    institucionesCount: number;
  };
  bimestreActual: number;
  anioEscolar: number;
  mesActual: string;
  tiposDisponibles: string[];
  permisoConsulta: string;
  permisoExportacion: string;
  filtros: {
    bimestres: number[];
    dres: string[];
    ugels: string[];
  };
  fuente: string;
}

@Injectable()
export class TerritorialReportsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
  ) {}

  async resolveScope(
    req: Request & { user?: RequestUser },
    dre?: string,
    ugel?: string,
  ): Promise<ReportScope> {
    if (!req.user) {
      throw new NotFoundException('Usuario no autenticado');
    }
    return resolveReportScope(req.user, req, this.institutionRepo, dre, ugel);
  }

  assertTerritorialAccess(user: RequestUser, scope: ReportScope): void {
    if (user.esAdmin) return;

    if (!esAlcanceTerritorial(user)) {
      throw new BadRequestException(
        'Este reporte está disponible solo para usuarios con ámbito UGEL, DRE o MINEDU',
      );
    }
    if (scope.alcance.nivel === 'IE' && scope.mode === 'institucion') {
      throw new BadRequestException(
        'Seleccione un ámbito territorial (DRE/UGEL) o deseleccione la IE para ver el consolidado',
      );
    }
    if (scope.institutionIds.length < 1) {
      throw new BadRequestException('No hay instituciones en el ámbito seleccionado');
    }
  }

  async getContext(scope: ReportScope): Promise<TerritorialReportContext> {
    const institution = await this.resolveInstitution(scope.primaryInstitutionId);
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const allInst = await this.institutionRepo.find({ order: { nombre: 'ASC' } });
    const dres = [...new Set(allInst.map((i) => i.dre).filter(Boolean))].sort();
    const ugels = [...new Set(allInst.map((i) => i.ugel).filter(Boolean))].sort();

    return {
      institucion: {
        id: institution.id,
        nombre: scope.alcance.label,
        siglas: institution.siglas,
        dre: scope.alcance.dre ?? institution.dre,
        ugel: scope.alcance.ugel ?? institution.ugel,
        anioEscolar: Number(institution.anio) || anioEscolar,
      },
      alcance: {
        nivel: scope.alcance.nivel,
        dre: scope.alcance.dre,
        ugel: scope.alcance.ugel,
        label: scope.alcance.label,
        consolidado: true,
        institucionesCount: scope.alcance.institucionesCount,
      },
      bimestreActual,
      anioEscolar,
      mesActual: this.currentMes(),
      tiposDisponibles: ['consolidado_ugel_dre'],
      permisoConsulta: 'dashboard.reportes',
      permisoExportacion: 'dashboard.reportes',
      filtros: {
        bimestres: [1, 2, 3, 4].filter((b) => b <= bimestreActual),
        dres,
        ugels,
      },
      fuente: REPORT_SOURCE,
    };
  }

  async buildReport(
    query: NormalizedTerritorialReportQuery,
    scope: ReportScope,
    user: RequestUser,
  ): Promise<EvaluationReportResponse> {
    this.assertTerritorialAccess(user, scope);
    this.assertTerritorialFilters(scope, query);

    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const bimestre = query.bimestre ?? bimestreActual;
    if (bimestre > bimestreActual) {
      throw new BadRequestException(
        `El bimestre ${bimestre} aún no está habilitado. Periodo actual: ${bimestreActual}° bimestre.`,
      );
    }

    const mes = query.mes ?? this.currentMes();
    const institutions = await this.institutionRepo.find({
      where: { id: In(scope.institutionIds) },
      order: { nombre: 'ASC' },
    });

    const columns: ReportColumn[] = [
      { key: 'institucion', label: 'Institución' },
      { key: 'dre', label: 'DRE' },
      { key: 'ugel', label: 'UGEL' },
      { key: 'alumnosTotal', label: 'Alumnos total' },
      { key: 'alumnosActivos', label: 'Matrícula activa' },
      { key: 'asistenciaPct', label: '% Asistencia (mes)' },
      { key: 'notasRegistradas', label: 'Notas registradas' },
      { key: 'alumnosConNotas', label: 'Alumnos con notas' },
      { key: 'evaluacionAvancePct', label: '% Avance evaluación' },
    ];

    const rows: ReportRow[] = [];
    let sumActivos = 0;
    let sumTotal = 0;
    let sumNotas = 0;
    let sumConNotas = 0;
    let asistenciaWeighted = 0;
    let asistenciaWeight = 0;

    for (const inst of institutions) {
      const metrics = await this.metricsForInstitution(inst.id, bimestre, mes);
      const row: ReportRow = {
        institucion: inst.siglas || inst.nombre,
        dre: inst.dre ?? '—',
        ugel: inst.ugel ?? '—',
        alumnosTotal: metrics.alumnosTotal,
        alumnosActivos: metrics.alumnosActivos,
        asistenciaPct: metrics.asistenciaPct,
        notasRegistradas: metrics.notasRegistradas,
        alumnosConNotas: metrics.alumnosConNotas,
        evaluacionAvancePct: metrics.evaluacionAvancePct,
      };

      if (
        matchSearch(
          query.busqueda,
          row.institucion,
          row.dre,
          row.ugel,
        )
      ) {
        rows.push(row);
      }

      sumTotal += metrics.alumnosTotal;
      sumActivos += metrics.alumnosActivos;
      sumNotas += metrics.notasRegistradas;
      sumConNotas += metrics.alumnosConNotas;
      if (metrics.asistenciaPct != null && metrics.alumnosActivos > 0) {
        asistenciaWeighted += metrics.asistenciaPct * metrics.alumnosActivos;
        asistenciaWeight += metrics.alumnosActivos;
      }
    }

    const meta: ReportMeta = {
      fechaCorte: new Date().toISOString(),
      anioEscolar:
        query.anio ?? (await this.periodosService.resolveAnioEscolarActual()),
      bimestre,
      tipo: query.tipo,
      fuente: REPORT_SOURCE,
      parametros: {
        dre: query.dre,
        ugel: query.ugel,
        bimestre,
        mes,
        busqueda: query.busqueda,
        alcance: scope.alcance.nivel,
      },
      institucion: {
        id: scope.primaryInstitutionId,
        nombre: scope.alcance.label,
        siglas: '',
        dre: scope.alcance.dre ?? '',
        ugel: scope.alcance.ugel ?? '',
        anioEscolar:
          query.anio ?? (await this.periodosService.resolveAnioEscolarActual()),
      },
      alcance: {
        nivel: scope.alcance.nivel,
        dre: scope.alcance.dre,
        ugel: scope.alcance.ugel,
        label: scope.alcance.label,
        consolidado: true,
        institucionesCount: scope.alcance.institucionesCount,
      },
      totales: {
        institucionesIncluidas: institutions.length,
        alumnosTotal: sumTotal,
        alumnosActivos: sumActivos,
        notasRegistradas: sumNotas,
        alumnosConNotas: sumConNotas,
        asistenciaPromedioPct:
          asistenciaWeight > 0
            ? Math.round((asistenciaWeighted / asistenciaWeight) * 10) / 10
            : null,
        evaluacionAvancePct:
          sumActivos > 0
            ? Math.round((sumConNotas / sumActivos) * 1000) / 10
            : null,
      },
    };

    const { items, pagination } = paginateRows(rows, query.page, query.pageSize);
    return { meta, columns, items, pagination };
  }

  private async metricsForInstitution(
    institutionId: number,
    bimestre: number,
    mes: string,
  ): Promise<{
    alumnosTotal: number;
    alumnosActivos: number;
    asistenciaPct: number | null;
    notasRegistradas: number;
    alumnosConNotas: number;
    evaluacionAvancePct: number | null;
  }> {
    const students = await this.studentRepo.find({ where: { institutionId } });
    const seen = new Set<number>();
    const unique = students.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    const alumnosTotal = unique.length;
    const alumnosActivos = unique.filter(
      (s) => s.estadoMatricula === 'activo' && s.activo !== false,
    ).length;
    const studentIds = unique.map((s) => s.id);

    let asistenciaPct: number | null = null;
    if (studentIds.length) {
      const { desde, hasta } = this.mesRange(mes);
      const attendances = await this.attendanceRepo
        .createQueryBuilder('a')
        .where('a.studentId IN (:...ids)', { ids: studentIds })
        .andWhere('a.fecha >= :desde', { desde })
        .andWhere('a.fecha <= :hasta', { hasta })
        .getMany();

      if (attendances.length > 0) {
        const asistieron = attendances.filter(
          (a) => a.estado === 'P' || a.estado === 'T',
        ).length;
        asistenciaPct =
          Math.round((asistieron / attendances.length) * 1000) / 10;
      }
    }

    const grades = await this.gradeRepo.find({
      where: { institutionId, bimestre },
    });
    const alumnosConNotas = new Set(grades.map((g) => g.studentId)).size;
    const evaluacionAvancePct =
      alumnosActivos > 0
        ? Math.round((alumnosConNotas / alumnosActivos) * 1000) / 10
        : null;

    return {
      alumnosTotal,
      alumnosActivos,
      asistenciaPct,
      notasRegistradas: grades.length,
      alumnosConNotas,
      evaluacionAvancePct,
    };
  }

  private assertTerritorialFilters(
    scope: ReportScope,
    query: NormalizedTerritorialReportQuery,
  ): void {
    if (scope.alcance.nivel === 'DRE' && query.dre) {
      const expected = scope.alcance.dre?.trim().toLowerCase();
      if (expected && query.dre.trim().toLowerCase() !== expected) {
        throw new BadRequestException('El filtro DRE no coincide con su ámbito territorial');
      }
    }
    if (scope.alcance.nivel === 'UGEL' && query.ugel) {
      const expected = scope.alcance.ugel?.trim().toLowerCase();
      if (expected && query.ugel.trim().toLowerCase() !== expected) {
        throw new BadRequestException('El filtro UGEL no coincide con su ámbito territorial');
      }
    }
  }

  private currentMes(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private mesRange(mes: string): { desde: string; hasta: string } {
    const [y, m] = mes.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      desde: `${mes}-01`,
      hasta: `${mes}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private async resolveInstitution(institutionId: number): Promise<Institution> {
    const inst = await this.institutionRepo.findOne({ where: { id: institutionId } });
    if (!inst) {
      throw new NotFoundException('Institución educativa no encontrada');
    }
    return inst;
  }
}

export { nivelAlcanceReporte };
