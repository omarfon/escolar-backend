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

export class CreateCurriculumDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio: number;

  @IsString()
  nivel: string;

  @IsOptional()
  @IsIn(['numerica', 'literal', 'competencia'])
  tipoEscala?: 'numerica' | 'literal' | 'competencia';

  @IsOptional()
  @IsIn(['bimestral', 'trimestral'])
  tipoPeriodo?: 'bimestral' | 'trimestral';
}

export class UpdateCurriculumDto {
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'borrador'])
  estado?: 'activo' | 'inactivo' | 'borrador';

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsIn(['numerica', 'literal', 'competencia'])
  tipoEscala?: 'numerica' | 'literal' | 'competencia';

  @IsOptional()
  @IsIn(['bimestral', 'trimestral'])
  tipoPeriodo?: 'bimestral' | 'trimestral';
}

export class CreateCurriculumAreaDto {
  @IsInt()
  curriculumId: number;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsString()
  colorClass?: string;

  @IsOptional()
  @IsString()
  dotClass?: string;
}

export class UpdateCurriculumAreaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreateCurriculumSubjectDto {
  @IsInt()
  curriculumId: number;

  @IsString()
  nombre: string;

  @IsInt()
  areaId: number;

  @IsString()
  nivel: string;

  @IsArray()
  @IsString({ each: true })
  grados: string[];

  @IsInt()
  @Min(0)
  horasSemanales: number;

  @IsOptional()
  @IsInt()
  maestroCursoId?: number;
}

export class UpdateCurriculumSubjectDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsInt()
  areaId?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grados?: string[];

  @IsOptional()
  @IsInt()
  horasSemanales?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreateTeacherAssignmentDto {
  @IsInt()
  curriculumId: number;

  @IsInt()
  docenteId: number;

  @IsInt()
  cursoId: number;

  @IsString()
  nivel: string;

  @IsString()
  grado: string;

  @IsArray()
  @IsString({ each: true })
  secciones: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  horasSemanales?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateTeacherAssignmentDto {
  @IsOptional()
  @IsInt()
  docenteId?: number;

  @IsOptional()
  @IsInt()
  cursoId?: number;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  grado?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secciones?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  horasSemanales?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
