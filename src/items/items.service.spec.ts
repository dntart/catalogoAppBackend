import { NotFoundException } from '@nestjs/common';
import { Categoria, Item, Unidad } from '@prisma/client';
import { ItemsService } from './items.service';
import { ItemsRepository } from './items.repository';
import { CreateItemDto } from './dto/create-item.dto';

const ITEM_MOCK = { id: 'item-1', nombre: 'Vellón' } as Item;

describe('ItemsService', () => {
  let service: ItemsService;
  let repository: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    service = new ItemsService(repository as unknown as ItemsRepository);
  });

  it('fuerza colorNombre a null cuando tieneColor es false, aunque venga informado', async () => {
    const dto: CreateItemDto = {
      nombre: 'Vellón',
      categoria: Categoria.MATERIAL,
      unidad: Unidad.KG,
      tieneColor: false,
      colorNombre: 'Beige',
    };
    repository.create.mockResolvedValue(ITEM_MOCK);

    await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ tieneColor: false, colorNombre: null }),
    );
  });

  it('conserva el colorNombre cuando tieneColor es true', async () => {
    const dto: CreateItemDto = {
      nombre: 'Gabardina',
      categoria: Categoria.MATERIAL,
      unidad: Unidad.METRO,
      tieneColor: true,
      colorNombre: 'Beige',
    };
    repository.create.mockResolvedValue(ITEM_MOCK);

    await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ colorNombre: 'Beige' }),
    );
  });

  it('lanza NotFoundException si el item no existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findOne('no-existe')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('devuelve el item cuando existe', async () => {
    repository.findById.mockResolvedValue(ITEM_MOCK);

    await expect(service.findOne('item-1')).resolves.toEqual(ITEM_MOCK);
  });

  it('update verifica existencia antes de actualizar', async () => {
    repository.findById.mockResolvedValue(ITEM_MOCK);
    repository.update.mockResolvedValue(ITEM_MOCK);

    await service.update('item-1', { activo: false });

    expect(repository.findById).toHaveBeenCalledWith('item-1');
    expect(repository.update).toHaveBeenCalledWith('item-1', { activo: false });
  });

  it('update lanza NotFoundException si el item no existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.update('no-existe', { activo: false }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
