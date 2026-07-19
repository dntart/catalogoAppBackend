import { User } from '@prisma/client';

export type AuthenticatedUser = Omit<User, 'passwordHash'>;

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    activo: user.activo,
    createdAt: user.createdAt,
  };
}
