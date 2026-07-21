export interface DocumentoRequerido {
  tipo: string;
  obligatorio: boolean;
}

/** Requisitos documentales por grado (misma fuente que nueva matrícula). */
export const DOCUMENTOS_REQUISITOS: Record<string, DocumentoRequerido[]> = {
  '1° Inicial': [
    { tipo: 'Partida de Nacimiento', obligatorio: true },
    { tipo: 'DNI (si tiene)', obligatorio: false },
    { tipo: 'Carnet de Vacunas', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'DNI del apoderado', obligatorio: true },
  ],
  '2° Inicial': [
    { tipo: 'Partida de Nacimiento', obligatorio: true },
    { tipo: 'DNI (si tiene)', obligatorio: false },
    { tipo: 'Carnet de Vacunas', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'DNI del apoderado', obligatorio: true },
  ],
  '3° Inicial': [
    { tipo: 'Partida de Nacimiento', obligatorio: true },
    { tipo: 'DNI del alumno', obligatorio: false },
    { tipo: 'Carnet de Vacunas', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'DNI del apoderado', obligatorio: true },
  ],
  '1° Primaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Partida de Nacimiento', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
    { tipo: 'Carnet de Vacunas', obligatorio: false },
  ],
  '2° Primaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '3° Primaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '4° Primaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '5° Primaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '6° Primaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '1° Secundaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Partida de Nacimiento', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Datos Familiares', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '2° Secundaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Datos Familiares', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '3° Secundaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Datos Familiares', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '4° Secundaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Datos Familiares', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
  '5° Secundaria': [
    { tipo: 'DNI del alumno', obligatorio: true },
    { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true },
    { tipo: 'Certificado de Estudios', obligatorio: true },
    { tipo: 'Libreta de Notas', obligatorio: true },
    { tipo: 'DNI del padre o madre', obligatorio: true },
    { tipo: 'Foto del alumno (2 und.)', obligatorio: true },
    { tipo: 'Ficha de Datos Familiares', obligatorio: true },
    { tipo: 'Ficha de Salud', obligatorio: false },
  ],
};

function normalizarGradoKey(label: string): string {
  const cleaned = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const numMatch = cleaned.match(/(\d+)/);
  const num = numMatch?.[1] ?? '';
  let nivel = '';
  if (cleaned.includes('primaria')) nivel = 'primaria';
  else if (cleaned.includes('secundaria')) nivel = 'secundaria';
  else if (cleaned.includes('inicial')) nivel = 'inicial';
  return `${num} ${nivel}`.trim();
}

export function requisitosPorGrado(gradoLabel: string): DocumentoRequerido[] {
  const direct = DOCUMENTOS_REQUISITOS[gradoLabel];
  if (direct) return direct;

  const target = normalizarGradoKey(gradoLabel);
  for (const [key, value] of Object.entries(DOCUMENTOS_REQUISITOS)) {
    if (normalizarGradoKey(key) === target) return value;
  }
  return [];
}

export function normalizarTipoDocumento(tipo: string): string {
  return tipo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function tiposEquivalentes(a: string, b: string): boolean {
  const na = normalizarTipoDocumento(a);
  const nb = normalizarTipoDocumento(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export interface DocumentoAlmacenado {
  id?: number;
  tipo: string;
  numero?: string;
  estado: 'pendiente' | 'entregado' | 'vencido';
  fechaEntrega?: string;
  imagenUrl?: string;
}

export interface DocumentoMatriculaVista {
  id?: number;
  tipo: string;
  obligatorio: boolean;
  estado: 'pendiente' | 'entregado' | 'vencido';
  numero: string;
  fechaEntrega: string;
  imagenUrl?: string;
  registrado: boolean;
}

/** Combina requisitos del grado con documentos guardados en BD. */
export function combinarRequisitosConDocumentos(
  gradoLabel: string,
  documentos: DocumentoAlmacenado[],
): DocumentoMatriculaVista[] {
  const requisitos = requisitosPorGrado(gradoLabel);
  const usados = new Set<number>();

  const filas: DocumentoMatriculaVista[] = requisitos.map((req) => {
    const idx = documentos.findIndex(
      (d, i) => !usados.has(i) && tiposEquivalentes(d.tipo, req.tipo),
    );
    if (idx >= 0) {
      usados.add(idx);
      const doc = documentos[idx];
      return {
        id: doc.id,
        tipo: req.tipo,
        obligatorio: req.obligatorio,
        estado: doc.estado,
        numero: doc.numero ?? '',
        fechaEntrega: doc.fechaEntrega ?? '',
        imagenUrl: doc.imagenUrl,
        registrado: true,
      };
    }
    return {
      tipo: req.tipo,
      obligatorio: req.obligatorio,
      estado: 'pendiente',
      numero: '',
      fechaEntrega: '',
      registrado: false,
    };
  });

  documentos.forEach((doc, i) => {
    if (usados.has(i)) return;
    const yaEnRequisitos = requisitos.some((r) =>
      tiposEquivalentes(r.tipo, doc.tipo),
    );
    if (!yaEnRequisitos) {
      filas.push({
        id: doc.id,
        tipo: doc.tipo,
        obligatorio: false,
        estado: doc.estado,
        numero: doc.numero ?? '',
        fechaEntrega: doc.fechaEntrega ?? '',
        imagenUrl: doc.imagenUrl,
        registrado: true,
      });
    }
  });

  return filas;
}
