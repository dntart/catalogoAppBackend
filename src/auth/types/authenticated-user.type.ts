import { User } from '@prisma/client';

export type AuthenticatedUser = Omit<User, 'passwordHash'>;

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    negocioId: user.negocioId,
    email: user.email,
    nombre: user.nombre,
    whatsappNumber: user.whatsappNumber,
    esSuperAdmin: user.esSuperAdmin,
    activo: user.activo,
    createdAt: user.createdAt,
  };
}
