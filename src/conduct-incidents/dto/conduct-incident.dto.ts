import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateConductIncidentDto {
  @IsInt()
  studentId: number;

  @IsIn(['falta_leve', 'falta_grave', 'falta_muy_grave', 'reconocimiento'])
  tipo: 'falta_leve' | 'falta_grave' | 'falta_muy_grave' | 'reconocimiento';

  @IsString()
  @MaxLength(2000)
  descripcion: string;

  @IsString()
  fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lugar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reportadoPor?: string;

  @IsOptional()
  @IsIn(['pendiente', 'en_proceso', 'resuelto'])
  estado?: 'pendiente' | 'en_proceso' | 'resuelto';

  @IsOptional()
  @IsString()
  medida?: string;

  @IsOptional()
  @IsBoolean()
  notificadoPadre?: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateConductIncidentDto {
  @IsOptional()
  @IsInt()
  studentId?: number;

  @IsOptional()
  @IsIn(['falta_leve', 'falta_grave', 'falta_muy_grave', 'reconocimiento'])
  tipo?: 'falta_leve' | 'falta_grave' | 'falta_muy_grave' | 'reconocimiento';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lugar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reportadoPor?: string;

  @IsOptional()
  @IsIn(['pendiente', 'en_proceso', 'resuelto'])
  estado?: 'pendiente' | 'en_proceso' | 'resuelto';

  @IsOptional()
  @IsString()
  medida?: string;

  @IsOptional()
  @IsBoolean()
  notificadoPadre?: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
