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

export class CreateSinDocumentoDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  distrito?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  provincia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  departamento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefonoEmergencia?: string;

  @IsString()
  @MaxLength(40)
  gradoLabel: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RepresentanteDto)
  padre?: RepresentanteDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RepresentanteDto)
  madre?: RepresentanteDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RepresentanteDto)
  apoderado?: RepresentanteDto;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  sinDocumentoMotivo: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  sinDocumentoSustento: string;

  @IsOptional()
  @IsBoolean()
  confirmarDuplicado?: boolean;
}

export class CheckSinDocumentoDuplicatesDto {
  @IsString()
  @MaxLength(80)
  nombres: string;

  @IsString()
  @MaxLength(80)
  apellidos: string;

  @IsOptional()
  @IsString()
  fechaNac?: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  sexo?: 'M' | 'F';

  @IsOptional()
  @IsString()
  padreDni?: string;

  @IsOptional()
  @IsString()
  madreDni?: string;

  @IsOptional()
  @IsString()
  apoderadoDni?: string;
}

export class RegularizarDocumentoDto {
  @IsString()
  @MaxLength(20)
  dni: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  tipoDocumento?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  auditMotivo: string;
}

export interface SinDocumentoContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel?: string;
    dre?: string;
  };
  permisoRegistro: string;
  permisoRegularizacion: string;
  tipoDocumentoSin: string;
  estadoPendiente: string;
}
