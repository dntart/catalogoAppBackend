import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNegocioDto {
  @IsString()
  @MinLength(1)
  nombreNegocio!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  ownerPassword!: string;

  @IsString()
  @MinLength(1)
  ownerNombre!: string;

  @IsOptional()
  @IsString()
  ownerWhatsappNumber?: string;
}
