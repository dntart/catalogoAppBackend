import type { PrismaClient, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthError, signToken } from '../../auth';

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  nombre: string;
  negocioId: string;
  whatsappNumber: string | null;
  esSuperAdmin: boolean;
  activo: boolean;
  createdAt: Date;
}

function toAuthenticatedUser(user: User): AuthenticatedUserDto {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    negocioId: user.negocioId,
    whatsappNumber: user.whatsappNumber,
    esSuperAdmin: user.esSuperAdmin,
    activo: user.activo,
    createdAt: user.createdAt,
  };
}

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async validateUser(email: string, password: string): Promise<AuthenticatedUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { negocio: true },
    });
    if (!user || !user.activo || !user.negocio.activo) {
      throw new AuthError('Credenciales inválidas', 401);
    }

    const passwordValida = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValida) {
      throw new AuthError('Credenciales inválidas', 401);
    }

    return toAuthenticatedUser(user);
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.validateUser(email, password);
    return { accessToken: signToken(user) };
  }
}
