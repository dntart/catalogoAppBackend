import { Module } from '@nestjs/common';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';
import { MovimientosRepository } from './movimientos.repository';
import { StockModule } from '../stock/stock.module';
import { ItemsModule } from '../items/items.module';
import { OperariosModule } from '../operarios/operarios.module';

@Module({
  imports: [StockModule, ItemsModule, OperariosModule],
  controllers: [MovimientosController],
  providers: [MovimientosService, MovimientosRepository],
})
export class MovimientosModule {}
