import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Categoria } from '@prisma/client';
import { StockService } from './stock.service';
import { StockResponseEntity } from './entities/stock-response.entity';
import { ResumenStockItemEntity } from './entities/resumen-stock-item.entity';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ApiOperation({
    summary:
      'Resumen de stock de todos los items activos, con filtro opcional por categoría',
  })
  @ApiResponse({ status: 200, type: [ResumenStockItemEntity] })
  getResumen(
    @Query('categoria') categoria?: Categoria,
  ): Promise<ResumenStockItemEntity[]> {
    return this.stockService.getResumen(categoria);
  }

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
