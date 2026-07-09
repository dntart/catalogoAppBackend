import { BadRequestException, Injectable } from '@nestjs/common';
import { MovimientoTipo, Prisma } from '@prisma/client';
import { StockRepository } from './stock.repository';

const TIPOS_ENTRADA: MovimientoTipo[] = [
  MovimientoTipo.COMPRA,
  MovimientoTipo.PRODUCCION,
];
const TIPOS_SALIDA: MovimientoTipo[] = [
  MovimientoTipo.CONSUMO,
  MovimientoTipo.VENTA,
];

@Injectable()
export class StockService {
  constructor(private readonly stockRepository: StockRepository) {}

  async getStockDecimal(itemId: string): Promise<Prisma.Decimal> {
    const grupos = await this.stockRepository.sumarCantidadesPorTipo(itemId);

    return grupos.reduce((stock, grupo) => {
      const cantidad = grupo._sum.cantidad ?? new Prisma.Decimal(0);

      if (TIPOS_ENTRADA.includes(grupo.tipo)) {
        return stock.plus(cantidad);
      }
      if (TIPOS_SALIDA.includes(grupo.tipo)) {
        return stock.minus(cantidad);
      }
      // AJUSTE: la cantidad ya viene con signo (positivo suma, negativo resta)
      return stock.plus(cantidad);
    }, new Prisma.Decimal(0));
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
}
