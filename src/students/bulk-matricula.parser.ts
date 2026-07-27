import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';
import { BulkMatriculaRowDto } from './dto/bulk-import-students.dto';

const NIVELES = ['Inicial', 'Primaria', 'Secundaria'] as const;
type Nivel = (typeof NIVELES)[number];

const TIPOS_DOCUMENTO = ['DNI', 'CE', 'Pasaporte', 'PTP', 'Otro'] as const;
type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

const PARENTESCOS = ['padre', 'madre', 'abuelo', 'tio', 'hermano', 'otro'] as const;
type Parentesco = (typeof PARENTESCOS)[number];

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

function normalizeTipoDocumento(value: string): TipoDocumento {
  const v = value.trim().toUpperCase();
  if (v === 'DNI') return 'DNI';
  if (v === 'CE' || v === 'CARNET DE EXTRANJERIA' || v === 'CARNÉ DE EXTRANJERÍA') {
    return 'CE';
  }
  if (v === 'PASAPORTE' || v === 'PASSPORT') return 'Pasaporte';
  if (v === 'PTP') return 'PTP';
  if (v === 'OTRO') return 'Otro';
  return 'DNI';
}

function normalizeParentesco(value: string): Parentesco | undefined {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  if (PARENTESCOS.includes(v as Parentesco)) return v as Parentesco;
  if (v === 'abuela' || v === 'abuelo/a') return 'abuelo';
  if (v === 'tio/a' || v === 'tía' || v === 'tio') return 'tio';
  if (v === 'hermana' || v === 'hermano/a') return 'hermano';
  return 'otro';
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

function resolveApellidos(
  apellidoPaterno: string,
  apellidoMaterno: string,
  apellidosLegacy: string,
): { apellidoPaterno: string; apellidoMaterno: string; apellidos: string } {
  const paterno = apellidoPaterno.trim();
  const materno = apellidoMaterno.trim();
  if (paterno || materno) {
    return {
      apellidoPaterno: paterno,
      apellidoMaterno: materno,
      apellidos: [paterno, materno].filter(Boolean).join(' '),
    };
  }
  const legacy = apellidosLegacy.trim();
  if (!legacy) {
    return { apellidoPaterno: '', apellidoMaterno: '', apellidos: '' };
  }
  const parts = legacy.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      apellidoPaterno: parts[0],
      apellidoMaterno: parts.slice(1).join(' '),
      apellidos: legacy,
    };
  }
  return { apellidoPaterno: legacy, apellidoMaterno: '', apellidos: legacy };
}

function validarNumeroDocumento(tipo: TipoDocumento, numero: string): string | null {
  const n = numero.trim();
  if (!n) return 'Numero de documento es obligatorio';
  switch (tipo) {
    case 'DNI':
      if (!/^\d{8}$/.test(n)) return 'El DNI debe tener exactamente 8 digitos';
      break;
    case 'CE':
      if (!/^[A-Za-z0-9]{9,12}$/.test(n)) {
        return 'El CE debe tener entre 9 y 12 caracteres alfanumericos';
      }
      break;
    case 'Pasaporte':
      if (n.length < 6 || n.length > 20) {
        return 'El pasaporte debe tener entre 6 y 20 caracteres';
      }
      break;
    default:
      if (n.length < 4 || n.length > 20) {
        return 'El numero de documento debe tener entre 4 y 20 caracteres';
      }
  }
  return null;
}

function validarCelular(celular: string, requerido = false): string | null {
  const n = celular.trim().replace(/\s/g, '');
  if (!n) return requerido ? 'Celular es obligatorio' : null;
  if (!/^9\d{8}$/.test(n)) return 'El celular debe tener 9 digitos y comenzar con 9';
  return null;
}

function validarColumnas(headers: string[]): void {
  const required = ['nombres', 'dni', 'nivel', 'grado', 'seccion', 'direccion'];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new BadRequestException(
      `La plantilla no tiene las columnas requeridas: ${missing.join(', ')}`,
    );
  }
  const tieneApellidosSeparados =
    headers.includes('apellido_paterno') && headers.includes('apellido_materno');
  if (!tieneApellidosSeparados && !headers.includes('apellidos')) {
    throw new BadRequestException(
      'La plantilla debe incluir apellido_paterno y apellido_materno, o la columna apellidos',
    );
  }
}

