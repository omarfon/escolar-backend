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

const NIVELES = ['Inicial', 'Primaria', 'Secundaria'] as const;

export class CreateHorarioBlockDto {
  @IsInt()
  anioEscolar: number;

  @IsIn(NIVELES)
  nivel: string;

  @IsString()
  grado: string;

  @IsString()
  seccion: string;

  @IsInt()
  @Min(0)
  @Max(4)
  dia: number;

  @IsInt()
  periodoId: number;

  @IsInt()
  cursoId: number;

  @IsInt()
  docenteId: number;
}

export class UpdateHorarioBlockDto {
  @IsOptional()
  @IsInt()
  cursoId?: number;

  @IsOptional()
  @IsInt()
  docenteId?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ResolveHorarioConflictsDto {
  @IsInt()
  keepBlockId: number;

  @IsArray()
  @IsInt({ each: true })
  removeBlockIds: number[];
}
