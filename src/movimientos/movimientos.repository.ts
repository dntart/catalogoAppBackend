import { Injectable } from '@nestjs/common';
import { Movimiento, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const INCLUDE_RELACIONES = {
  item: true,
  operario: true,
} satisfies Prisma.MovimientoInclude;

export type MovimientoConRelaciones = Prisma.MovimientoGetPayload<{
  include: typeof INCLUDE_RELACIONES;
}>;

@Injectable()
export class MovimientosRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MovimientoCreateInput): Promise<Movimiento> {
    return this.prisma.movimiento.create({ data });
  }

  findAll(
    where?: Prisma.MovimientoWhereInput,
  ): Promise<MovimientoConRelaciones[]> {
    return this.prisma.movimiento.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: INCLUDE_RELACIONES,
    });
  }

  findById(id: string): Promise<MovimientoConRelaciones | null> {
    return this.prisma.movimiento.findUnique({
      where: { id },
      include: INCLUDE_RELACIONES,
    });
  }
}
