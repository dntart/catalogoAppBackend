import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUsuarioAdminDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  /// Formato esperado "whatsapp:+549..." (mismo que usa el bot) — no se
  /// valida el formato exacto acá, lo hace WhatsappService al enviar.
  @IsOptional()
  @IsString()
  @MinLength(1)
  whatsappNumber?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
