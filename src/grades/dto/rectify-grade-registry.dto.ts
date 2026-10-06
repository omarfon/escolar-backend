import { IsString, MaxLength, MinLength } from 'class-validator';
import { SaveGradeRegistryDto } from './grade-registry.dto';

export class RectifyGradeRegistryDto extends SaveGradeRegistryDto {
  @IsString()
  @MinLength(10, {
    message: 'El motivo de rectificación debe tener al menos 10 caracteres',
  })
  @MaxLength(500)
  motivo: string;
}
