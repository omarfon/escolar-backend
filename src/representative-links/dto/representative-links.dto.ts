import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TIPOS_VINCULO } from '../representative-links.constants';

export class RepresentativeDataDto {
  @IsOptional()
  @IsString()
  nombres?: string;

  @IsOptional()
  @IsString()
  apellidos?: string;

  @IsOptional()
  @IsString()
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  apellidoMaterno?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}

export class AssociateStudentsDto {
  @IsString()
  @IsNotEmpty()
  tipoDocumento!: string;

  @IsString()
  @IsNotEmpty()
  numeroDocumento!: string;

  @ValidateNested()
  @Type(() => RepresentativeDataDto)
  representante!: RepresentativeDataDto;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  studentIds!: number[];

  @IsString()
  @IsIn([...TIPOS_VINCULO])
  tipoVinculo!: string;

  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;

  @IsString()
  @MinLength(3)
  motivo!: string;
}

export class UpdateRepresentativeLinkDto {
  @IsOptional()
  @IsString()
  @IsIn([...TIPOS_VINCULO])
  tipoVinculo?: string;

  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;

  @IsString()
  @MinLength(3)
  motivo!: string;
}

export class CeaseRepresentativeLinkDto {
  @IsString()
  @MinLength(3)
  motivo!: string;
}

export interface RepresentativeLinksContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel: string;
    dre: string;
  };
  permisoConsulta: string;
  permisoGestion: string;
  tiposVinculo: string[];
}

export interface RepresentativeResponse {
  id: number | null;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  telefono: string;
  pendienteRegistro?: boolean;
}

export interface RepresentativeLinkStudentSummary {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  gradoLabel: string;
  seccion: string;
  estado: string;
}

export interface RepresentativeLinkResponse {
  id: number;
  representativeId: number;
  studentId: number;
  tipoVinculo: string;
  esPrincipal: boolean;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  activo: boolean;
  motivoCese: string;
  student?: RepresentativeLinkStudentSummary;
}

export interface RepresentativeLookupResponse {
  representante: RepresentativeResponse | null;
  vinculosActivos: RepresentativeLinkResponse[];
  vinculosHistoricos: RepresentativeLinkResponse[];
  sugeridoDesdeExpediente: boolean;
}

export interface AssociateStudentsResult {
  representante: RepresentativeResponse;
  creados: RepresentativeLinkResponse[];
  omitidos: Array<{ studentId: number; razon: string }>;
}

export interface RepresentativeLinkLogResponse {
  id: number;
  linkId: number | null;
  representativeId: number;
  studentId: number;
  accion: string;
  actorNombre: string;
  actorRol: string;
  motivo: string;
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;
  resultado: string;
  createdAt: string;
}
