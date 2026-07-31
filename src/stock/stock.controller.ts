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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

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
    @CurrentUser() user: AuthenticatedUser,
    @Query('categoria') categoria?: Categoria,
  ): Promise<ResumenStockItemEntity[]> {
    return this.stockService.getResumen(user.negocioId, categoria);
  }

  @Get(':itemId')
  @ApiOperation({
    summary: 'Calcular el stock actual de un item a partir de sus movimientos',
  })
  @ApiResponse({ status: 200, type: StockResponseEntity })
  async getStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<StockResponseEntity> {
    const stock = await this.stockService.getStock(user.negocioId, itemId);
    return { itemId, stock };
  }
}
