import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ItemsModule } from './items/items.module';
import { OperariosModule } from './operarios/operarios.module';
import { MovimientosModule } from './movimientos/movimientos.module';
import { StockModule } from './stock/stock.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { OrdenesProduccionModule } from './ordenes-produccion/ordenes-produccion.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AdminModule } from './admin/admin.module';
import { NegociosModule } from './negocios/negocios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default: 20 requests cada 60s por IP. Los endpoints públicos sensibles
    // (login, alta self-service) bajan este límite con @Throttle() propio.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    AdminModule,
    NegociosModule,
    ItemsModule,
    OperariosModule,
    OrdenesProduccionModule,
    MovimientosModule,
    StockModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
