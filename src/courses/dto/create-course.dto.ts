import { IsString, MaxLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @MaxLength(80)
  area: string;

  @IsString()
  @MaxLength(20)
  nivel: string;

  @IsString()
  @MaxLength(20)
  grado: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsString()
  @MaxLength(80)
  docente: string;
}
