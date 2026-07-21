import { NivelLogro } from './entities/competency-evaluation.entity';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Clave canónica para comparar grados entre institución, matrícula y currícula. */
export function canonicalGradoKey(nivel: string, grado: string): string {
  const t = stripAccents(grado.trim().toLowerCase());
  if (nivel === 'Inicial') {
    const age = t.match(/(\d+)/);
    if (age) return `ini:${age[1]}`;
    return `ini:${t}`;
  }
  return `mat:${normalizeGradoMatricula(grado)}`;
}

export function gradosCoinciden(
  nivel: string,
  gradoA: string,
  gradoB: string,
): boolean {
  return canonicalGradoKey(nivel, gradoA) === canonicalGradoKey(nivel, gradoB);
}

const AREA_EMOJI: Record<string, string> = {
  matemática: '🔢',
  matematica: '🔢',
  comunicación: '📖',
  comunicacion: '📖',
  'personal social': '🌍',
  'ciencia y tecnología': '🔬',
  'ciencia y tecnologia': '🔬',
  'ciencias sociales': '🌍',
  'arte y cultura': '🎨',
  'educación física': '⚽',
  'educacion fisica': '⚽',
  inglés: '🇬🇧',
  ingles: '🇬🇧',
  'ed. religiosa': '✝️',
};

const AREA_ABREV: Record<string, string> = {
  matemática: 'MAT',
  matematica: 'MAT',
  comunicación: 'COM',
  comunicacion: 'COM',
  'personal social': 'PS',
  'ciencia y tecnología': 'CT',
  'ciencia y tecnologia': 'CT',
  'ciencias sociales': 'CS',
  'arte y cultura': 'ART',
  'educación física': 'EF',
  'educacion fisica': 'EF',
  inglés: 'ING',
  ingles: 'ING',
  'ed. religiosa': 'ER',
};

export function areaEmoji(nombre: string): string {
  const key = nombre.trim().toLowerCase();
  return AREA_EMOJI[key] ?? '📚';
}

export function areaAbrev(nombre: string): string {
  const key = nombre.trim().toLowerCase();
  return AREA_ABREV[key] ?? nombre.slice(0, 3).toUpperCase();
}

export function competenciaShort(nombre: string): string {
  const cleaned = nombre.replace(/^Resuelve problemas de /i, '').replace(/^Se comunica /i, '');
  if (cleaned.length <= 14) return cleaned;
  const words = cleaned.split(/\s+/);
  if (words.length <= 2) return cleaned.slice(0, 14);
  return `${words[0]} ${words[1]}`.slice(0, 14);
}

export function calcPromedioNivel(vals: NivelLogro[]): NivelLogro | null {
  if (!vals.length) return null;
  const map: Record<NivelLogro, number> = { AD: 4, A: 3, B: 2, C: 1 };
  const avg = vals.reduce((s, n) => s + map[n], 0) / vals.length;
  if (avg >= 3.5) return 'AD';
  if (avg >= 2.5) return 'A';
  if (avg >= 1.5) return 'B';
  return 'C';
}
