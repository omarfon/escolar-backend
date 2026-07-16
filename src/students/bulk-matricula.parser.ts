import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';
import { BulkMatriculaRowDto } from './dto/bulk-import-students.dto';

const NIVELES = ['Inicial', 'Primaria', 'Secundaria'] as const;
type Nivel = (typeof NIVELES)[number];

export interface FilaParseadaMatricula extends BulkMatriculaRowDto {
  fila: number;
  errores: string[];
  valido: boolean;
}

export interface ParseMatriculaFileResult {
  filas: FilaParseadaMatricula[];
  validas: BulkMatriculaRowDto[];
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
    if (Number.isInteger(value) && value >= 0 && value <= 99999999) {
      return String(value).padStart(8, '0').slice(-8);
    }
    return String(value);
  }
  return String(value).trim();
}

function normalizeNivel(value: string): Nivel | '' {
  const v = value.trim().toLowerCase();
  if (v === 'inicial') return 'Inicial';
  if (v === 'primaria') return 'Primaria';
  if (v === 'secundaria') return 'Secundaria';
  return '';
}

function normalizeSexo(value: string): 'M' | 'F' | '' {
  const v = value.trim().toUpperCase();
  if (v === 'M' || v === 'F') return v;
  if (v === 'MASCULINO' || v === 'MALE') return 'M';
  if (v === 'FEMENINO' || v === 'FEMALE') return 'F';
  return '';
}

function normalizeGrado(value: string): string {
  return value.replace(/°/g, '').trim();
}

function buildEmail(nombres: string, apellidos: string, dni: string): string {
  if (dni.trim()) return `alumno.${dni.trim()}@estudiante.pe`;
  const slug = `${nombres}.${apellidos}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${slug || 'nuevo.alumno'}@estudiante.pe`;
}

function splitNombreCompleto(full: string): { nombres: string; apellidos: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { nombres: '', apellidos: '' };
  if (parts.length === 1) return { nombres: parts[0], apellidos: '' };
  return { nombres: parts[0], apellidos: parts.slice(1).join(' ') };
}

function validarColumnas(headers: string[]): void {
  const required = ['nombres', 'apellidos', 'dni', 'nivel', 'grado', 'seccion'];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new BadRequestException(
      `La plantilla no tiene las columnas requeridas: ${missing.join(', ')}`,
    );
  }
}

function validarFila(row: BulkMatriculaRowDto & { fila: number }): FilaParseadaMatricula {
  const errores: string[] = [];

  if (!row.nombres.trim()) errores.push('Nombres es obligatorio');
  if (!row.apellidos.trim()) errores.push('Apellidos es obligatorio');
  if (!/^\d{8}$/.test(row.dni)) errores.push('DNI debe tener 8 digitos');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errores.push('Email invalido');
  }
  if (!NIVELES.includes(row.nivel as Nivel)) {
    errores.push(`Nivel invalido. Valores: ${NIVELES.join(', ')}`);
  }
  if (!row.grado) errores.push('Grado es obligatorio');
  if (!/^[A-Z]$/i.test(row.seccion)) {
    errores.push('Seccion debe ser una letra (A, B, C...)');
  }
  if (row.sexo && row.sexo !== 'M' && row.sexo !== 'F') {
    errores.push('Sexo invalido. Valores: M, F');
  }

  const gradoNum = parseInt(row.grado, 10);
  if (row.nivel === 'Inicial' && (gradoNum < 1 || gradoNum > 3)) {
    errores.push('Grado Inicial debe ser 1, 2 o 3');
  }
  if (row.nivel === 'Primaria' && (gradoNum < 1 || gradoNum > 6)) {
    errores.push('Grado Primaria debe ser 1 a 6');
  }
  if (row.nivel === 'Secundaria' && (gradoNum < 1 || gradoNum > 5)) {
    errores.push('Grado Secundaria debe ser 1 a 5');
  }

  return { ...row, errores, valido: errores.length === 0 };
}

