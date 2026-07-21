import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMaestroPeriodoAcademicoDto {
  @IsInt()
  @Min(2000)
  anioEscolar: number;

  @IsInt()
  @Min(1)
  numero: number;

  @IsString()
  @MaxLength(80)
  nombre: string;

  @IsOptional()
  @IsIn(['bimestre', 'trimestre', 'semestre'])
  tipo?: 'bimestre' | 'trimestre' | 'semestre';

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  inicio: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fin: string;

  @IsOptional()
  @IsBoolean()
  actual?: boolean;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateMaestroPeriodoAcademicoDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  anioEscolar?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  numero?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsIn(['bimestre', 'trimestre', 'semestre'])
  tipo?: 'bimestre' | 'trimestre' | 'semestre';

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  inicio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fin?: string;

  @IsOptional()
  @IsBoolean()
  actual?: boolean;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
