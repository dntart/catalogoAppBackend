import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Categoria, Unidad } from '@prisma/client';

export class ItemEntity {
  @ApiProperty()
  id!: string;

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

  @ApiProperty()
  activo!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
