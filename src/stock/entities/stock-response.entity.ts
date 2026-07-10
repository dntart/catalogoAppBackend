import { ApiProperty } from '@nestjs/swagger';

export class StockResponseEntity {
  @ApiProperty()
  itemId!: string;

  @ApiProperty({
    example: 42,
    description: 'Stock calculado a partir de los movimientos del item',
  })
  stock!: number;
}
