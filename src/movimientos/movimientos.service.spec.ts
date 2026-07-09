import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Item, Movimiento, MovimientoTipo, Operario } from '@prisma/client';
import { MovimientosService } from './movimientos.service';
import { MovimientosRepository } from './movimientos.repository';
import { StockService } from '../stock/stock.service';
import { ItemsService } from '../items/items.service';
import { OperariosService } from '../operarios/operarios.service';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';

const ITEM_MOCK = { id: 'item-1' } as Item;
const OPERARIO_MOCK = { id: 'operario-1' } as Operario;
const MOVIMIENTO_MOCK = { id: 'mov-1' } as Movimiento;

function buildDto(
  overrides: Partial<CreateMovimientoDto> = {},
): CreateMovimientoDto {
  return {
    itemId: 'item-1',
    tipo: MovimientoTipo.COMPRA,
    cantidad: 10,
    ...overrides,
  };
}

describe('MovimientosService', () => {
  let service: MovimientosService;
  let repository: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
  };
  let stockService: { validarStockSuficiente: jest.Mock };
  let itemsService: { findOne: jest.Mock };
  let operariosService: { findOne: jest.Mock };

  beforeEach(() => {
    repository = { create: jest.fn(), findAll: jest.fn(), findById: jest.fn() };
    stockService = { validarStockSuficiente: jest.fn() };
    itemsService = { findOne: jest.fn() };
    operariosService = { findOne: jest.fn() };

    service = new MovimientosService(
      repository as unknown as MovimientosRepository,
      stockService as unknown as StockService,
      itemsService as unknown as ItemsService,
      operariosService as unknown as OperariosService,
    );

    itemsService.findOne.mockResolvedValue(ITEM_MOCK);
    operariosService.findOne.mockResolvedValue(OPERARIO_MOCK);
    repository.create.mockResolvedValue(MOVIMIENTO_MOCK);
  });

  it('crea un movimiento de COMPRA sin validar stock', async () => {
    await service.create(buildDto());

    expect(stockService.validarStockSuficiente).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('valida stock suficiente antes de un CONSUMO', async () => {
    await service.create(buildDto({ tipo: MovimientoTipo.CONSUMO }));

    expect(stockService.validarStockSuficiente).toHaveBeenCalledWith(
      'item-1',
      10,
    );
  });

  it('valida stock suficiente antes de una VENTA', async () => {
    await service.create(buildDto({ tipo: MovimientoTipo.VENTA }));

    expect(stockService.validarStockSuficiente).toHaveBeenCalledWith(
      'item-1',
      10,
    );
  });

  it('propaga el error de stock insuficiente sin crear el movimiento', async () => {
    stockService.validarStockSuficiente.mockRejectedValue(
      new BadRequestException('sin stock'),
    );

    await expect(
      service.create(buildDto({ tipo: MovimientoTipo.VENTA })),
    ).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza cantidad <= 0 para tipos distintos de AJUSTE', async () => {
    await expect(service.create(buildDto({ cantidad: 0 }))).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(buildDto({ cantidad: -5 }))).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('permite cantidad negativa en AJUSTE', async () => {
    await service.create(
      buildDto({ tipo: MovimientoTipo.AJUSTE, cantidad: -3 }),
    );

    expect(stockService.validarStockSuficiente).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('lanza NotFoundException si el item no existe', async () => {
    itemsService.findOne.mockRejectedValue(new NotFoundException('no existe'));

    await expect(service.create(buildDto())).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('valida que el operario exista cuando se informa operarioId', async () => {
    operariosService.findOne.mockRejectedValue(
      new NotFoundException('no existe'),
    );

    await expect(
      service.create(buildDto({ operarioId: 'operario-x' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('no valida operario cuando no se informa operarioId', async () => {
    await service.create(buildDto());

    expect(operariosService.findOne).not.toHaveBeenCalled();
  });
});
