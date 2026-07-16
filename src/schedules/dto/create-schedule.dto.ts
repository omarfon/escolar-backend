import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateScheduleDto {
  @IsInt()
  studentId: number;

  @IsString()
  @MaxLength(20)
  nivel: string;

  @IsString()
  @MaxLength(20)
  grado: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dia: number;

  @IsString()
  @MaxLength(5)
  horaInicio: string;

  @IsString()
  @MaxLength(5)
  horaFin: string;

  @IsString()
  @MaxLength(120)
  curso: string;

  @IsString()
  @MaxLength(80)
  docente: string;
}
