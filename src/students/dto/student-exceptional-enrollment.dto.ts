import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RepresentanteDto } from './expediente.dto';

export class CheckExceptionalEnrollmentAgeDto {
  @IsString()
  fechaNac: string;

  @IsString()
  @MaxLength(40)
  gradoLabel: string;
}

export class CheckExceptionalEnrollmentDuplicatesDto {
  @IsString()
  @MaxLength(80)
  nombres: string;

  @IsString()
  @MaxLength(80)
  apellidos: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dni?: string;

  @IsOptional()
  @IsString()
  fechaNac?: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  sexo?: 'M' | 'F';
}

export class CreateExceptionalEnrollmentDto {
  @IsString()
  @MaxLength(80)
  nombres: string;

  @IsString()
  @MaxLength(80)
  apellidos: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoMaterno?: string;

  @IsString()
  @MaxLength(20)
  dni: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  tipoDocumento?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsString()
  fechaNac: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  sexo?: 'M' | 'F';

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsString()
  @MaxLength(40)
  gradoLabel: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RepresentanteDto)
  apoderado?: RepresentanteDto;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  excepcionalMotivo: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  excepcionalSustento: string;

  @IsOptional()
  @IsBoolean()
  confirmarDuplicado?: boolean;
}

export interface ExceptionalEnrollmentContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel: string;
    dre: string;
    codigoModular: string;
    fechaCorteNormativa: string;
  };
  permisoRegistrar: string;
  permisoConsultar: string;
  motivos: readonly string[];
  gradosDisponibles: Array<{ label: string; nivel: string; grado: string }>;
}

export interface ExceptionalEnrollmentAgeCheck {
  cumpleEdadNormativa: boolean;
  edadActual: number | null;
  edadEsperada: number | null;
  fechaCorte: string;
  mensaje: string | null;
  requiereExcepcional: boolean;
}
