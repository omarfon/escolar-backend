import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
  @IsInt()
  studentId: number;

  @IsDateString()
  fecha: string;

  @IsIn(['P', 'F', 'T', 'J'])
  estado: 'P' | 'F' | 'T' | 'J';

  @IsOptional()
  @IsString()
  observacion?: string;
}
