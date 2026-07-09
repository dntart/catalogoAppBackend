import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockRepository {
  constructor(private readonly prisma: PrismaService) {}

  sumarCantidadesPorTipo(itemId: string) {
    return this.prisma.movimiento.groupBy({
      by: ['tipo'],
      where: { itemId },
      _sum: { cantidad: true },
    });
  }
}
