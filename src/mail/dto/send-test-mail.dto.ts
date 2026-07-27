import { IsEmail, IsOptional } from 'class-validator';

export class SendTestMailDto {
  @IsOptional()
  @IsEmail()
  to?: string;
}
