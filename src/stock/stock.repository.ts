import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockRepository {
  constructor(private readonly prisma: PrismaService) {}

  sumarCantidadesPorTipo(negocioId: string, itemId: string) {
    return this.prisma.movimiento.groupBy({
      by: ['tipo'],
      where: { itemId, negocioId },
      _sum: { cantidad: true },
    });
  }

  sumarCantidadesPorItemGlobal(negocioId: string) {
    return this.prisma.movimiento.groupBy({
      by: ['itemId', 'tipo'],
      where: { negocioId },
      _sum: { cantidad: true },
    });
  }
}
