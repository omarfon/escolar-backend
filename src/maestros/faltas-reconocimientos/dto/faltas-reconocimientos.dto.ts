import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMaestroConductaTipoDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigo?: string;

  @IsString()
  @MaxLength(80)
  nombre: string;

  @IsIn(['falta', 'reconocimiento'])
  categoria: 'falta' | 'reconocimiento';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

export class UpdateMaestroConductaTipoDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsIn(['falta', 'reconocimiento'])
  categoria?: 'falta' | 'reconocimiento';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  activo?: boolean;
}

export class CreateMaestroConductaDescripcionDto {
  @IsString()
  @MaxLength(2000)
  texto: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

export class UpdateMaestroConductaDescripcionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  texto?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  activo?: boolean;
}
