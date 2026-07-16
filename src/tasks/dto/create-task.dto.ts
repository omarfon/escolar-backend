import { IsDateString, IsIn, IsInt, IsString, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsInt()
  studentId: number;

  @IsString()
  @MaxLength(120)
  titulo: string;

  @IsString()
  @MaxLength(120)
  curso: string;

  @IsDateString()
  fechaEntrega: string;

  @IsIn(['PENDING', 'SUBMITTED', 'OVERDUE'])
  estado: 'PENDING' | 'SUBMITTED' | 'OVERDUE';

  @IsIn(['alta', 'media', 'baja'])
  prioridad: 'alta' | 'media' | 'baja';
}
