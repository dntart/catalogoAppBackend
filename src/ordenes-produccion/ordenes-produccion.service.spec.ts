import { NotFoundException } from '@nestjs/common';
import {
  Item,
  MovimientoTipo,
  OrdenProduccion,
  Operario,
  Prisma,
} from '@prisma/client';
import { OrdenesProduccionService } from './ordenes-produccion.service';
import { OrdenesProduccionRepository } from './ordenes-produccion.repository';
import { OperariosService } from '../operarios/operarios.service';
import { ItemsService } from '../items/items.service';

const OPERARIO_MOCK = { id: 'operario-1' } as Operario;
const ORDEN_MOCK = {
  id: 'orden-1',
  operarioId: 'operario-1',
} as OrdenProduccion;
const ITEM_MOCK = {
  id: 'item-1',
  nombre: 'Gabardina',
  colorNombre: 'Beige',
} as Item;

describe('OrdenesProduccionService', () => {
  let service: OrdenesProduccionService;
  let repository: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    sumarCantidadesPorItem: jest.Mock;
  };
  let operariosService: { findOne: jest.Mock };
  let itemsService: { findOne: jest.Mock };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      sumarCantidadesPorItem: jest.fn(),
    };
    operariosService = { findOne: jest.fn() };
    itemsService = { findOne: jest.fn() };

    service = new OrdenesProduccionService(
      repository as unknown as OrdenesProduccionRepository,
      operariosService as unknown as OperariosService,
      itemsService as unknown as ItemsService,
    );

    operariosService.findOne.mockResolvedValue(OPERARIO_MOCK);
    repository.findById.mockResolvedValue(ORDEN_MOCK);
    itemsService.findOne.mockResolvedValue(ITEM_MOCK);
  });

  it('valida que el operario exista antes de crear la orden', async () => {
    operariosService.findOne.mockRejectedValue(
      new NotFoundException('no existe'),
    );

    await expect(service.create({ operarioId: 'operario-x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la orden no existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findOne('no-existe')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getResumen agrega cantidades por item y tipo, con el nombre del item resuelto', async () => {
    repository.sumarCantidadesPorItem.mockResolvedValue([
      {
        itemId: 'item-1',
        tipo: MovimientoTipo.CONSUMO,
        _sum: { cantidad: new Prisma.Decimal(5) },
      },
    ]);

    const resumen = await service.getResumen('orden-1');

    expect(resumen).toEqual([
      {
        itemId: 'item-1',
        itemNombre: 'Gabardina Beige',
        tipo: MovimientoTipo.CONSUMO,
        totalCantidad: '5',
      },
    ]);
  });
});
