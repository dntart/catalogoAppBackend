import { OrdenProduccion, Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

type OrdenProduccionConMovimientos = OrdenProduccion & {
  movimientos: Prisma.MovimientoGetPayload<{ include: { item: true } }>[];
};

export class OrdenesProduccionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(
    negocioId: string,
    data: Omit<Prisma.OrdenProduccionCreateInput, 'negocio'>,
  ): Promise<OrdenProduccion> {
    return this.prisma.ordenProduccion.create({
      data: { ...data, negocio: { connect: { id: negocioId } } },
    });
  }

  findAll(
    negocioId: string,
    where?: Omit<Prisma.OrdenProduccionWhereInput, 'negocioId'>,
  ): Promise<OrdenProduccion[]> {
    return this.prisma.ordenProduccion.findMany({
      where: { ...where, negocioId },
      orderBy: { fecha: 'desc' },
    });
  }

  findById(
    negocioId: string,
    id: string,
  ): Promise<OrdenProduccionConMovimientos | null> {
    return this.prisma.ordenProduccion.findFirst({
      where: { id, negocioId },
      include: {
        movimientos: { include: { item: true }, orderBy: { fecha: 'asc' } },
      },
    });
  }

  sumarCantidadesPorItem(negocioId: string, ordenProduccionId: string) {
    return this.prisma.movimiento.groupBy({
      by: ['itemId', 'tipo'],
      where: { ordenProduccionId, negocioId },
      _sum: { cantidad: true },
    });
  }

  cerrar(id: string, cerradaEn: Date): Promise<OrdenProduccion> {
    return this.prisma.ordenProduccion.update({
      where: { id },
      data: { estado: 'CERRADA', cerradaEn },
    });
  }
}
