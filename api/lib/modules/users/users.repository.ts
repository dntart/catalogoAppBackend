import { Prisma, User } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export class UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByWhatsappNumber(whatsappNumber: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { whatsappNumber } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
