// Reemplaza el contenedor de inyección de dependencias de NestJS: instancia
// cada Service/Repository una sola vez (reusando el mismo PrismaClient
// singleton) y los expone ya conectados entre sí, igual que hacía cada
// *.module.ts en la versión NestJS.
import { prisma } from './prisma';

import { ItemsRepository } from './modules/items/items.repository';
import { ItemsService } from './modules/items/items.service';
import { OperariosRepository } from './modules/operarios/operarios.repository';
import { OperariosService } from './modules/operarios/operarios.service';
import { MovimientosRepository } from './modules/movimientos/movimientos.repository';
import { MovimientosService } from './modules/movimientos/movimientos.service';
import { OrdenesProduccionRepository } from './modules/ordenes-produccion/ordenes-produccion.repository';
import { OrdenesProduccionService } from './modules/ordenes-produccion/ordenes-produccion.service';
import { StockRepository } from './modules/stock/stock.repository';
import { StockService } from './modules/stock/stock.service';
import { UsersRepository } from './modules/users/users.repository';
import { UsersService } from './modules/users/users.service';
import { AuthService } from './modules/auth/auth.service';
import { AdminService } from './modules/admin/admin.service';
import { WhatsappService } from './modules/whatsapp/whatsapp.service';
import { SessionStoreService } from './modules/whatsapp/conversation/session-store.service';
import { ConversationService } from './modules/whatsapp/conversation/conversation.service';

export const itemsRepository = new ItemsRepository(prisma);
export const itemsService = new ItemsService(itemsRepository);

export const operariosRepository = new OperariosRepository(prisma);
export const operariosService = new OperariosService(operariosRepository);

export const stockRepository = new StockRepository(prisma);
export const stockService = new StockService(stockRepository, itemsService);

export const ordenesProduccionRepository = new OrdenesProduccionRepository(prisma);
export const ordenesProduccionService = new OrdenesProduccionService(
  ordenesProduccionRepository,
  operariosService,
  itemsService,
);

export const movimientosRepository = new MovimientosRepository(prisma);
export const movimientosService = new MovimientosService(
  movimientosRepository,
  stockService,
  itemsService,
  operariosService,
  ordenesProduccionService,
);

export const usersRepository = new UsersRepository(prisma);
export const usersService = new UsersService(usersRepository);

export const authService = new AuthService(prisma);
export const adminService = new AdminService(prisma);

export const whatsappService = new WhatsappService();
export const sessionStoreService = new SessionStoreService(prisma);
export const conversationService = new ConversationService(
  sessionStoreService,
  itemsService,
  operariosService,
  movimientosService,
  ordenesProduccionService,
  stockService,
);
