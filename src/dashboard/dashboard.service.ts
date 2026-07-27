import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { Attendance } from '../attendances/entities/attendance.entity';
import { StudentCharge } from '../treasury/entities/student-charge.entity';
import { TreasuryService } from '../treasury/treasury.service';
import { SalonesService } from '../maestros/salones/salones.service';
import { DashboardStatsDto, DashboardVacanteDto } from './dto/dashboard-stats.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Docente)
    private readonly docenteRepo: Repository<Docente>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(StudentCharge)
    private readonly chargeRepo: Repository<StudentCharge>,
    private readonly treasuryService: TreasuryService,
    private readonly salonesService: SalonesService,
  ) {}

  async getStats(anioEscolar?: number): Promise<DashboardStatsDto> {
    const anio = anioEscolar ?? new Date().getFullYear();

    const [estudiantesMatriculados, docentesActivos, asistencia, treasury, vacantes] =
      await Promise.all([
        this.studentRepo.count({
          where: { activo: true, estadoMatricula: 'activo' },
        }),
        this.docenteRepo.count({ where: { estado: 'activo' } }),
        this.calcAsistenciaPromedio(anio),
        this.treasuryService.getTreasurySummary(anio),
        this.loadVacantesDisponibles(anio),
      ]);

    const familiasConDeuda = await this.countFamiliasConDeuda(anio);
    const pagosPendientes =
      Math.round((treasury.pendiente + treasury.vencido) * 100) / 100;

    return {
      anioEscolar: anio,
      estudiantesMatriculados,
      docentesActivos,
      asistenciaPromedio: asistencia.promedio,
      pagosPendientes,
      familiasConDeuda,
      totalRegistrosAsistencia: asistencia.total,
      vacantesDisponibles: vacantes,
    };
  }

  private async loadVacantesDisponibles(
    anio: number,
  ): Promise<DashboardVacanteDto[]> {
    const items = await this.salonesService.findVacancies({ anioEscolar: anio });

    return items
      .filter((v) => v.disponibles > 0)
      .sort((a, b) => {
        const byDisp = b.disponibles - a.disponibles;
        if (byDisp !== 0) return byDisp;
        const nivel = a.nivel.localeCompare(b.nivel, 'es');
        if (nivel !== 0) return nivel;
        const grado = a.grado.localeCompare(b.grado, 'es', { numeric: true });
        if (grado !== 0) return grado;
        return a.seccion.localeCompare(b.seccion, 'es');
      })
      .map((v) => ({
        id: v.id,
        nivel: v.nivel,
        grado: v.grado,
        seccion: v.seccion,
        label: `${v.grado} ${v.nivel} "${v.seccion}"`,
        capacidad: v.aforo,
        matriculados: v.matriculados,
        disponibles: v.disponibles,
        estado: v.estado,
      }));
  }

  private async calcAsistenciaPromedio(
    anio: number,
  ): Promise<{ promedio: number; total: number }> {
    const ini = `${anio}-01-01`;
    const fin = `${anio}-12-31`;

    const raw = await this.attendanceRepo
      .createQueryBuilder('a')
      .select('a.estado', 'estado')
      .addSelect('COUNT(*)', 'count')
      .where('a.fecha >= :ini AND a.fecha <= :fin', { ini, fin })
      .groupBy('a.estado')
      .getRawMany<{ estado: string; count: string }>();

    let total = 0;
    let presentes = 0;
    for (const row of raw) {
      const count = Number(row.count) || 0;
      total += count;
      if (row.estado === 'P') presentes += count;
    }

    const promedio = total
      ? Math.round((presentes / total) * 1000) / 10
      : 0;

    return { promedio, total };
  }

  private async countFamiliasConDeuda(anio: number): Promise<number> {
    const charges = await this.chargeRepo.find({
      where: { anioEscolar: anio },
    });

    const conDeuda = new Set<number>();
    for (const charge of charges) {
      const saldo = Math.max(
        Number(charge.monto) - Number(charge.montoPagado),
        0,
      );
      if (saldo > 0) conDeuda.add(charge.studentId);
    }
    return conDeuda.size;
  }
}
