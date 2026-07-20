import { BadRequestException } from '@nestjs/common';
import {
  Categoria,
  Item,
  MovimientoTipo,
  Prisma,
  Unidad,
} from '@prisma/client';
import { StockService } from './stock.service';
import { StockRepository } from './stock.repository';
import { ItemsService } from '../items/items.service';

const ITEM_GABARDINA = {
  id: 'item-1',
  nombre: 'Gabardina',
  colorNombre: 'Beige',
  categoria: Categoria.MATERIAL,
  unidad: Unidad.METRO,
} as Item;
const ITEM_ZORRO = {
  id: 'item-2',
  nombre: 'Zorro',
  colorNombre: null,
  categoria: Categoria.PRODUCTO,
  unidad: Unidad.UNIDAD,
} as Item;

describe('StockService', () => {
  let service: StockService;
  let repository: {
    sumarCantidadesPorTipo: jest.Mock;
    sumarCantidadesPorItemGlobal: jest.Mock;
  };
  let itemsService: { findAll: jest.Mock };

  beforeEach(() => {
    repository = {
      sumarCantidadesPorTipo: jest.fn(),
      sumarCantidadesPorItemGlobal: jest.fn(),
    };
    itemsService = { findAll: jest.fn() };
    service = new StockService(
      repository as unknown as StockRepository,
      itemsService as unknown as ItemsService,
    );
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

  describe('getResumen', () => {
    it('calcula el stock de cada item activo, con nombre+color combinados', async () => {
      itemsService.findAll.mockResolvedValue([ITEM_GABARDINA, ITEM_ZORRO]);
      repository.sumarCantidadesPorItemGlobal.mockResolvedValue([
        {
          itemId: 'item-1',
          tipo: MovimientoTipo.COMPRA,
          _sum: { cantidad: new Prisma.Decimal(20) },
        },
        {
          itemId: 'item-1',
          tipo: MovimientoTipo.CONSUMO,
          _sum: { cantidad: new Prisma.Decimal(5) },
        },
        {
          itemId: 'item-2',
          tipo: MovimientoTipo.PRODUCCION,
          _sum: { cantidad: new Prisma.Decimal(3) },
        },
      ]);

      const resumen = await service.getResumen();

      expect(resumen).toEqual([
        {
          itemId: 'item-1',
          nombre: 'Gabardina Beige',
          categoria: Categoria.MATERIAL,
          unidad: Unidad.METRO,
          stock: 15,
        },
        {
          itemId: 'item-2',
          nombre: 'Zorro',
          categoria: Categoria.PRODUCTO,
          unidad: Unidad.UNIDAD,
          stock: 3,
        },
      ]);
    });

    it('filtra por categoria cuando se informa', async () => {
      itemsService.findAll.mockResolvedValue([ITEM_GABARDINA, ITEM_ZORRO]);
      repository.sumarCantidadesPorItemGlobal.mockResolvedValue([]);

      const resumen = await service.getResumen(Categoria.PRODUCTO);

      expect(resumen).toEqual([
        {
          itemId: 'item-2',
          nombre: 'Zorro',
          categoria: Categoria.PRODUCTO,
          unidad: Unidad.UNIDAD,
          stock: 0,
        },
      ]);
    });
  });
});
