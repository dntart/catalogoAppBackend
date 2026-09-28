import { BadRequestError as BadRequestException, NotFoundError as NotFoundException } from '../../auth';
import {
  Item,
  Movimiento,
  MovimientoTipo,
  Operario,
  OrdenProduccion,
} from '@prisma/client';
import { MovimientosService } from './movimientos.service';
import { MovimientosRepository } from './movimientos.repository';
import { StockService } from '../stock/stock.service';
import { ItemsService } from '../items/items.service';
import { OperariosService } from '../operarios/operarios.service';
import { OrdenesProduccionService } from '../ordenes-produccion/ordenes-produccion.service';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';

const NEGOCIO_ID = 'negocio-1';
const ITEM_MOCK = { id: 'item-1' } as Item;
const OPERARIO_MOCK = { id: 'operario-1' } as Operario;
const MOVIMIENTO_MOCK = { id: 'mov-1' } as Movimiento;
const ORDEN_MOCK = {
  id: 'orden-1',
  operarioId: 'operario-de-la-orden',
} as OrdenProduccion;

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
  let ordenesProduccionService: { findOne: jest.Mock };

  beforeEach(() => {
    repository = { create: jest.fn(), findAll: jest.fn(), findById: jest.fn() };
    stockService = { validarStockSuficiente: jest.fn() };
    itemsService = { findOne: jest.fn() };
    operariosService = { findOne: jest.fn() };
    ordenesProduccionService = { findOne: jest.fn() };

    service = new MovimientosService(
      repository as unknown as MovimientosRepository,
      stockService as unknown as StockService,
      itemsService as unknown as ItemsService,
      operariosService as unknown as OperariosService,
      ordenesProduccionService as unknown as OrdenesProduccionService,
    );

    itemsService.findOne.mockResolvedValue(ITEM_MOCK);
    operariosService.findOne.mockResolvedValue(OPERARIO_MOCK);
    ordenesProduccionService.findOne.mockResolvedValue(ORDEN_MOCK);
    repository.create.mockResolvedValue(MOVIMIENTO_MOCK);
  });

  it('crea un movimiento de COMPRA sin validar stock', async () => {
    await service.create(NEGOCIO_ID, buildDto());

    expect(stockService.validarStockSuficiente).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('pasa montoTotal al repository cuando viene en el DTO', async () => {
    await service.create(NEGOCIO_ID, buildDto({ montoTotal: 15000 }));

    expect(repository.create).toHaveBeenCalledWith(
      NEGOCIO_ID,
      expect.objectContaining({ montoTotal: 15000 }),
    );
  });

  it('monto Total queda undefined si no se informa precio', async () => {
    await service.create(NEGOCIO_ID, buildDto());

    expect(repository.create).toHaveBeenCalledWith(
      NEGOCIO_ID,
      expect.objectContaining({ montoTotal: undefined }),
    );
  });

  it('buscarPorTipo filtra por tipo y rango de fechas cuando se pasan los dos', async () => {
    const desde = new Date('2026-03-01T00:00:00.000Z');
    const hasta = new Date('2026-03-02T00:00:00.000Z');
    repository.findAll.mockResolvedValue([]);

    await service.buscarPorTipo(NEGOCIO_ID, {
      tipo: MovimientoTipo.VENTA,
      desde,
      hasta,
    });

    expect(repository.findAll).toHaveBeenCalledWith(NEGOCIO_ID, {
      tipo: MovimientoTipo.VENTA,
      fecha: { gte: desde, lt: hasta },
    });
  });

  it('buscarPorTipo sin rango de fechas trae todo el historico de ese tipo', async () => {
    repository.findAll.mockResolvedValue([]);

    await service.buscarPorTipo(NEGOCIO_ID, { tipo: MovimientoTipo.CONSUMO });

    expect(repository.findAll).toHaveBeenCalledWith(NEGOCIO_ID, {
      tipo: MovimientoTipo.CONSUMO,
    });
  });

  it('valida stock suficiente antes de un CONSUMO', async () => {
    await service.create(
      NEGOCIO_ID,
      buildDto({ tipo: MovimientoTipo.CONSUMO }),
    );

    expect(stockService.validarStockSuficiente).toHaveBeenCalledWith(
      NEGOCIO_ID,
      'item-1',
      10,
    );
  });

  it('valida stock suficiente antes de una VENTA', async () => {
    await service.create(NEGOCIO_ID, buildDto({ tipo: MovimientoTipo.VENTA }));

    expect(stockService.validarStockSuficiente).toHaveBeenCalledWith(
      NEGOCIO_ID,
      'item-1',
      10,
    );
  });

  it('propaga el error de stock insuficiente sin crear el movimiento', async () => {
    stockService.validarStockSuficiente.mockRejectedValue(
      new BadRequestException('sin stock'),
    );

    await expect(
      service.create(NEGOCIO_ID, buildDto({ tipo: MovimientoTipo.VENTA })),
    ).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza cantidad <= 0 para tipos distintos de AJUSTE', async () => {
    await expect(
      service.create(NEGOCIO_ID, buildDto({ cantidad: 0 })),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create(NEGOCIO_ID, buildDto({ cantidad: -5 })),
    ).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('permite cantidad negativa en AJUSTE', async () => {
    await service.create(
      NEGOCIO_ID,
      buildDto({ tipo: MovimientoTipo.AJUSTE, cantidad: -3 }),
    );

    expect(stockService.validarStockSuficiente).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('lanza NotFoundException si el item no existe', async () => {
    itemsService.findOne.mockRejectedValue(new NotFoundException('no existe'));

    await expect(service.create(NEGOCIO_ID, buildDto())).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('valida que el operario exista cuando se informa operarioId', async () => {
    operariosService.findOne.mockRejectedValue(
      new NotFoundException('no existe'),
    );

    await expect(
      service.create(NEGOCIO_ID, buildDto({ operarioId: 'operario-x' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('no valida operario cuando no se informa operarioId', async () => {
    await service.create(NEGOCIO_ID, buildDto());

    expect(operariosService.findOne).not.toHaveBeenCalled();
  });

  it('cuando se informa ordenProduccionId, deriva el operarioId de la orden y no valida operarioId aparte', async () => {
    await service.create(
      NEGOCIO_ID,
      buildDto({ ordenProduccionId: 'orden-1', operarioId: 'operario-1' }),
    );

    expect(ordenesProduccionService.findOne).toHaveBeenCalledWith(
      NEGOCIO_ID,
      'orden-1',
    );
    expect(operariosService.findOne).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      NEGOCIO_ID,
      expect.objectContaining({
        operario: { connect: { id: 'operario-de-la-orden' } },
        ordenProduccion: { connect: { id: 'orden-1' } },
      }),
    );
  });

  it('lanza NotFoundException si la orden de producción no existe', async () => {
    ordenesProduccionService.findOne.mockRejectedValue(
      new NotFoundException('no existe'),
    );

    await expect(
      service.create(NEGOCIO_ID, buildDto({ ordenProduccionId: 'orden-x' })),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
