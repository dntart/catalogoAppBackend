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

  async getStockDecimal(
    negocioId: string,
    itemId: string,
  ): Promise<Prisma.Decimal> {
    const grupos = await this.stockRepository.sumarCantidadesPorTipo(
      negocioId,
      itemId,
    );

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

  async getStock(negocioId: string, itemId: string): Promise<number> {
    const stock = await this.getStockDecimal(negocioId, itemId);
    return stock.toNumber();
  }

  async validarStockSuficiente(
    negocioId: string,
    itemId: string,
    cantidad: number,
  ): Promise<void> {
    const stockActual = await this.getStockDecimal(negocioId, itemId);
    const stockResultante = stockActual.minus(cantidad);

    if (stockResultante.isNegative()) {
      const item = await this.itemsService.findOne(negocioId, itemId);
      const nombre = item.colorNombre
        ? `${item.nombre} ${item.colorNombre}`
        : item.nombre;
      throw new BadRequestException(
        `Stock insuficiente de ${nombre}: stock actual ${stockActual.toString()}, solicitado ${cantidad}`,
      );
    }
  }

  async getResumen(
    negocioId: string,
    categoria?: Categoria,
  ): Promise<ResumenStockItemEntity[]> {
    const items = await this.itemsService.findAll(negocioId, true);
    const itemsFiltrados = categoria
      ? items.filter((item) => item.categoria === categoria)
      : items;

    const grupos =
      await this.stockRepository.sumarCantidadesPorItemGlobal(negocioId);
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

    return itemsFiltrados.map((item) => {
      const stock = stockPorItem.get(item.id) ?? new Prisma.Decimal(0);
      const stockMinimo = item.stockMinimo ? item.stockMinimo.toNumber() : null;
      return {
        itemId: item.id,
        codigo: item.codigo,
        nombre: item.colorNombre
          ? `${item.nombre} ${item.colorNombre}`
          : item.nombre,
        categoria: item.categoria,
        unidad: item.unidad,
        stock: stock.toNumber(),
        stockMinimo,
        bajoMinimo: stockMinimo !== null && stock.toNumber() <= stockMinimo,
      };
    });
  }
}
