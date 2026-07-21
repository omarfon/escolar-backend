import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class SendParentTeacherMessageDto {
  @IsInt()
  @Min(1)
  studentId: number;

  @IsInt()
  @Min(1)
  docenteId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  asunto: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  cuerpo: string;
}
