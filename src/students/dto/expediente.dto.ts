import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RepresentanteDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombres?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoMaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  tipoDocumento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dni?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trabajo?: string;
}

export class HistorialAcademicoDto {
  @IsString()
  @MaxLength(4)
  anio: string;

  @IsString()
  @MaxLength(40)
  grado: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsNumber()
  promedio: number;

  @IsString()
  @MaxLength(30)
  estado: string;
}

export class DocumentoDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  @MaxLength(150)
  tipo: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numero?: string;

  @IsOptional()
  @IsIn(['entregado', 'pendiente', 'vencido'])
  estado?: 'entregado' | 'pendiente' | 'vencido';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  fechaEntrega?: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;
}

export class CreateExpedienteDto {
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
  @IsString()
  @MaxLength(20)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dni?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  tipoDocumento?: string;

  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsOptional()
  @IsString()
  fechaNac?: string;

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

  @IsOptional()
  @IsString()
  foto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  grupoSanguineo?: string;

  @IsOptional()
  @IsString()
  alergias?: string;

  @IsOptional()
  @IsString()
  condicionesSalud?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  /** Etiqueta compuesta, ej: "5° Primaria" */
  @IsString()
  @MaxLength(40)
  gradoLabel: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  anioIngreso?: string;

  @IsOptional()
  @IsIn(['activo', 'inactivo', 'retirado'])
  estado?: 'activo' | 'inactivo' | 'retirado';

  @IsOptional()
  @IsString()
  @MaxLength(3)
  conductaNota?: string;

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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HistorialAcademicoDto)
  historialAcademico?: HistorialAcademicoDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DocumentoDto)
  documentos?: DocumentoDto[];
}

export class UpdateExpedienteDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombres?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoMaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dni?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  tipoDocumento?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  fechaNac?: string;

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

  @IsOptional()
  @IsString()
  foto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  grupoSanguineo?: string;

  @IsOptional()
  @IsString()
  alergias?: string;

  @IsOptional()
  @IsString()
  condicionesSalud?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  gradoLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  seccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  anioIngreso?: string;

  @IsOptional()
  @IsIn(['activo', 'inactivo', 'retirado'])
  estado?: 'activo' | 'inactivo' | 'retirado';

  @IsOptional()
  @IsString()
  @MaxLength(3)
  conductaNota?: string;

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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HistorialAcademicoDto)
  historialAcademico?: HistorialAcademicoDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DocumentoDto)
  documentos?: DocumentoDto[];

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  auditMotivo?: string;
}

export class UpsertDocumentoDto {
  @IsString()
  @MaxLength(150)
  tipo: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numero?: string;

  @IsOptional()
  @IsIn(['entregado', 'pendiente', 'vencido'])
  estado?: 'entregado' | 'pendiente' | 'vencido';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  fechaEntrega?: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;
}

export class UpdateDocumentoDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numero?: string;

  @IsOptional()
  @IsIn(['entregado', 'pendiente', 'vencido'])
  estado?: 'entregado' | 'pendiente' | 'vencido';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  fechaEntrega?: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;
}
