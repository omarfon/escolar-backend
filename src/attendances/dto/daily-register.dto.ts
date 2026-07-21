import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DailyRegisterEntryDto {
  @IsInt()
  studentId: number;

  @IsIn(['P', 'F', 'T', 'J'])
  estado: 'P' | 'F' | 'T' | 'J';

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class SaveDailyRegisterDto {
  @IsString()
  nivel: string;

  @IsString()
  grado: string;

  @IsString()
  seccion: string;

  @IsDateString()
  fecha: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyRegisterEntryDto)
  registros: DailyRegisterEntryDto[];
}
