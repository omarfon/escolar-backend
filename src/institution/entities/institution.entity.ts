import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface InstitutionNivel {
  nombre: string;
  activo: boolean;
  grados: { nombre: string; secciones: string[] }[];
}

export interface InstitutionPeriodo {
  numero: number;
  nombre: string;
  tipo: string;
  inicio: string;
  fin: string;
  actual: boolean;
}

export interface InstitutionConfig {
  moneda: string;
  timezone: string;
  formatoFecha: string;
}

export interface InstitutionEscalaLogro {
  AD: number;
  A: number;
  B: number;
}

export interface InstitutionModulo {
  key: string;
  label: string;
  desc: string;
  icon: string;
  activo: boolean;
}

@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200, default: '' })
  nombre: string;

  @Column({ length: 40, default: '' })
  siglas: string;

  @Column({ length: 11, default: '' })
  ruc: string;

  @Column({ length: 20, default: '' })
  codigoModular: string;

  @Column({ length: 20, default: 'privada' })
  tipoGestion: string;

  @Column({ length: 80, default: '' })
  ugel: string;

  @Column({ length: 80, default: '' })
  dre: string;

  @Column({ length: 120, default: '' })
  resolucion: string;

  @Column({ length: 200, default: '' })
  direccion: string;

  @Column({ length: 80, default: '' })
  distrito: string;

  @Column({ length: 80, default: '' })
  provincia: string;

  @Column({ length: 80, default: '' })
  region: string;

  @Column({ length: 10, default: '' })
  codigoPostal: string;

  @Column({ length: 30, default: '' })
  telefono: string;

  @Column({ length: 30, default: '' })
  telefono2: string;

  @Column({ length: 120, default: '' })
  email: string;

  @Column({ length: 200, default: '' })
  web: string;

  @Column({ length: 200, default: '' })
  facebook: string;

  @Column({ length: 120, default: '' })
  director: string;

  @Column({ length: 120, default: '' })
  subdirector: string;

  @Column({ length: 120, default: '' })
  administrador: string;

  @Column({ length: 4, default: '2026' })
  anio: string;

  @Column({ length: 20, default: 'numerico' })
  sistemaEval: string;

  @Column({ length: 20, default: 'bimestre' })
  tipoPeriodo: string;

  @Column({ type: 'int', default: 11 })
  notaMinima: number;

  @Column({
    type: 'jsonb',
    default: () => `'{"AD":17.5,"A":14,"B":11}'`,
  })
  escalaLogro: InstitutionEscalaLogro;

  @Column({ type: 'jsonb', default: [] })
  niveles: InstitutionNivel[];

  @Column({ type: 'jsonb', default: [] })
  periodos: InstitutionPeriodo[];

  @Column({ type: 'jsonb', default: {} })
  config: InstitutionConfig;

  @Column({ type: 'jsonb', default: [] })
  modulos: InstitutionModulo[];
}
