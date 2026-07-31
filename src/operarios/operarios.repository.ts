import { Injectable } from '@nestjs/common';
import { Operario, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    negocioId: string,
    data: Omit<Prisma.OperarioCreateInput, 'negocio'>,
  ): Promise<Operario> {
    return this.prisma.operario.create({
      data: { ...data, negocio: { connect: { id: negocioId } } },
    });
  }

  findAll(
    negocioId: string,
    where?: Omit<Prisma.OperarioWhereInput, 'negocioId'>,
  ): Promise<Operario[]> {
    return this.prisma.operario.findMany({
      where: { ...where, negocioId },
      orderBy: { nombre: 'asc' },
    });
  }

  findById(negocioId: string, id: string): Promise<Operario | null> {
    return this.prisma.operario.findFirst({ where: { id, negocioId } });
  }

  update(id: string, data: Prisma.OperarioUpdateInput): Promise<Operario> {
    return this.prisma.operario.update({ where: { id }, data });
  }
}
