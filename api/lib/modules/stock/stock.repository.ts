import type { PrismaClient } from '@prisma/client';

export class StockRepository {
  constructor(private readonly prisma: PrismaClient) {}

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
