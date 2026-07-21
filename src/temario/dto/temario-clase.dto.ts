import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TemarioImagenClaseDto {
  @IsString()
  @MaxLength(500)
  url: string;

  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  leyenda?: string;
}

const ESTADOS = ['programada', 'dictada', 'reprogramada', 'cancelada'] as const;
export type TemarioClaseEstadoDto = (typeof ESTADOS)[number];

const MODOS_LIBERACION = [
  'oculto',
  'inmediato',
  'programada',
  'dias_antes',
] as const;
export type ModoLiberacionDto = (typeof MODOS_LIBERACION)[number];

const MATERIAL_TIPOS = ['texto', 'documento', 'enlace', 'video'] as const;

export class CreateTemarioClaseDto {
  @IsInt()
  cursoId: number;

  @IsString()
  @MaxLength(120)
  cursoNombre: string;

  @IsString()
  @MaxLength(40)
  nivel: string;

  @IsString()
  @MaxLength(20)
  grado: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsInt()
  anioEscolar: number;

  @IsOptional()
  @IsInt()
  assignmentId?: number;

  @IsInt()
  @Min(1)
  numero: number;

  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  objetivos?: string;

  @IsOptional()
  @IsString()
  contenidoClase?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemarioImagenClaseDto)
  imagenesClase?: TemarioImagenClaseDto[];

  @IsString()
  fechaClase: string;

  @IsOptional()
  @IsIn(ESTADOS)
  estado?: TemarioClaseEstadoDto;

  @IsOptional()
  @IsBoolean()
  visibleEstudiante?: boolean;

  @IsOptional()
  @IsIn(MODOS_LIBERACION)
  modoLiberacion?: ModoLiberacionDto;

  @IsOptional()
  @IsString()
  fechaLiberacion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  horaLiberacion?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasAntesLiberacion?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  materialTitulo?: string;

  @IsOptional()
  @IsString()
  materialDescripcion?: string;

  @IsOptional()
  @IsIn(MATERIAL_TIPOS)
  materialTipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  materialUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  materialNombreArchivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  materialMimeType?: string;
}

export class UpdateTemarioClaseDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  numero?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  objetivos?: string;

  @IsOptional()
  @IsString()
  contenidoClase?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemarioImagenClaseDto)
  imagenesClase?: TemarioImagenClaseDto[];

  @IsOptional()
  @IsString()
  fechaClase?: string;

  @IsOptional()
  @IsIn(ESTADOS)
  estado?: TemarioClaseEstadoDto;

  @IsOptional()
  @IsBoolean()
  visibleEstudiante?: boolean;

  @IsOptional()
  @IsIn(MODOS_LIBERACION)
  modoLiberacion?: ModoLiberacionDto;

  @IsOptional()
  @IsString()
  fechaLiberacion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  horaLiberacion?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasAntesLiberacion?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  materialTitulo?: string;

  @IsOptional()
  @IsString()
  materialDescripcion?: string;

  @IsOptional()
  @IsIn(MATERIAL_TIPOS)
  materialTipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  materialUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  materialNombreArchivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  materialMimeType?: string;
}