function validarFila(row: BulkMatriculaRowDto & { fila: number }): FilaParseadaMatricula {
  const errores: string[] = [];

  if (!row.nombres.trim()) errores.push('Nombres es obligatorio');

  const apellidosResueltos = resolveApellidos(
    row.apellidoPaterno ?? '',
    row.apellidoMaterno ?? '',
    row.apellidos ?? '',
  );
  if (!apellidosResueltos.apellidoPaterno.trim()) {
    errores.push('Apellido paterno es obligatorio');
  }
  if (!apellidosResueltos.apellidoMaterno.trim()) {
    errores.push('Apellido materno es obligatorio');
  }

  const tipoDoc = row.tipoDocumento ?? 'DNI';
  const docError = validarNumeroDocumento(tipoDoc, row.dni);
  if (docError) errores.push(docError);

  if (!row.direccion?.trim()) errores.push('Direccion es obligatoria');

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

  const telError = validarCelular(row.telefonoEmergencia ?? '', false);
  if (telError) errores.push(telError);

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

  if (row.apoderadoNombres?.trim()) {
    const apoTipo = row.apoderadoTipoDocumento ?? 'DNI';
    if (row.apoderadoDni?.trim()) {
      const apoDocError = validarNumeroDocumento(apoTipo, row.apoderadoDni);
      if (apoDocError) errores.push(`Apoderado: ${apoDocError}`);
    }
    const apoTelError = validarCelular(row.apoderadoTelefono ?? '', true);
    if (apoTelError) errores.push(`Apoderado: ${apoTelError}`);
  }

  return {
    ...row,
    apellidoPaterno: apellidosResueltos.apellidoPaterno,
    apellidoMaterno: apellidosResueltos.apellidoMaterno,
    apellidos: apellidosResueltos.apellidos,
    errores,
    valido: errores.length === 0,
  };
}

function mapRecord(fila: number, data: Record<string, string>): FilaParseadaMatricula {
  const nombres = data['nombres'] ?? '';
  const dni = data['dni'] ?? '';
  const nivel = normalizeNivel(data['nivel'] ?? '');
  const sexoRaw = normalizeSexo(data['sexo'] ?? '');
  const tipoDocumento = normalizeTipoDocumento(data['tipo_documento'] ?? 'DNI');

  const apellidosRes = resolveApellidos(
    data['apellido_paterno'] ?? '',
    data['apellido_materno'] ?? '',
    data['apellidos'] ?? '',
  );

  const apoderadoFull = data['apoderado_nombres']?.trim() ?? '';
  let apoderadoNombres = apoderadoFull;
  const apoderadoApellidosRes = resolveApellidos(
    data['apoderado_apellido_paterno'] ?? '',
    data['apoderado_apellido_materno'] ?? '',
    data['apoderado_apellidos'] ?? '',
  );
  if (apoderadoFull && !apoderadoApellidosRes.apellidos) {
    const split = splitNombreCompleto(apoderadoFull);
    apoderadoNombres = split.nombres;
  }

  return validarFila({
    fila,
    nombres: nombres.trim(),
    apellidos: apellidosRes.apellidos,
    apellidoPaterno: apellidosRes.apellidoPaterno,
    apellidoMaterno: apellidosRes.apellidoMaterno,
    tipoDocumento,
    dni: dni.trim(),
    email:
      (data['email'] ?? '').trim() ||
      (dni ? buildEmail(nombres, apellidosRes.apellidos, dni) : ''),
    sexo: sexoRaw || undefined,
    fechaNac: data['fecha_nac']?.trim() || undefined,
    direccion: (data['direccion'] ?? '').trim(),
    distrito: data['distrito']?.trim() || undefined,
    provincia: data['provincia']?.trim() || undefined,
    departamento: data['departamento']?.trim() || undefined,
    telefonoEmergencia: data['telefono_emergencia']?.trim() || undefined,
    nivel: (nivel || '') as Nivel,
    grado: normalizeGrado(data['grado'] ?? ''),
    seccion: (data['seccion'] ?? 'A').trim().toUpperCase(),
    anioIngreso: data['anio_ingreso']?.trim() || String(new Date().getFullYear()),
    apoderadoNombres: apoderadoNombres || undefined,
    apoderadoApellidos: apoderadoApellidosRes.apellidos || undefined,
    apoderadoApellidoPaterno: apoderadoApellidosRes.apellidoPaterno || undefined,
    apoderadoApellidoMaterno: apoderadoApellidosRes.apellidoMaterno || undefined,
    apoderadoTipoDocumento: data['apoderado_tipo_documento']?.trim()
      ? normalizeTipoDocumento(data['apoderado_tipo_documento'])
      : undefined,
    apoderadoDni: data['apoderado_dni']?.trim() || undefined,
    apoderadoTelefono: data['apoderado_telefono']?.trim() || undefined,
    apoderadoEmail: data['apoderado_email']?.trim() || undefined,
    apoderadoParentesco: normalizeParentesco(data['apoderado_parentesco'] ?? ''),
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
