import { Negocio, Prisma, User } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export type UserConNegocio = User & { negocio: Negocio };

export class UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /// Incluye el negocio: el webhook de WhatsApp necesita chequear
  /// negocio.activo además de user.activo antes de responder.
  findByWhatsappNumber(whatsappNumber: string): Promise<UserConNegocio | null> {
    return this.prisma.user.findUnique({
      where: { whatsappNumber },
      include: { negocio: true },
    });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
