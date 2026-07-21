import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateMaestroCursoDto {
  @IsString()
  nombre: string;

  @IsString()
  area: string;

  @IsString()
  @IsIn(['Inicial', 'Primaria', 'Secundaria'])
  nivel: string;

  @IsArray()
  @IsString({ each: true })
  grados: string[];

  @IsInt()
  @Min(0)
  @Max(40)
  horasSemanales: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateMaestroCursoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Inicial', 'Primaria', 'Secundaria'])
  nivel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grados?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  horasSemanales?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
