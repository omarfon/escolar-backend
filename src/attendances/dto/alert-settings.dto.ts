import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateAlertSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  diasAlertaAusentismo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  diasAlertaCritica?: number;
}
