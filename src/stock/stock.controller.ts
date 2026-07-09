import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { StockService } from './stock.service';

export interface StockResponse {
  itemId: string;
  stock: number;
}

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get(':itemId')
  async getStock(
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<StockResponse> {
    const stock = await this.stockService.getStock(itemId);
    return { itemId, stock };
  }
}
