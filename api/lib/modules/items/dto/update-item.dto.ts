import { Categoria, Unidad } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

// Todos los campos opcionales (equivalente a PartialType(CreateItemDto) de
// NestJS, escrito a mano para no depender de @nestjs/mapped-types).
export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  grupo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsEnum(Categoria)
  categoria?: Categoria;

  @IsOptional()
  @IsEnum(Unidad)
  unidad?: Unidad;

  @IsOptional()
  @IsBoolean()
  tieneColor?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  colorNombre?: string;

  @IsOptional()
  @IsUrl()
  imagenUrl?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  stockMinimo?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
