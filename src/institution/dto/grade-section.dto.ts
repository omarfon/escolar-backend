import { IsString, MaxLength } from 'class-validator';

export class CreateGradeSectionDto {
  @IsString() @MaxLength(40) nombre: string;
}

export class UpdateGradeSectionDto {
  @IsString() @MaxLength(40) nombre: string;
}
