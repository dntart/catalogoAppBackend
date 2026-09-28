import type { Negocio, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  ConflictError as ConflictException,
  NotFoundError as NotFoundException,
} from '../../auth';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioAdminDto } from './dto/update-negocio-admin.dto';
import { UpdateUsuarioAdminDto } from './dto/update-usuario-admin.dto';
import { NegocioEntity } from './entities/negocio.entity';
import {
  NegocioConUsuariosEntity,
  UsuarioResumenEntity,
} from './entities/negocio-con-usuarios.entity';

/// Selección explícita: nunca traer passwordHash hacia el panel de admin.
const SELECT_USUARIO_RESUMEN = {
  id: true,
  nombre: true,
  email: true,
  whatsappNumber: true,
  esSuperAdmin: true,
  activo: true,
} as const;

export class AdminService {
  constructor(private readonly prisma: PrismaClient) {}

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

  async listarNegocios(): Promise<NegocioConUsuariosEntity[]> {
    const negocios = await this.prisma.negocio.findMany({
      include: { usuarios: { select: SELECT_USUARIO_RESUMEN } },
      orderBy: { createdAt: 'desc' },
    });

    return negocios.map((negocio) => ({
      id: negocio.id,
      nombre: negocio.nombre,
      activo: negocio.activo,
      createdAt: negocio.createdAt,
      usuarios: negocio.usuarios as UsuarioResumenEntity[],
    }));
  }

  async actualizarNegocio(
    id: string,
    dto: UpdateNegocioAdminDto,
  ): Promise<Negocio> {
    const negocio = await this.prisma.negocio.findUnique({ where: { id } });
    if (!negocio) {
      throw new NotFoundException(`Negocio ${id} no encontrado`);
    }

    return this.prisma.negocio.update({
      where: { id },
      data: { nombre: dto.nombre, activo: dto.activo },
    });
  }

  async actualizarUsuario(
    id: string,
    dto: UpdateUsuarioAdminDto,
  ): Promise<UsuarioResumenEntity> {
    const usuario = await this.prisma.user.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }

    if (dto.email && dto.email !== usuario.email) {
      const existente = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existente) {
        throw new ConflictException(
          `Ya existe un usuario con el email ${dto.email}`,
        );
      }
    }

    if (dto.whatsappNumber && dto.whatsappNumber !== usuario.whatsappNumber) {
      const existente = await this.prisma.user.findUnique({
        where: { whatsappNumber: dto.whatsappNumber },
      });
      if (existente) {
        throw new ConflictException(
          `Ya existe un usuario con el número ${dto.whatsappNumber}`,
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        whatsappNumber: dto.whatsappNumber,
        activo: dto.activo,
      },
      select: SELECT_USUARIO_RESUMEN,
    });
  }
}
