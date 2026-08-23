import { Categoria, Item, Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

function prefijoCodigo(categoria: Categoria): string {
  return categoria === Categoria.MATERIAL ? 'MAT' : 'PROD';
}

export class ItemsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(
    negocioId: string,
    data: Omit<Prisma.ItemCreateInput, 'negocio' | 'codigo'>,
  ): Promise<Item> {
    return this.prisma.$transaction(async (tx) => {
      // Contador atómico por negocio+categoría (UPDATE con lock de fila) para
      // que dos altas simultáneas nunca terminen con el mismo código.
      const secuencia = await tx.secuenciaCodigo.upsert({
        where: {
          negocioId_categoria: { negocioId, categoria: data.categoria },
        },
        update: { ultimoValor: { increment: 1 } },
        create: { negocioId, categoria: data.categoria, ultimoValor: 1 },
      });
      const codigo = `${prefijoCodigo(data.categoria)}-${String(secuencia.ultimoValor).padStart(4, '0')}`;

      return tx.item.create({
        data: { ...data, codigo, negocio: { connect: { id: negocioId } } },
      });
    });
  }

  findAll(
    negocioId: string,
    where?: Omit<Prisma.ItemWhereInput, 'negocioId'>,
  ): Promise<Item[]> {
    return this.prisma.item.findMany({
      where: { ...where, negocioId },
      orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }, { colorNombre: 'asc' }],
    });
  }

  findById(negocioId: string, id: string): Promise<Item | null> {
    return this.prisma.item.findFirst({ where: { id, negocioId } });
  }

  update(id: string, data: Prisma.ItemUpdateInput): Promise<Item> {
    return this.prisma.item.update({ where: { id }, data });
  }
}
