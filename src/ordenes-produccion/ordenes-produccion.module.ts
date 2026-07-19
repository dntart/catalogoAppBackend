import { Module } from '@nestjs/common';
import { OrdenesProduccionController } from './ordenes-produccion.controller';
import { OrdenesProduccionService } from './ordenes-produccion.service';
import { OrdenesProduccionRepository } from './ordenes-produccion.repository';
import { OperariosModule } from '../operarios/operarios.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [OperariosModule, ItemsModule],
  controllers: [OrdenesProduccionController],
  providers: [OrdenesProduccionService, OrdenesProduccionRepository],
  exports: [OrdenesProduccionService],
})
export class OrdenesProduccionModule {}
