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
  ValidateIf,
} from 'class-validator';

export class CreateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  grupo?: string;

  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsEnum(Categoria)
  categoria!: Categoria;

  @IsEnum(Unidad)
  unidad!: Unidad;

  @IsBoolean()
  tieneColor!: boolean;

  @ValidateIf((dto: CreateItemDto) => dto.tieneColor === true)
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
}
