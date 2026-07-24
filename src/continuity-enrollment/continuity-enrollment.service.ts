import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContinuityEnrollment } from './entities/continuity-enrollment.entity';
import { Student } from '../students/entities/student.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { Grade } from '../grades/entities/grade.entity';
import {
  ApproveAllContinuityDto,
  ApproveContinuityDto,
  GenerateContinuityDto,
  RejectContinuityDto,
} from './dto/continuity-enrollment.dto';
import {
  gradoLabelFromStudent,
  gradoSig,
  seccionPropuesta,
  situacionFromPromedio,
  toCandidateResponse,
  toRecordResponse,
  ContinuityRecordResponse,
  ContinuityCandidateResponse,
} from './continuity-enrollment.mapper';
import { splitGradoLabel } from '../students/students.mapper';
import { SalonesService } from '../maestros/salones/salones.service';
import { splitGradoLabel as splitTargetGrado } from '../maestros/salones/salones.util';
import { GradingConfigService } from '../grading/grading-config.service';

@Injectable()
export class ContinuityEnrollmentService {
  constructor(
    @InjectRepository(ContinuityEnrollment)
    private readonly continuityRepo: Repository<ContinuityEnrollment>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentAcademicHistory)
    private readonly historyRepo: Repository<StudentAcademicHistory>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    private readonly salonesService: SalonesService,
    private readonly gradingConfigService: GradingConfigService,
  ) {}

  async findCandidates(anioOrigen: number, anioNuevo: number) {
    const students = await this.studentRepo.find({
      where: { estadoMatricula: 'activo', activo: true },
      order: { apellido: 'ASC', nombre: 'ASC' },
    });

    const existing = await this.continuityRepo.find({
      where: { anioNuevo },
    });
    const generatedIds = new Set(existing.map((r) => r.studentId));

    const promedios = await this.computePromediosForStudents(
      students.map((s) => s.id),
    );

    const notaMinima = this.gradingConfigService.getConfig().notaMinima;

    const candidates = students.map((student) => {
      const promedio = promedios.get(student.id) ?? 0;
      const situacion = situacionFromPromedio(promedio, notaMinima);
      return toCandidateResponse(
        student,
        promedio,
        situacion,
        generatedIds.has(student.id),
      );
    });

    return Promise.all(
      candidates.map((c) => this.attachVacancyToCandidate(c, anioNuevo)),
    );
  }

  async findRecords(anioNuevo: number, estado?: string) {
    const where: { anioNuevo: number; estado?: ContinuityEnrollment['estado'] } =
      { anioNuevo };
    if (
      estado &&
      estado !== 'all' &&
      ['pendiente', 'aprobado', 'rechazado'].includes(estado)
    ) {
      where.estado = estado as ContinuityEnrollment['estado'];
    }

    const records = await this.continuityRepo.find({
      where,
      order: { fechaGeneracion: 'DESC' },
    });

    if (!records.length) return [];

    const studentIds = [...new Set(records.map((r) => r.studentId))];
    const students = await this.studentRepo.find({
      where: { id: In(studentIds) },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    return Promise.all(
      records.map(async (record) => {
        const student = studentMap.get(record.studentId);
        if (!student) {
          throw new NotFoundException(
            `Estudiante ${record.studentId} no encontrado`,
          );
        }
        const base = toRecordResponse(record, student);
        return this.attachVacancyToRecord(base, anioNuevo);
      }),
    );
  }

  async generate(dto: GenerateContinuityDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Debe incluir al menos un estudiante');
    }

    const studentIds = dto.items.map((i) => i.studentId);
    const students = await this.studentRepo.find({
      where: { id: In(studentIds) },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const existing = await this.continuityRepo.find({
      where: { anioNuevo: dto.anioNuevo, studentId: In(studentIds) },
    });
    const alreadyGenerated = new Set(existing.map((r) => r.studentId));

    const promedios = await this.computePromediosForStudents(studentIds);
    const generadoPor = dto.generadoPor?.trim() || 'Administrador';
    const created: ContinuityEnrollment[] = [];
    const skipped: number[] = [];

    for (const item of dto.items) {
      if (alreadyGenerated.has(item.studentId)) {
        skipped.push(item.studentId);
        continue;
      }

      const student = studentMap.get(item.studentId);
      if (!student) {
        throw new NotFoundException(
          `Estudiante ${item.studentId} no encontrado`,
        );
      }

      const promedio = promedios.get(student.id) ?? 0;
      const situacion =
        item.situacion ??
        situacionFromPromedio(
          promedio,
          this.gradingConfigService.getConfig().notaMinima,
        );
      const gradoAnterior = gradoLabelFromStudent(student);
      const gradoNuevo = gradoSig(gradoAnterior, situacion);
      const seccionNueva =
        item.seccionNueva?.trim() ||
        seccionPropuesta(situacion, student.seccion);

      const record = this.continuityRepo.create({
        studentId: student.id,
        anioAnterior: dto.anioOrigen,
        anioNuevo: dto.anioNuevo,
        gradoAnterior,
        seccionAnterior: student.seccion,
        gradoNuevo,
        seccionNueva,
        promedioFinal: promedio,
        situacion,
        estado: 'pendiente',
        generadoPor,
      });

      created.push(await this.continuityRepo.save(record));
    }

    const createdResponses = await Promise.all(
      created.map(async (record) => {
        const student = studentMap.get(record.studentId)!;
        return toRecordResponse(record, student);
      }),
    );

    return {
      created: createdResponses,
      createdCount: created.length,
      skippedCount: skipped.length,
      skippedStudentIds: skipped,
    };
  }

  async approve(id: number, dto: ApproveContinuityDto) {
    const record = await this.getOrFail(id);
    if (record.estado !== 'pendiente') {
      throw new BadRequestException('Solo se pueden aprobar registros pendientes');
    }

    const target = splitTargetGrado(record.gradoNuevo);
    if (target.nivel && record.seccionNueva && record.seccionNueva !== '—') {
      await this.salonesService.assertVacancyAvailable(
        target.nivel,
        target.grado,
        record.seccionNueva,
        record.anioNuevo,
      );
    }

    const student = await this.studentRepo.findOne({
      where: { id: record.studentId },
    });
    if (!student) {
      throw new NotFoundException(`Estudiante ${record.studentId} no encontrado`);
    }

    await this.applyApprovalToStudent(student, record);

    record.estado = 'aprobado';
    record.aprobadoPor = dto.aprobadoPor?.trim() || 'Administrador';
    record.fechaAprobacion = new Date();
    const saved = await this.continuityRepo.save(record);

    return toRecordResponse(saved, student);
  }

  async approveAll(dto: ApproveAllContinuityDto) {
    const pendientes = await this.continuityRepo.find({
      where: { anioNuevo: dto.anioNuevo, estado: 'pendiente' },
    });

    const results: ContinuityRecordResponse[] = [];
    for (const record of pendientes) {
      const approved = await this.approve(record.id, {
        aprobadoPor: dto.aprobadoPor,
      });
      results.push(approved);
    }

    return { approvedCount: results.length, items: results };
  }

  async reject(id: number, dto: RejectContinuityDto) {
    const record = await this.getOrFail(id);
    if (record.estado !== 'pendiente') {
      throw new BadRequestException('Solo se pueden rechazar registros pendientes');
    }

    record.estado = 'rechazado';
    record.motivoRechazo = dto.motivoRechazo?.trim() || 'Sin especificar';
    const saved = await this.continuityRepo.save(record);

    const student = await this.studentRepo.findOne({
      where: { id: record.studentId },
    });
    if (!student) {
      throw new NotFoundException(`Estudiante ${record.studentId} no encontrado`);
    }

    return toRecordResponse(saved, student);
  }

  private async applyApprovalToStudent(
    student: Student,
    record: ContinuityEnrollment,
  ) {
    const historialEstado =
      record.situacion === 'promovido'
        ? 'Promovido'
        : record.situacion === 'repitente'
          ? 'Repitente'
          : record.situacion === 'egresado'
            ? 'Egresado'
            : 'Retirado';

    await this.historyRepo.save(
      this.historyRepo.create({
        studentId: student.id,
        anio: String(record.anioAnterior),
        grado: record.gradoAnterior,
        seccion: record.seccionAnterior,
        promedio: record.promedioFinal,
        estado: historialEstado,
      }),
    );

    if (record.situacion === 'retirado') {
      student.estadoMatricula = 'retirado';
      student.activo = false;
    } else if (record.situacion === 'egresado') {
      student.estadoMatricula = 'inactivo';
      student.activo = false;
    } else if (record.gradoNuevo !== '—' && record.gradoNuevo !== 'Egresado') {
      const { nivel, grado } = splitGradoLabel(record.gradoNuevo);
      student.nivel = nivel;
      student.grado = grado;
      student.seccion = record.seccionNueva === '—' ? student.seccion : record.seccionNueva;
      student.anioIngreso = String(record.anioNuevo);
      student.estadoMatricula = 'activo';
      student.activo = true;
    }

    await this.studentRepo.save(student);
  }

  private async computePromediosForStudents(
    studentIds: number[],
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!studentIds.length) return map;

    const grades = await this.gradeRepo.find({
      where: { studentId: In(studentIds) },
    });

    const byStudent = new Map<number, Grade[]>();
    for (const g of grades) {
      const list = byStudent.get(g.studentId) ?? [];
      list.push(g);
      byStudent.set(g.studentId, list);
    }

    for (const id of studentIds) {
      const list = byStudent.get(id) ?? [];
      const finals = list.filter((g) => g.tipo === 'final');
      const source = finals.length ? finals : list;
      if (!source.length) {
        map.set(id, 0);
        continue;
      }
      const avg =
        Math.round(
          (source.reduce((s, g) => s + g.nota, 0) / source.length) * 10,
        ) / 10;
      map.set(id, avg);
    }

    return map;
  }

  private async attachVacancyToRecord(
    record: ContinuityRecordResponse,
    anioNuevo: number,
  ): Promise<ContinuityRecordResponse> {
    const target = splitTargetGrado(record.gradoNuevo);
    if (!target.nivel || !record.seccionNueva || record.seccionNueva === '—') {
      return record;
    }
    const vacancies = await this.salonesService.findVacancies({
      anioEscolar: anioNuevo,
      nivel: target.nivel,
      grado: target.grado,
    });
    const match = vacancies.find(
      (v) => v.seccion === record.seccionNueva.trim().toUpperCase(),
    );
    if (!match) return record;
    return {
      ...record,
      vacantesDisponibles: match.disponibles,
      aforoSalon: match.aforo,
    };
  }

  private async attachVacancyToCandidate(
    candidate: ContinuityCandidateResponse,
    anioNuevo: number,
  ): Promise<ContinuityCandidateResponse> {
    const target = splitTargetGrado(candidate.gradoPropuesto);
    if (!target.nivel || !candidate.seccionPropuesta || candidate.seccionPropuesta === '—') {
      return candidate;
    }
    const vacancies = await this.salonesService.findVacancies({
      anioEscolar: anioNuevo,
      nivel: target.nivel,
      grado: target.grado,
    });
    const match = vacancies.find(
      (v) => v.seccion === candidate.seccionPropuesta.trim().toUpperCase(),
    );
    if (!match) return candidate;
    return {
      ...candidate,
      vacantesDisponibles: match.disponibles,
      aforoSalon: match.aforo,
    };
  }

  private async getOrFail(id: number): Promise<ContinuityEnrollment> {
    const record = await this.continuityRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Registro de continuidad ${id} no encontrado`);
    }
    return record;
  }
}
