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

export class CreateMaestroFeriadoDto {
  @IsInt()
  @Min(2000)
  anioEscolar: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha: string;

  @IsString()
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsIn(['nacional', 'local', 'institucional'])
  tipo?: 'nacional' | 'local' | 'institucional';

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateMaestroFeriadoDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  anioEscolar?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsIn(['nacional', 'local', 'institucional'])
  tipo?: 'nacional' | 'local' | 'institucional';

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
