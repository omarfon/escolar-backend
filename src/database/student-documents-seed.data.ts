import { DocumentoEstado } from '../students/entities/student-document.entity';

export interface StudentDocumentSeedRow {
  tipo: string;
  numero?: string;
  estado: DocumentoEstado;
  fechaEntrega?: string;
}

const ent = (
  tipo: string,
  numero: string,
  fechaEntrega = '15/03/2025',
): StudentDocumentSeedRow => ({
  tipo,
  numero,
  estado: 'entregado',
  fechaEntrega,
});

const pend = (tipo: string): StudentDocumentSeedRow => ({
  tipo,
  numero: '',
  estado: 'pendiente',
  fechaEntrega: '',
});

const venc = (tipo: string, numero = ''): StudentDocumentSeedRow => ({
  tipo,
  numero,
  estado: 'vencido',
  fechaEntrega: '',
});

/** Casuísticas demo para la pantalla Documentos de Estudiantes. */
export const STUDENT_DOCUMENTS_SEED: Record<string, StudentDocumentSeedRow[]> = {
  // 5/7 entregados + 1 vencido + 1 pendiente — barra parcial y obligatorios pendientes
  'estudiante@escolar.pe': [
    ent('DNI del alumno', '71234567', '10/03/2025'),
    ent('Ficha de Matrícula (FUT)', 'FUT-2026-001', '12/03/2025'),
    venc('Certificado de Estudios', 'CERT-2024-001'),
    pend('Libreta de Notas'),
    ent('DNI del padre o madre', '46678123', '10/03/2025'),
    ent('Foto del alumno (2 und.)', 'FOTO-001', '11/03/2025'),
    ent('Ficha de Salud', 'FS-2026-001', '14/03/2025'),
  ],
  // 100% — texto verde en listado
  'p.salazar@estudiante.pe': [
    ent('DNI del alumno', '71234570'),
    ent('Ficha de Matrícula (FUT)', 'FUT-2026-010'),
    ent('Certificado de Estudios', 'CERT-2025-010'),
    ent('Libreta de Notas', 'LN-2025-010'),
    ent('DNI del padre o madre', '40234561'),
    ent('Foto del alumno (2 und.)', 'FOTO-010'),
    ent('Ficha de Salud', 'FS-2026-010'),
  ],
  // 0% — texto rojo en listado
  'm.quispe@estudiante.pe': [
    pend('DNI del alumno'),
    pend('Ficha de Matrícula (FUT)'),
    pend('Certificado de Estudios'),
    pend('Libreta de Notas'),
    pend('DNI del padre o madre'),
    pend('Foto del alumno (2 und.)'),
    pend('Ficha de Salud'),
  ],
  // ~43% — mezcla entregado / pendiente / vencido
  'a.garcia@estudiante.pe': [
    ent('DNI del alumno', '71234574'),
    ent('Ficha de Matrícula (FUT)', 'FUT-2026-020'),
    venc('Certificado de Estudios'),
    pend('Libreta de Notas'),
    pend('DNI del padre o madre'),
    ent('Foto del alumno (2 und.)', 'FOTO-020'),
    pend('Ficha de Salud'),
  ],
  // Secundaria 2° — 5/8 entregados
  's.ramos@estudiante.pe': [
    ent('DNI del alumno', '71234582'),
    ent('Ficha de Matrícula (FUT)', 'FUT-2026-030'),
    ent('Certificado de Estudios', 'CERT-2025-030'),
    pend('Libreta de Notas'),
    ent('DNI del padre o madre', '40890123'),
    pend('Foto del alumno (2 und.)'),
    ent('Ficha de Datos Familiares', 'FDF-2026-030'),
    pend('Ficha de Salud'),
  ],
  // Hermanos Perez — distintos niveles de avance
  'l.torres@estudiante.pe': [
    ent('DNI del alumno', '71234568'),
    ent('Ficha de Matrícula (FUT)', 'FUT-2026-040'),
    ent('Certificado de Estudios', 'CERT-2025-040'),
    pend('Libreta de Notas'),
    ent('DNI del padre o madre', '46678123'),
    pend('Foto del alumno (2 und.)'),
    pend('Ficha de Salud'),
  ],
  'c.mendoza@estudiante.pe': [
    ent('DNI del alumno', '71234569'),
    ent('Ficha de Matrícula (FUT)', 'FUT-2026-041'),
    pend('Certificado de Estudios'),
    pend('Libreta de Notas'),
    pend('DNI del padre o madre'),
    pend('Foto del alumno (2 und.)'),
    pend('Ficha de Salud'),
  ],
  // 4° Primaria — casi completo, falta un obligatorio
  'l.castillo@estudiante.pe': [
    ent('DNI del alumno', '71234579'),
    ent('Ficha de Matrícula (FUT)', 'FUT-2026-050'),
    ent('Certificado de Estudios', 'CERT-2025-050'),
    ent('Libreta de Notas', 'LN-2025-050'),
    pend('DNI del padre o madre'),
    ent('Foto del alumno (2 und.)', 'FOTO-050'),
    ent('Ficha de Salud', 'FS-2026-050'),
  ],
};
