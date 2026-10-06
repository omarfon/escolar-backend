import type { Institution } from '../institution/entities/institution.entity';
import type { TransferRequestEvent } from './entities/transfer-request-event.entity';
import type { TransferRequest } from './entities/transfer-request.entity';

export interface IeSnapshot {
  nombre: string;
  codigoModular: string;
  ugel: string;
  dre: string;
}

export interface PadronDestinoActual {
  encontrada: boolean;
  nombre: string;
  codigoModular: string;
  ugel: string;
  dre: string;
  difiereDelSnapshot: boolean;
  camposDistintos: Array<'nombre' | 'ugel' | 'dre'>;
}

export interface VacanteAprobacionSnapshot {
  seccionAsignada: string | null;
  vacantesDisponibles: number;
  vacantesEnSeccion: number;
  grado: string;
  nivel: string;
  registradaEn: string | null;
}

export interface TransferSnapshotTransparency {
  datosCongeladosEn: string;
  snapshot: {
    ieOrigen: IeSnapshot;
    ieDestino: IeSnapshot;
  };
  padronDestinoActual: PadronDestinoActual | null;
  vacanteAprobacion: VacanteAprobacionSnapshot | null;
}

function iso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
  return date.toISOString();
}

function normalizarTexto(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function buildSnapshotFromRow(row: TransferRequest): TransferSnapshotTransparency['snapshot'] {
  return {
    ieOrigen: {
      nombre: row.ieOrigenNombre,
      codigoModular: row.ieOrigenCodigoModular,
      ugel: row.ieOrigenUgel,
      dre: row.ieOrigenDre,
    },
    ieDestino: {
      nombre: row.ieDestinoNombre,
      codigoModular: row.ieDestinoCodigoModular,
      ugel: row.ieDestinoUgel,
      dre: row.ieDestinoDre,
    },
  };
}

export function compararPadronDestino(
  snapshot: IeSnapshot,
  institution: Institution,
): PadronDestinoActual {
  const camposDistintos: PadronDestinoActual['camposDistintos'] = [];
  if (normalizarTexto(snapshot.nombre) !== normalizarTexto(institution.nombre)) {
    camposDistintos.push('nombre');
  }
  if (normalizarTexto(snapshot.ugel) !== normalizarTexto(institution.ugel)) {
    camposDistintos.push('ugel');
  }
  if (normalizarTexto(snapshot.dre) !== normalizarTexto(institution.dre)) {
    camposDistintos.push('dre');
  }

  return {
    encontrada: true,
    nombre: institution.nombre ?? '',
    codigoModular: institution.codigoModular ?? '',
    ugel: institution.ugel ?? '',
    dre: institution.dre ?? '',
    difiereDelSnapshot: camposDistintos.length > 0,
    camposDistintos,
  };
}

export function extraerVacanteAprobacion(
  eventos: Pick<TransferRequestEvent, 'accion' | 'cambios' | 'createdAt'>[],
): VacanteAprobacionSnapshot | null {
  const aprobaciones = eventos.filter((e) => e.accion === 'aprobar');
  const ultima = aprobaciones.at(-1);
  if (!ultima) return null;

  const cambios = ultima.cambios as {
    nuevo?: { vacante?: Record<string, unknown> };
  } | null;
  const vacante = cambios?.nuevo?.vacante;
  if (!vacante || typeof vacante !== 'object') return null;

  return {
    seccionAsignada:
      typeof vacante.seccionAsignada === 'string' ? vacante.seccionAsignada : null,
    vacantesDisponibles: Number(vacante.vacantesDisponibles ?? 0),
    vacantesEnSeccion: Number(vacante.vacantesEnSeccion ?? 0),
    grado: String(vacante.grado ?? ''),
    nivel: String(vacante.nivel ?? ''),
    registradaEn: iso(ultima.createdAt),
  };
}

export function buildTransferSnapshotTransparency(
  row: TransferRequest,
  eventos: Pick<TransferRequestEvent, 'accion' | 'cambios' | 'createdAt'>[],
  padronDestino: Institution | null,
): TransferSnapshotTransparency {
  const snapshot = buildSnapshotFromRow(row);
  return {
    datosCongeladosEn: iso(row.createdAt),
    snapshot,
    padronDestinoActual: padronDestino
      ? compararPadronDestino(snapshot.ieDestino, padronDestino)
      : {
          encontrada: false,
          nombre: '',
          codigoModular: row.ieDestinoCodigoModular,
          ugel: '',
          dre: '',
          difiereDelSnapshot: false,
          camposDistintos: [],
        },
    vacanteAprobacion: extraerVacanteAprobacion(eventos),
  };
}
