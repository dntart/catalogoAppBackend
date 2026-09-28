import {
  ConflictError as ConflictException,
  NotFoundError as NotFoundException,
} from '../../auth';
import { PrismaClient } from '@prisma/client';
import { AdminService } from './admin.service';

const NEGOCIO_MOCK = {
  id: 'negocio-1',
  nombre: 'Fauna de Tela',
  activo: true,
  createdAt: new Date('2026-01-01'),
};

const USUARIO_MOCK = {
  id: 'user-1',
  nombre: 'Dueño',
  email: 'dueno@faunadetela.com',
  passwordHash: 'hash-secreto',
  whatsappNumber: 'whatsapp:+5493884867215',
  esSuperAdmin: true,
  activo: true,
};

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    negocio: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      negocio: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    service = new AdminService(prisma as unknown as PrismaClient);
  });

  describe('listarNegocios', () => {
    it('devuelve los negocios con sus usuarios, sin passwordHash', async () => {
      prisma.negocio.findMany.mockResolvedValue([
        { ...NEGOCIO_MOCK, usuarios: [USUARIO_MOCK] },
      ]);

      const resultado = await service.listarNegocios();

      expect(prisma.negocio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { usuarios: { select: expect.any(Object) } },
        }),
      );
      expect(resultado).toEqual([
        {
          id: NEGOCIO_MOCK.id,
          nombre: NEGOCIO_MOCK.nombre,
          activo: NEGOCIO_MOCK.activo,
          createdAt: NEGOCIO_MOCK.createdAt,
          usuarios: [USUARIO_MOCK],
        },
      ]);
    });
  });

  describe('actualizarNegocio', () => {
    it('lanza NotFoundException si el negocio no existe', async () => {
      prisma.negocio.findUnique.mockResolvedValue(null);

      await expect(
        service.actualizarNegocio('no-existe', { activo: false }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.negocio.update).not.toHaveBeenCalled();
    });

    it('actualiza nombre y activo', async () => {
      prisma.negocio.findUnique.mockResolvedValue(NEGOCIO_MOCK);
      prisma.negocio.update.mockResolvedValue({ ...NEGOCIO_MOCK, activo: false });

      const resultado = await service.actualizarNegocio('negocio-1', {
        activo: false,
      });

      expect(prisma.negocio.update).toHaveBeenCalledWith({
        where: { id: 'negocio-1' },
        data: { nombre: undefined, activo: false },
      });
      expect(resultado.activo).toBe(false);
    });
  });

  describe('actualizarUsuario', () => {
    it('lanza NotFoundException si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.actualizarUsuario('no-existe', { email: 'nuevo@x.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza un email ya usado por otro usuario', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(USUARIO_MOCK) // el usuario a editar
        .mockResolvedValueOnce({ id: 'otro-user' }); // colision de email

      await expect(
        service.actualizarUsuario('user-1', { email: 'otro@x.com' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rechaza un numero de WhatsApp ya usado por otro usuario', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(USUARIO_MOCK)
        .mockResolvedValueOnce({ id: 'otro-user' });

      await expect(
        service.actualizarUsuario('user-1', {
          whatsappNumber: 'whatsapp:+5493815533893',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('actualiza el numero de WhatsApp y nunca devuelve passwordHash', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(USUARIO_MOCK) // el usuario a editar
        .mockResolvedValueOnce(null); // sin colision: numero libre
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        nombre: 'Dueño',
        email: 'dueno@faunadetela.com',
        whatsappNumber: 'whatsapp:+5493815533893',
        esSuperAdmin: true,
        activo: true,
      });

      const resultado = await service.actualizarUsuario('user-1', {
        whatsappNumber: 'whatsapp:+5493815533893',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: {
            email: undefined,
            whatsappNumber: 'whatsapp:+5493815533893',
            activo: undefined,
          },
        }),
      );
      expect(resultado).not.toHaveProperty('passwordHash');
      expect(resultado.whatsappNumber).toBe('whatsapp:+5493815533893');
    });

    it('permite volver a guardar el mismo email/whatsapp sin chocar contra si mismo', async () => {
      prisma.user.findUnique.mockResolvedValue(USUARIO_MOCK);
      prisma.user.update.mockResolvedValue(USUARIO_MOCK);

      await service.actualizarUsuario('user-1', {
        email: USUARIO_MOCK.email,
        whatsappNumber: USUARIO_MOCK.whatsappNumber,
      });

      // no debe haber consultado colision porque email/whatsapp no cambiaron
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});
