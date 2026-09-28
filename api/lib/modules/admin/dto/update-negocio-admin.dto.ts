import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateNegocioAdminDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
