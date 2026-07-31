import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { ConversationService } from './conversation/conversation.service';
import { SessionStoreService } from './conversation/session-store.service';
import { ItemsModule } from '../items/items.module';
import { OperariosModule } from '../operarios/operarios.module';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { OrdenesProduccionModule } from '../ordenes-produccion/ordenes-produccion.module';
import { StockModule } from '../stock/stock.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ItemsModule,
    OperariosModule,
    MovimientosModule,
    OrdenesProduccionModule,
    StockModule,
    UsersModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, ConversationService, SessionStoreService],
})
export class WhatsappModule {}
