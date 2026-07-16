import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateClassroomDto {
  @IsInt()
  @Min(2000)
  anioEscolar: number;

  @IsString()
  @MinLength(2)
  nivel: string;

  @IsString()
  @MinLength(1)
  grado: string;

  @IsString()
  @MinLength(1)
  seccion: string;

  @IsInt()
  @Min(1)
  @Max(999)
  aforo: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateClassroomDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  aforo?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class SyncClassroomsDto {
  @IsInt()
  @Min(2000)
  anioEscolar: number;
}
