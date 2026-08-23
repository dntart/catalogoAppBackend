import { Movimiento, Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const INCLUDE_RELACIONES = {
  item: true,
  operario: true,
} satisfies Prisma.MovimientoInclude;

export type MovimientoConRelaciones = Prisma.MovimientoGetPayload<{
  include: typeof INCLUDE_RELACIONES;
}>;

export class MovimientosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(
    negocioId: string,
    data: Omit<Prisma.MovimientoCreateInput, 'negocio'>,
  ): Promise<Movimiento> {
    return this.prisma.movimiento.create({
      data: { ...data, negocio: { connect: { id: negocioId } } },
    });
  }

  findAll(
    negocioId: string,
    where?: Omit<Prisma.MovimientoWhereInput, 'negocioId'>,
  ): Promise<MovimientoConRelaciones[]> {
    return this.prisma.movimiento.findMany({
      where: { ...where, negocioId },
      orderBy: { fecha: 'desc' },
      include: INCLUDE_RELACIONES,
    });
  }

  findById(
    negocioId: string,
    id: string,
  ): Promise<MovimientoConRelaciones | null> {
    return this.prisma.movimiento.findFirst({
      where: { id, negocioId },
      include: INCLUDE_RELACIONES,
    });
  }
}