function mapRecord(fila: number, data: Record<string, string>): FilaParseadaMatricula {
  const nombres = data['nombres'] ?? '';
  const apellidos = data['apellidos'] ?? '';
  const dni = data['dni'] ?? '';
  const nivel = normalizeNivel(data['nivel'] ?? '');
  const sexoRaw = normalizeSexo(data['sexo'] ?? '');

  const apoderadoFull = data['apoderado_nombres']?.trim() ?? '';
  let apoderadoNombres = apoderadoFull;
  let apoderadoApellidos = data['apoderado_apellidos']?.trim() ?? '';
  if (apoderadoFull && !apoderadoApellidos) {
    const split = splitNombreCompleto(apoderadoFull);
    apoderadoNombres = split.nombres;
    apoderadoApellidos = split.apellidos;
  }

  return validarFila({
    fila,
    nombres: nombres.trim(),
    apellidos: apellidos.trim(),
    dni: dni.trim(),
    email:
      (data['email'] ?? '').trim() ||
      (dni ? buildEmail(nombres, apellidos, dni) : ''),
    sexo: sexoRaw || undefined,
    fechaNac: data['fecha_nac']?.trim() || undefined,
    nivel: (nivel || '') as Nivel,
    grado: normalizeGrado(data['grado'] ?? ''),
    seccion: (data['seccion'] ?? 'A').trim().toUpperCase(),
    anioIngreso: data['anio_ingreso']?.trim() || String(new Date().getFullYear()),
    apoderadoNombres: apoderadoNombres || undefined,
    apoderadoApellidos: apoderadoApellidos || undefined,
    apoderadoDni: data['apoderado_dni']?.trim() || undefined,
    apoderadoTelefono: data['apoderado_telefono']?.trim() || undefined,
    apoderadoEmail: data['apoderado_email']?.trim() || undefined,
  });
}

function buildFilasFromRecords(
  records: { fila: number; data: Record<string, string> }[],
): FilaParseadaMatricula[] {
  if (!records.length) return [];

  const headers = Object.keys(records[0].data);
  validarColumnas(headers);

  const filas = records
    .map(({ fila, data }) => {
      if (!Object.values(data).some(Boolean)) return null;
      return mapRecord(fila, data);
    })
    .filter((row): row is FilaParseadaMatricula => row !== null);

  const dnis = new Set<string>();
  const emails = new Set<string>();
  return filas.map((fila) => {
    const errores = [...fila.errores];
    if (dnis.has(fila.dni)) errores.push('DNI duplicado en el archivo');
    if (fila.email && emails.has(fila.email.toLowerCase())) {
      errores.push('Email duplicado en el archivo');
    }
    dnis.add(fila.dni);
    if (fila.email) emails.add(fila.email.toLowerCase());
    return { ...fila, errores, valido: errores.length === 0 };
  });
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseCsvBuffer(buffer: Buffer): FilaParseadaMatricula[] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);

  const records = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line, delimiter);
    const data: Record<string, string> = {};
    headers.forEach((header, i) => {
      data[header] = (values[i] ?? '').trim();
    });
    return { fila: index + 2, data };
  });

  return buildFilasFromRecords(records);
}

function parseExcelBuffer(buffer: Buffer): FilaParseadaMatricula[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new BadRequestException('El archivo Excel no contiene hojas de calculo');
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (matrix.length < 2) return [];

  const headers = (matrix[0] ?? []).map((cell) => normalizeHeader(cellToString(cell)));
  const records = matrix.slice(1).map((row, index) => {
    const data: Record<string, string> = {};
    headers.forEach((header, i) => {
      data[header] = cellToString(row[i]);
    });
    return { fila: index + 2, data };
  });

  return buildFilasFromRecords(records);
}

export function parseMatriculaFile(
  buffer: Buffer,
  originalname: string,
): ParseMatriculaFileResult {
  const ext = originalname.split('.').pop()?.toLowerCase() ?? '';
  let filas: FilaParseadaMatricula[];

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
      dni: f.dni,
      email: f.email ?? '',
      mensaje: f.errores.join('; '),
    }));

  return { filas, validas, erroresValidacion };
}
