import { BadRequestException } from '@nestjs/common';
import type { StudentDocument } from '../students/entities/student-document.entity';
import type { EvidenciaTrasladoTipo, EvidenciaTrasladoTipoPersistido } from './transfer-evidencia.constants';

export interface EvidenciaTrasladoInput {
  tipo?: EvidenciaTrasladoTipo | null;
  documentId?: number | null;
  referencia?: string | null;
  /** Solo compatibilidad con solicitudes antiguas. */
  legacyTexto?: string | null;
}

export interface EvidenciaTrasladoResuelta {
  tipo: EvidenciaTrasladoTipoPersistido;
  documentId: number | null;
  referencia: string | null;
  evidencia: string;
}

export function etiquetaEvidenciaDocumento(doc: Pick<StudentDocument, 'tipo' | 'numero'>): string {
  const numero = doc.numero?.trim();
  return numero
    ? `Documento: ${doc.tipo} — ${numero}`
    : `Documento: ${doc.tipo}`;
}

export function etiquetaEvidenciaReferencia(referencia: string): string {
  return `Referencia: ${referencia.trim()}`;
}

export function resolverEvidenciaTraslado(
  input: EvidenciaTrasladoInput,
  documento?: Pick<StudentDocument, 'id' | 'tipo' | 'numero'> | null,
): EvidenciaTrasladoResuelta {
  const tipo = input.tipo ?? null;

  if (tipo === 'documento') {
    const documentId = input.documentId ?? null;
    if (!documentId || documentId < 1) {
      throw new BadRequestException('Seleccione un documento del expediente del estudiante.');
    }
    if (!documento || documento.id !== documentId) {
      throw new BadRequestException(
        'El documento de evidencia no pertenece al estudiante de la solicitud.',
      );
    }
    return {
      tipo: 'documento',
      documentId,
      referencia: null,
      evidencia: etiquetaEvidenciaDocumento(documento),
    };
  }

  if (tipo === 'referencia') {
    const referencia = input.referencia?.trim() ?? '';
    if (referencia.length < 5) {
      throw new BadRequestException(
        'Indique la referencia de la resolución o acta (mínimo 5 caracteres).',
      );
    }
    return {
      tipo: 'referencia',
      documentId: null,
      referencia,
      evidencia: etiquetaEvidenciaReferencia(referencia),
    };
  }

  const legacy = input.legacyTexto?.trim() ?? '';
  if (legacy.length >= 5) {
    return {
      tipo: 'legacy',
      documentId: null,
      referencia: legacy,
      evidencia: legacy,
    };
  }

  throw new BadRequestException(
    'Indique la evidencia: documento del expediente o referencia administrativa.',
  );
}

export function assertEvidenciaListaParaEnviar(row: {
  evidenciaTipo: string | null;
  evidenciaDocumentId: number | null;
  evidenciaReferencia: string | null;
  evidencia: string;
}): void {
  if (row.evidenciaTipo === 'documento') {
    if (!row.evidenciaDocumentId) {
      throw new BadRequestException(
        'La solicitud no tiene un documento de evidencia vinculado.',
      );
    }
    return;
  }
  if (row.evidenciaTipo === 'referencia') {
    if ((row.evidenciaReferencia?.trim().length ?? 0) < 5) {
      throw new BadRequestException(
        'La referencia de evidencia es obligatoria antes de enviar.',
      );
    }
    return;
  }
  if ((row.evidencia?.trim().length ?? 0) >= 5) {
    return;
  }
  throw new BadRequestException(
    'Registre evidencia trazable (documento o referencia) antes de enviar la solicitud.',
  );
}
