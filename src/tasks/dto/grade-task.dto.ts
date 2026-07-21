import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GradeTaskDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  nota?: number;

  @IsOptional()
  @IsString()
  retroalimentacion?: string;
}
