import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EscalaLogroDto } from './escala-logro.dto';

export class CreateInstitutionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigoModular: string;

  @IsOptional() @IsString() @MaxLength(40) siglas?: string;
  @IsOptional() @IsString() @MaxLength(11) ruc?: string;
  @IsOptional() @IsIn(['privada', 'publica', 'parroquial', 'convenio']) tipoGestion?: string;
  @IsOptional() @IsString() @MaxLength(80) ugel?: string;
  @IsOptional() @IsString() @MaxLength(80) dre?: string;
  @IsOptional() @IsString() @MaxLength(120) resolucion?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(80) distrito?: string;
  @IsOptional() @IsString() @MaxLength(80) provincia?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsString() @MaxLength(10) codigoPostal?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono2?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(200) web?: string;
  @IsOptional() @IsString() @MaxLength(200) facebook?: string;
  @IsOptional() @IsString() @MaxLength(120) director?: string;
  @IsOptional() @IsString() @MaxLength(120) subdirector?: string;
  @IsOptional() @IsString() @MaxLength(120) administrador?: string;
  @IsOptional() @IsString() @MaxLength(4) anio?: string;
  @IsOptional() @IsIn(['numerico', 'literal', 'mixto']) sistemaEval?: string;
  @IsOptional() @IsIn(['bimestre', 'trimestre', 'semestre']) tipoPeriodo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) notaMinima?: number;
  @IsOptional() @ValidateNested() @Type(() => EscalaLogroDto) escalaLogro?: EscalaLogroDto;
}
