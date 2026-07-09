import { Injectable } from '@nestjs/common';
import { Movimiento, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MovimientosRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MovimientoCreateInput): Promise<Movimiento> {
    return this.prisma.movimiento.create({ data });
  }

  findAll(where?: Prisma.MovimientoWhereInput): Promise<Movimiento[]> {
    return this.prisma.movimiento.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: { item: true, operario: true },
    });
  }

  findById(id: string): Promise<Movimiento | null> {
    return this.prisma.movimiento.findUnique({
      where: { id },
      include: { item: true, operario: true },
    });
  }
}
