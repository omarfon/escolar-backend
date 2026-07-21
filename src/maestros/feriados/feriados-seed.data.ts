import { MaestroFeriadoTipo } from './entities/maestro-feriado.entity';

export interface MaestroFeriadoSeed {
  anioEscolar: number;
  fecha: string;
  nombre: string;
  tipo: MaestroFeriadoTipo;
  descripcion?: string;
}

/** Feriados nacionales Perú — año escolar/calendario 2026 */
export const MAESTRO_FERIADOS_SEED: MaestroFeriadoSeed[] = [
  { anioEscolar: 2026, fecha: '2026-01-01', nombre: 'Año Nuevo', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-04-02', nombre: 'Jueves Santo', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-04-03', nombre: 'Viernes Santo', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-05-01', nombre: 'Día del Trabajo', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-06-29', nombre: 'San Pedro y San Pablo', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-07-28', nombre: 'Fiestas Patrias', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-07-29', nombre: 'Fiestas Patrias', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-08-30', nombre: 'Santa Rosa de Lima', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-10-08', nombre: 'Combate de Angamos', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-11-01', nombre: 'Todos los Santos', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-12-08', nombre: 'Inmaculada Concepción', tipo: 'nacional' },
  { anioEscolar: 2026, fecha: '2026-12-25', nombre: 'Navidad', tipo: 'nacional' },
];
