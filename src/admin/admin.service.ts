import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { NegocioEntity } from './entities/negocio.entity';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async crearNegocio(dto: CreateNegocioDto): Promise<NegocioEntity> {
    const emailExistente = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail },
    });
    if (emailExistente) {
      throw new ConflictException(
        `Ya existe un usuario con el email ${dto.ownerEmail}`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);

    const { negocio, owner } = await this.prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.create({
        data: { nombre: dto.nombreNegocio },
      });
      const owner = await tx.user.create({
        data: {
          negocioId: negocio.id,
          email: dto.ownerEmail,
          passwordHash,
          nombre: dto.ownerNombre,
          whatsappNumber: dto.ownerWhatsappNumber,
          esSuperAdmin: false,
        },
      });
      return { negocio, owner };
    });

    return {
      id: negocio.id,
      nombre: negocio.nombre,
      activo: negocio.activo,
      createdAt: negocio.createdAt,
      ownerUserId: owner.id,
    };
  }
}
