import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNegocioDto {
  @ApiProperty({ example: 'Costura Los Andes' })
  @IsString()
  @MinLength(1)
  nombreNegocio!: string;

  @ApiProperty({ example: 'dueno@costuralosandes.com' })
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty({ example: 'contraseña-segura-inicial' })
  @IsString()
  @MinLength(8)
  ownerPassword!: string;

  @ApiProperty({ example: 'María Los Andes' })
  @IsString()
  @MinLength(1)
  ownerNombre!: string;

  @ApiPropertyOptional({
    example: 'whatsapp:+549...',
    description:
      'Numero de WhatsApp del dueño, para que el bot lo identifique. Se puede cargar después.',
  })
  @IsOptional()
  @IsString()
  ownerWhatsappNumber?: string;
}
