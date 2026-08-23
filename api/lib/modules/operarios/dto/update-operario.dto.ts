import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOperarioDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
