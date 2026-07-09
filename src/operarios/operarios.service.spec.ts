import { NotFoundException } from '@nestjs/common';
import { Operario } from '@prisma/client';
import { OperariosService } from './operarios.service';
import { OperariosRepository } from './operarios.repository';

const OPERARIO_MOCK = { id: 'operario-1', nombre: 'María' } as Operario;

describe('OperariosService', () => {
  let service: OperariosService;
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
    service = new OperariosService(
      repository as unknown as OperariosRepository,
    );
  });

  it('crea un operario', async () => {
    repository.create.mockResolvedValue(OPERARIO_MOCK);

    await service.create({ nombre: 'María' });

    expect(repository.create).toHaveBeenCalledWith({ nombre: 'María' });
  });

  it('lanza NotFoundException si el operario no existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findOne('no-existe')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('devuelve el operario cuando existe', async () => {
    repository.findById.mockResolvedValue(OPERARIO_MOCK);

    await expect(service.findOne('operario-1')).resolves.toEqual(OPERARIO_MOCK);
  });

  it('update verifica existencia antes de actualizar', async () => {
    repository.findById.mockResolvedValue(OPERARIO_MOCK);
    repository.update.mockResolvedValue(OPERARIO_MOCK);

    await service.update('operario-1', { activo: false });

    expect(repository.update).toHaveBeenCalledWith('operario-1', {
      activo: false,
    });
  });

  it('update lanza NotFoundException si el operario no existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.update('no-existe', { activo: false }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
