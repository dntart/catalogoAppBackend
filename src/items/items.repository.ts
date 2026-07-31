import { Injectable } from '@nestjs/common';
import { Item, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    negocioId: string,
    data: Omit<Prisma.ItemCreateInput, 'negocio'>,
  ): Promise<Item> {
    return this.prisma.item.create({
      data: { ...data, negocio: { connect: { id: negocioId } } },
    });
  }

  findAll(
    negocioId: string,
    where?: Omit<Prisma.ItemWhereInput, 'negocioId'>,
  ): Promise<Item[]> {
    return this.prisma.item.findMany({
      where: { ...where, negocioId },
      orderBy: { nombre: 'asc' },
    });
  }

  findById(negocioId: string, id: string): Promise<Item | null> {
    return this.prisma.item.findFirst({ where: { id, negocioId } });
  }

  update(id: string, data: Prisma.ItemUpdateInput): Promise<Item> {
    return this.prisma.item.update({ where: { id }, data });
  }
}
