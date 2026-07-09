import { BadRequestException } from '@nestjs/common';
import { MovimientoTipo, Prisma } from '@prisma/client';
import { StockService } from './stock.service';
import { StockRepository } from './stock.repository';

describe('StockService', () => {
  let service: StockService;
  let repository: { sumarCantidadesPorTipo: jest.Mock };

  beforeEach(() => {
    repository = { sumarCantidadesPorTipo: jest.fn() };
    service = new StockService(repository as unknown as StockRepository);
  });

  describe('getStock', () => {
    it('devuelve 0 cuando el item no tiene movimientos', async () => {
      repository.sumarCantidadesPorTipo.mockResolvedValue([]);

      await expect(service.getStock('item-1')).resolves.toBe(0);
    });

    it('suma COMPRA y PRODUCCION, resta CONSUMO y VENTA', async () => {
      repository.sumarCantidadesPorTipo.mockResolvedValue([
        {
          tipo: MovimientoTipo.COMPRA,
          _sum: { cantidad: new Prisma.Decimal(20) },
        },
        {
          tipo: MovimientoTipo.PRODUCCION,
          _sum: { cantidad: new Prisma.Decimal(5) },
        },
        {
          tipo: MovimientoTipo.CONSUMO,
          _sum: { cantidad: new Prisma.Decimal(8) },
        },
        {
          tipo: MovimientoTipo.VENTA,
          _sum: { cantidad: new Prisma.Decimal(3) },
        },
      ]);

      await expect(service.getStock('item-1')).resolves.toBe(14);
    });

    it('aplica AJUSTE respetando su propio signo', async () => {
      repository.sumarCantidadesPorTipo.mockResolvedValue([
        {
          tipo: MovimientoTipo.COMPRA,
          _sum: { cantidad: new Prisma.Decimal(10) },
        },
        {
          tipo: MovimientoTipo.AJUSTE,
          _sum: { cantidad: new Prisma.Decimal(-2) },
        },
      ]);

      await expect(service.getStock('item-1')).resolves.toBe(8);
    });

    it('trata un grupo sin suma (_sum.cantidad null) como cero', async () => {
      repository.sumarCantidadesPorTipo.mockResolvedValue([
        { tipo: MovimientoTipo.COMPRA, _sum: { cantidad: null } },
      ]);

      await expect(service.getStock('item-1')).resolves.toBe(0);
    });
  });

  describe('validarStockSuficiente', () => {
    it('no lanza error cuando el stock resultante es exactamente cero', async () => {
      repository.sumarCantidadesPorTipo.mockResolvedValue([
        {
          tipo: MovimientoTipo.COMPRA,
          _sum: { cantidad: new Prisma.Decimal(5) },
        },
      ]);

      await expect(
        service.validarStockSuficiente('item-1', 5),
      ).resolves.toBeUndefined();
    });

    it('lanza BadRequestException cuando el stock quedaria negativo', async () => {
      repository.sumarCantidadesPorTipo.mockResolvedValue([
        {
          tipo: MovimientoTipo.COMPRA,
          _sum: { cantidad: new Prisma.Decimal(5) },
        },
      ]);

      await expect(service.validarStockSuficiente('item-1', 6)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
