import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Categoria, Unidad } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'Gabardina' })
  @IsString()
  @MinLength(1)
  nombre!: string;

  @ApiProperty({ enum: Categoria })
  @IsEnum(Categoria)
  categoria!: Categoria;

  @ApiProperty({ enum: Unidad })
  @IsEnum(Unidad)
  unidad!: Unidad;

  @ApiProperty({ example: true })
  @IsBoolean()
  tieneColor!: boolean;

  @ApiPropertyOptional({
    example: 'Beige',
    description: 'Requerido cuando tieneColor es true',
  })
  @ValidateIf((dto: CreateItemDto) => dto.tieneColor === true)
  @IsString()
  @MinLength(1)
  colorNombre?: string;

  @ApiPropertyOptional({ example: 'https://ejemplo.com/gabardina-beige.jpg' })
  @IsOptional()
  @IsUrl()
  imagenUrl?: string;
}
