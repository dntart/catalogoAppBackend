import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Categoria, Unidad } from '@prisma/client';

export class ItemEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    example: 'MAT-0007',
    description: 'Código corto autogenerado',
  })
  codigo!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty({ enum: Categoria })
  categoria!: Categoria;

  @ApiProperty({ enum: Unidad })
  unidad!: Unidad;

  @ApiProperty()
  tieneColor!: boolean;

  @ApiPropertyOptional({ nullable: true })
  colorNombre!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imagenUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '5' })
  stockMinimo!: string | null;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
