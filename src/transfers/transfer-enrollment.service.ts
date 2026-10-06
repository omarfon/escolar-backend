import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Institution } from '../institution/entities/institution.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { Student } from '../students/entities/student.entity';
import { TransferRequest } from './entities/transfer-request.entity';
import { TransferVacancyService } from './transfer-vacancy.service';

export interface MatriculaDestinoSnapshot {
  studentId: number;
  institutionId: number;
  codigoModular: string;
  seccion: string;
  grado: string;
  nivel: string;
  estadoMatricula: string;
  transferRequestId: number;
}

@Injectable()
export class TransferEnrollmentService {
  constructor(private readonly transferVacancy: TransferVacancyService) {}

  assertListoParaConcluir(row: TransferRequest): void {
    if (!row.seccionDestino?.trim()) {
      throw new BadRequestException(
        'La solicitud no tiene sección de destino asignada. Debe aprobarse con vacante disponible.',
      );
    }
  }

  async registrarMatriculaDestino(
    manager: EntityManager,
    row: TransferRequest,
  ): Promise<{ anterior: Record<string, unknown>; nuevo: MatriculaDestinoSnapshot }> {
    this.assertListoParaConcluir(row);

    const students = manager.getRepository(Student);
    const historyRepo = manager.getRepository(StudentAcademicHistory);
    const institutions = manager.getRepository(Institution);

    const student = await students.findOne({
      where: { id: row.studentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    const destinoId = await this.resolveDestinoInstitutionId(row, institutions);
    const seccion = row.seccionDestino!.trim().toUpperCase();
    const dni = student.dni?.trim();

    if (dni) {
      const duplicado = await students.findOne({
        where: {
          institutionId: destinoId,
          dni,
          estadoMatricula: 'activo',
          activo: true,
        },
      });
      if (duplicado && duplicado.id !== student.id) {
        throw new ConflictException(
          'Ya existe un estudiante activo con el mismo DNI en la IE de destino.',
        );
      }
    }

    await this.transferVacancy.assertVacanteDestino(row, student, seccion);

    const anterior = {
      institutionId: student.institutionId,
      seccion: student.seccion,
      estadoMatricula: student.estadoMatricula,
      activo: student.activo,
    };

    student.institutionId = destinoId;
    student.seccion = seccion;
    student.estadoMatricula = 'activo';
    student.activo = true;
    await students.save(student);

    const anio = String(row.anioEscolar);
    const history = await historyRepo.findOne({
      where: { studentId: student.id, anio },
    });
    if (history) {
      history.grado = student.grado;
      history.seccion = seccion;
      history.estado = 'Matriculado por traslado';
      history.institutionId = destinoId;
      history.codigoInstitucion = row.ieDestinoCodigoModular;
      await historyRepo.save(history);
    } else {
      await historyRepo.save(
        historyRepo.create({
          studentId: student.id,
          anio,
          grado: student.grado,
          seccion,
          promedio: 0,
          estado: 'Matriculado por traslado',
          institutionId: destinoId,
          codigoInstitucion: row.ieDestinoCodigoModular,
        }),
      );
    }

    return {
      anterior,
      nuevo: {
        studentId: student.id,
        institutionId: destinoId,
        codigoModular: row.ieDestinoCodigoModular,
        seccion,
        grado: student.grado,
        nivel: student.nivel,
        estadoMatricula: student.estadoMatricula,
        transferRequestId: row.id,
      },
    };
  }

  private async resolveDestinoInstitutionId(
    row: TransferRequest,
    institutions: ReturnType<EntityManager['getRepository']>,
  ): Promise<number> {
    if (row.ieDestinoInstitutionId) return row.ieDestinoInstitutionId;
    const destino = await institutions.findOneBy({
      codigoModular: row.ieDestinoCodigoModular.trim(),
    });
    if (!destino) {
      throw new BadRequestException(
        'La IE de destino no está registrada en el padrón institucional.',
      );
    }
    return destino.id;
  }
}
