import { BadRequestException, Injectable } from '@nestjs/common';
import { Categoria, MovimientoTipo, Prisma } from '@prisma/client';
import { StockRepository } from './stock.repository';
import { ItemsService } from '../items/items.service';
import { ResumenStockItemEntity } from './entities/resumen-stock-item.entity';

const TIPOS_SALIDA: MovimientoTipo[] = [
  MovimientoTipo.CONSUMO,
  MovimientoTipo.VENTA,
];

function calcularDelta(
  tipo: MovimientoTipo,
  cantidad: Prisma.Decimal,
): Prisma.Decimal {
  if (TIPOS_SALIDA.includes(tipo)) {
    return cantidad.negated();
  }
  // ENTRADA (COMPRA/PRODUCCION) suma tal cual; AJUSTE ya viene con su propio signo
  return cantidad;
}

@Injectable()
export class StockService {
  constructor(
    private readonly stockRepository: StockRepository,
    private readonly itemsService: ItemsService,
  ) {}

  async getStockDecimal(itemId: string): Promise<Prisma.Decimal> {
    const grupos = await this.stockRepository.sumarCantidadesPorTipo(itemId);

    return grupos.reduce(
      (stock, grupo) =>
        stock.plus(
          calcularDelta(
            grupo.tipo,
            grupo._sum.cantidad ?? new Prisma.Decimal(0),
          ),
        ),
      new Prisma.Decimal(0),
    );
  }

  async getStock(itemId: string): Promise<number> {
    const stock = await this.getStockDecimal(itemId);
    return stock.toNumber();
  }

  async validarStockSuficiente(
    itemId: string,
    cantidad: number,
  ): Promise<void> {
    const stockActual = await this.getStockDecimal(itemId);
    const stockResultante = stockActual.minus(cantidad);

    if (stockResultante.isNegative()) {
      throw new BadRequestException(
        `Stock insuficiente para el item ${itemId}: stock actual ${stockActual.toString()}, solicitado ${cantidad}`,
      );
    }
  }

  async getResumen(categoria?: Categoria): Promise<ResumenStockItemEntity[]> {
    const items = await this.itemsService.findAll(true);
    const itemsFiltrados = categoria
      ? items.filter((item) => item.categoria === categoria)
      : items;

    const grupos = await this.stockRepository.sumarCantidadesPorItemGlobal();
    const stockPorItem = new Map<string, Prisma.Decimal>();
    for (const grupo of grupos) {
      const delta = calcularDelta(
        grupo.tipo,
        grupo._sum.cantidad ?? new Prisma.Decimal(0),
      );
      stockPorItem.set(
        grupo.itemId,
        (stockPorItem.get(grupo.itemId) ?? new Prisma.Decimal(0)).plus(delta),
      );
    }

    return itemsFiltrados.map((item) => ({
      itemId: item.id,
      nombre: item.colorNombre
        ? `${item.nombre} ${item.colorNombre}`
        : item.nombre,
      categoria: item.categoria,
      unidad: item.unidad,
      stock: (stockPorItem.get(item.id) ?? new Prisma.Decimal(0)).toNumber(),
    }));
  }
}
