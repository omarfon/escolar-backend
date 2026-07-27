import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';
import { BulkHistorialRowDto } from './dto/bulk-import-historial.dto';

const ESTADOS_VALIDOS = [
  'Promovido',
  'Repitente',
  'Retirado',
  'Traslado',
  'Convalidado',
] as const;

export interface FilaParseadaHistorial extends BulkHistorialRowDto {
  fila: number;
  errores: string[];
  valido: boolean;
}

export interface ParseHistorialFileResult {
  filas: FilaParseadaHistorial[];
  validas: BulkHistorialRowDto[];
  erroresValidacion: Array<{
    fila: number;
    dni: string;
    email: string;
    mensaje: string;
  }>;
}

function normalizeHeader(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 1000 && value <= 9999) {
      return String(value);
    }
    if (Number.isInteger(value) && value >= 0 && value <= 99999999) {
      return String(value).padStart(8, '0').slice(-8);
    }
    return String(value);
  }
  return String(value).trim();
}

function parsePromedio(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function normalizeEstado(value: string): string {
  const v = value.trim();
  if (!v) return 'Promovido';
  const match = ESTADOS_VALIDOS.find(
    (e) => e.toLowerCase() === v.toLowerCase(),
  );
  return match ?? v;
}

function resolveApellidos(data: Record<string, string>): {
  apellidos: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
} {
  const paterno = data.apellido_paterno?.trim() ?? '';
  const materno = data.apellido_materno?.trim() ?? '';
  const combined = data.apellidos?.trim() ?? '';
  if (paterno || materno) {
    const apellidos = [paterno, materno].filter(Boolean).join(' ').trim();
    return { apellidos, apellidoPaterno: paterno, apellidoMaterno: materno };
  }
  if (combined) {
    const parts = combined.split(/\s+/);
    return {
      apellidos: combined,
      apellidoPaterno: parts[0] ?? '',
      apellidoMaterno: parts.slice(1).join(' '),
    };
  }
  return { apellidos: '', apellidoPaterno: '', apellidoMaterno: '' };
}

function validateRow(
  data: Record<string, string>,
  fila: number,
): FilaParseadaHistorial {
  const errores: string[] = [];
  const nombres = data.nombres?.trim() ?? '';
  const { apellidos, apellidoPaterno, apellidoMaterno } = resolveApellidos(data);
  const dni = data.dni?.trim() ?? '';
  const codigo = data.codigo?.trim() ?? '';
  const email = data.email?.trim().toLowerCase() ?? '';
  const nivel = data.nivel?.trim() ?? '';
  const anio = data.anio?.trim() ?? '';
  const grado = data.grado?.trim() ?? '';
  const seccion = data.seccion?.trim().toUpperCase() ?? '';
  const promedioRaw = data.promedio?.trim() ?? '';
  const estado = normalizeEstado(data.estado ?? '');

  const tieneIdentificador =
    !!dni || !!codigo || !!email || (!!nombres && !!apellidos);

  if (!tieneIdentificador) {
    errores.push(
      'Indique datos del alumno: dni, codigo, email o nombres con apellidos',
    );
  }

  if (!nombres) {
    errores.push('Nombres es obligatorio');
  }

  if (!apellidos) {
    errores.push('Apellidos es obligatorio (apellido_paterno/apellido_materno o apellidos)');
  }

  if (!anio) {
    errores.push('Anio es obligatorio');
  } else if (!/^\d{4}$/.test(anio)) {
    errores.push('Anio debe tener 4 digitos (ej. 2024)');
  }

  if (!grado) errores.push('Grado es obligatorio');
  if (!seccion) errores.push('Seccion es obligatoria');

  const promedio = parsePromedio(promedioRaw);
  if (promedio === null) {
    errores.push('Promedio invalido');
  } else if (promedio < 0 || promedio > 20) {
    errores.push('Promedio debe estar entre 0 y 20');
  }

  return {
    fila,
    nombres,
    apellidos,
    apellidoPaterno,
    apellidoMaterno,
    dni,
    codigo,
    email,
    nivel,
    anio,
    grado,
    seccion,
    promedio: promedio ?? 0,
    estado,
    errores,
    valido: errores.length === 0,
  };
}

function buildFilasFromRecords(
  records: Array<{ fila: number; data: Record<string, string> }>,
): FilaParseadaHistorial[] {
  return records
    .filter(({ data }) =>
      Object.values(data).some((v) => String(v ?? '').trim() !== ''),
    )
    .map(({ fila, data }) => validateRow(data, fila));
}

function parseCsvBuffer(buffer: Buffer): FilaParseadaHistorial[] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0]
    .split(delimiter)
    .map((h) => normalizeHeader(h.replace(/^"|"$/g, '')));

  const records = lines.slice(1).map((line, index) => {
    const cells = line.split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim());
    const data: Record<string, string> = {};
    headers.forEach((header, i) => {
      data[header] = cells[i] ?? '';
    });
    return { fila: index + 2, data };
  });

  return buildFilasFromRecords(records);
}

function parseExcelBuffer(buffer: Buffer): FilaParseadaHistorial[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (matrix.length < 2) return [];

  const headers = (matrix[0] ?? []).map((cell) =>
    normalizeHeader(cellToString(cell)),
  );
  const records = matrix.slice(1).map((row, index) => {
    const data: Record<string, string> = {};
    headers.forEach((header, i) => {
      data[header] = cellToString(row[i]);
    });
    return { fila: index + 2, data };
  });

  return buildFilasFromRecords(records);
}

export function parseHistorialFile(
  buffer: Buffer,
  originalname: string,
): ParseHistorialFileResult {
  const ext = originalname.split('.').pop()?.toLowerCase() ?? '';
  let filas: FilaParseadaHistorial[];

  if (ext === 'csv') {
    filas = parseCsvBuffer(buffer);
  } else if (ext === 'xlsx' || ext === 'xls') {
    filas = parseExcelBuffer(buffer);
  } else {
    throw new BadRequestException(
      'Formato no soportado. Use CSV (.csv) o Excel (.xlsx, .xls)',
    );
  }

  if (!filas.length) {
    throw new BadRequestException('El archivo no contiene filas de datos validas');
  }

  const validas = filas
    .filter((f) => f.valido)
    .map(({ fila, errores, valido, ...row }) => ({ ...row, fila }));

  const erroresValidacion = filas
    .filter((f) => !f.valido)
    .map((f) => ({
      fila: f.fila,
      dni: f.dni ?? '',
      email: f.email ?? '',
      mensaje: f.errores.join('; '),
    }));

  return { filas, validas, erroresValidacion };
}
