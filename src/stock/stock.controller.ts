import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { StockResponseEntity } from './entities/stock-response.entity';

@ApiTags('stock')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get(':itemId')
  @ApiOperation({
    summary: 'Calcular el stock actual de un item a partir de sus movimientos',
  })
  @ApiResponse({ status: 200, type: StockResponseEntity })
  async getStock(
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<StockResponseEntity> {
    const stock = await this.stockService.getStock(itemId);
    return { itemId, stock };
  }
}
