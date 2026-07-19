import { Injectable } from '@nestjs/common';
import { OrdenProduccion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type OrdenProduccionConMovimientos = OrdenProduccion & {
  movimientos: Prisma.MovimientoGetPayload<{ include: { item: true } }>[];
};

@Injectable()
export class OrdenesProduccionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.OrdenProduccionCreateInput): Promise<OrdenProduccion> {
    return this.prisma.ordenProduccion.create({ data });
  }

  findAll(
    where?: Prisma.OrdenProduccionWhereInput,
  ): Promise<OrdenProduccion[]> {
    return this.prisma.ordenProduccion.findMany({
      where,
      orderBy: { fecha: 'desc' },
    });
  }

  findById(id: string): Promise<OrdenProduccionConMovimientos | null> {
    return this.prisma.ordenProduccion.findUnique({
      where: { id },
      include: {
        movimientos: { include: { item: true }, orderBy: { fecha: 'asc' } },
      },
    });
  }

  sumarCantidadesPorItem(ordenProduccionId: string) {
    return this.prisma.movimiento.groupBy({
      by: ['itemId', 'tipo'],
      where: { ordenProduccionId },
      _sum: { cantidad: true },
    });
  }
}
