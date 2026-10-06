import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalonesService, SectionOccupancyItem } from '../maestros/salones/salones.service';
import { Institution } from '../institution/entities/institution.entity';
import { Student } from '../students/entities/student.entity';
import { TransferRequest } from './entities/transfer-request.entity';

export interface TransferVacancySnapshot {
  vacanteDisponible: boolean;
  vacantesDisponibles: number;
  vacantesEnSeccion: number | null;
  seccionAsignada: string | null;
  seccionSugerida: string | null;
  grado: string;
  nivel: string;
  secciones: SectionOccupancyItem[];
}

@Injectable()
export class TransferVacancyService {
  constructor(
    private readonly salonesService: SalonesService,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async previewVacanteDestino(
    row: TransferRequest,
    student: Student,
  ): Promise<TransferVacancySnapshot> {
    return this.resolveVacancyInfo(row, student);
  }

  async assertVacanteDestino(
    row: TransferRequest,
    student: Student,
    seccionDestino?: string,
  ): Promise<TransferVacancySnapshot> {
    const seccionNorm = seccionDestino?.trim().toUpperCase() || undefined;
    const snapshot = await this.resolveVacancyInfo(row, student, seccionNorm);

    if (!snapshot.vacanteDisponible) {
      throw new BadRequestException(
        `No hay vacantes disponibles en la IE de destino para ${student.grado} ${student.nivel}.`,
      );
    }

    if (seccionNorm) {
      const match = snapshot.secciones.find((s) => s.seccion === seccionNorm);
      if (!match || match.disponibles <= 0) {
        throw new BadRequestException(
          `La sección ${seccionNorm} no tiene vacantes disponibles en la IE de destino.`,
        );
      }
      return { ...snapshot, seccionAsignada: seccionNorm };
    }

    const conCupo = snapshot.secciones.filter((s) => s.disponibles > 0);
    if (conCupo.length === 1) {
      return { ...snapshot, seccionAsignada: conCupo[0]!.seccion };
    }
    if (conCupo.length > 1) {
      throw new BadRequestException(
        'Indique la sección de destino: hay más de una sección con vacantes disponibles.',
      );
    }

    if (snapshot.seccionSugerida) {
      return { ...snapshot, seccionAsignada: snapshot.seccionSugerida };
    }

    throw new BadRequestException(
      'No hay vacantes disponibles en la IE de destino para este grado.',
    );
  }

  private async resolveVacancyInfo(
    row: TransferRequest,
    student: Student,
    seccionDestino?: string,
  ): Promise<TransferVacancySnapshot> {
    const institutionId = await this.resolveDestinoInstitutionId(row);
    const secciones = await this.salonesService.getSectionOccupancyForInstitution(
      institutionId,
      student.nivel,
      student.grado,
      row.anioEscolar,
    );

    const totalDisponibles = secciones.reduce((sum, item) => sum + item.disponibles, 0);
    const primeraConCupo = secciones.find((s) => s.disponibles > 0) ?? null;

    if (seccionDestino) {
      const match = secciones.find((s) => s.seccion === seccionDestino);
      const enSeccion = match?.disponibles ?? 0;
      return {
        vacanteDisponible: enSeccion > 0 || totalDisponibles > 0,
        vacantesDisponibles: enSeccion > 0 ? enSeccion : totalDisponibles,
        vacantesEnSeccion: enSeccion,
        seccionAsignada: enSeccion > 0 ? seccionDestino : null,
        seccionSugerida:
          enSeccion > 0 ? seccionDestino : primeraConCupo?.seccion ?? null,
        grado: student.grado,
        nivel: student.nivel,
        secciones,
      };
    }

    return {
      vacanteDisponible: totalDisponibles > 0,
      vacantesDisponibles: totalDisponibles,
      vacantesEnSeccion: null,
      seccionAsignada: null,
      seccionSugerida: primeraConCupo?.seccion ?? null,
      grado: student.grado,
      nivel: student.nivel,
      secciones,
    };
  }

  private async resolveDestinoInstitutionId(row: TransferRequest): Promise<number> {
    if (row.ieDestinoInstitutionId) return row.ieDestinoInstitutionId;
    const destino = await this.institutionRepo.findOneBy({
      codigoModular: row.ieDestinoCodigoModular.trim(),
    });
    if (!destino) {
      throw new NotFoundException(
        'La IE de destino no está registrada en el padrón institucional.',
      );
    }
    return destino.id;
  }
}
