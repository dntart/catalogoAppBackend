import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrdenProduccionEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  operarioId!: string;

  @ApiProperty()
  fecha!: Date;

  @ApiPropertyOptional({ nullable: true })
  observaciones!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ResumenItemEntity {
  @ApiProperty()
  itemId!: string;

  @ApiProperty()
  itemNombre!: string;

  @ApiProperty({ example: 'CONSUMO' })
  tipo!: string;

  @ApiProperty({ example: '5.00' })
  totalCantidad!: string;
}
