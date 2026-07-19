import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

async function buildUser(overrides: Partial<User> = {}): Promise<User> {
  return {
    id: 'user-1',
    email: 'dueño@faunadetela.com',
    passwordHash: await bcrypt.hash('contraseña-correcta', 10),
    nombre: 'Dueño',
    activo: true,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(() => {
    usersService = { findByEmail: jest.fn() };
    jwtService = { signAsync: jest.fn() };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  describe('validateUser', () => {
    it('devuelve el usuario sin passwordHash cuando las credenciales son correctas', async () => {
      const user = await buildUser();
      usersService.findByEmail.mockResolvedValue(user);

      const resultado = await service.validateUser(
        user.email,
        'contraseña-correcta',
      );

      expect(resultado).toEqual({
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        activo: user.activo,
        createdAt: user.createdAt,
      });
      expect(resultado).not.toHaveProperty('passwordHash');
    });

    it('lanza UnauthorizedException si el email no existe', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('no-existe@x.com', 'cualquiera'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario esta inactivo', async () => {
      const user = await buildUser({ activo: false });
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        service.validateUser(user.email, 'contraseña-correcta'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña no coincide', async () => {
      const user = await buildUser();
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        service.validateUser(user.email, 'contraseña-incorrecta'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('devuelve un accessToken firmado con el id y email del usuario', async () => {
      const user = await buildUser();
      usersService.findByEmail.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValue('token-firmado');

      const resultado = await service.login({
        email: user.email,
        password: 'contraseña-correcta',
      });

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
      expect(resultado).toEqual({ accessToken: 'token-firmado' });
    });
  });
});
