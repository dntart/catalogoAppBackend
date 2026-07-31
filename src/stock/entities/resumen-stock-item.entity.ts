import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Categoria, Unidad } from '@prisma/client';

export class ResumenStockItemEntity {
  @ApiProperty()
  itemId!: string;

  @ApiProperty({ example: 'Gabardina Beige' })
  nombre!: string;

  @ApiProperty({ enum: Categoria })
  categoria!: Categoria;

  @ApiProperty({ enum: Unidad })
  unidad!: Unidad;

  @ApiProperty({ example: 15 })
  stock!: number;

  @ApiPropertyOptional({ nullable: true, example: 5 })
  stockMinimo!: number | null;

  @ApiProperty({
    example: false,
    description: 'true si stock <= stockMinimo (y hay un mínimo configurado)',
  })
  bajoMinimo!: boolean;
}
