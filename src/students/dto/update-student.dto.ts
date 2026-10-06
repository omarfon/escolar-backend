import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CreateStudentDto } from './create-student.dto';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  auditMotivo?: string;
}
