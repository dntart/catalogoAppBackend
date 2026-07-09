import { Injectable } from '@nestjs/common';
import { Operario, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.OperarioCreateInput): Promise<Operario> {
    return this.prisma.operario.create({ data });
  }

  findAll(where?: Prisma.OperarioWhereInput): Promise<Operario[]> {
    return this.prisma.operario.findMany({ where, orderBy: { nombre: 'asc' } });
  }

  findById(id: string): Promise<Operario | null> {
    return this.prisma.operario.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.OperarioUpdateInput): Promise<Operario> {
    return this.prisma.operario.update({ where: { id }, data });
  }
}
