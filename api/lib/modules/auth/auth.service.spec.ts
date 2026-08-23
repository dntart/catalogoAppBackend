import { AuthError as UnauthorizedException } from '../../auth';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';

process.env.JWT_SECRET = 'test-secret';

async function buildUser(overrides: Partial<User> = {}): Promise<User> {
  return {
    id: 'user-1',
    negocioId: 'negocio-1',
    email: 'dueño@faunadetela.com',
    passwordHash: await bcrypt.hash('contraseña-correcta', 10),
    nombre: 'Dueño',
    whatsappNumber: null,
    esSuperAdmin: false,
    activo: true,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    service = new AuthService(prisma as unknown as PrismaClient);
  });

  describe('validateUser', () => {
    it('devuelve el usuario sin passwordHash cuando las credenciales son correctas', async () => {
      const user = await buildUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const resultado = await service.validateUser(
        user.email,
        'contraseña-correcta',
      );

      expect(resultado).toEqual({
        id: user.id,
        negocioId: user.negocioId,
        email: user.email,
        nombre: user.nombre,
        whatsappNumber: user.whatsappNumber,
        esSuperAdmin: user.esSuperAdmin,
        activo: user.activo,
        createdAt: user.createdAt,
      });
      expect(resultado).not.toHaveProperty('passwordHash');
    });

    it('lanza UnauthorizedException si el email no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('no-existe@x.com', 'cualquiera'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario esta inactivo', async () => {
      const user = await buildUser({ activo: false });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.validateUser(user.email, 'contraseña-correcta'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña no coincide', async () => {
      const user = await buildUser();
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.validateUser(user.email, 'contraseña-incorrecta'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('devuelve un accessToken firmado con el id, email y negocioId del usuario', async () => {
      const user = await buildUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const resultado = await service.login(user.email, 'contraseña-correcta');

      const payload = jwt.verify(resultado.accessToken, process.env.JWT_SECRET!) as {
        sub: string;
        email: string;
        negocioId: string;
      };
      expect(payload.sub).toBe(user.id);
      expect(payload.email).toBe(user.email);
      expect(payload.negocioId).toBe(user.negocioId);
    });
  });
});
