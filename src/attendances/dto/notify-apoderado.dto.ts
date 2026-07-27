import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class NotifyApoderadoDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  studentId: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  mes: string;

  @IsOptional()
  @IsString()
  notificadoPor?: string;
}
