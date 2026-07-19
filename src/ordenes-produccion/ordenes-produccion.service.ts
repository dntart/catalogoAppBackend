import { Injectable, NotFoundException } from '@nestjs/common';
import { OrdenProduccion } from '@prisma/client';
import { OrdenesProduccionRepository } from './ordenes-produccion.repository';
import { CreateOrdenProduccionDto } from './dto/create-orden-produccion.dto';
import { ResumenItemEntity } from './entities/orden-produccion.entity';
import { OperariosService } from '../operarios/operarios.service';
import { ItemsService } from '../items/items.service';

@Injectable()
export class OrdenesProduccionService {
  constructor(
    private readonly ordenesProduccionRepository: OrdenesProduccionRepository,
    private readonly operariosService: OperariosService,
    private readonly itemsService: ItemsService,
  ) {}

  async create(dto: CreateOrdenProduccionDto): Promise<OrdenProduccion> {
    await this.operariosService.findOne(dto.operarioId);

    return this.ordenesProduccionRepository.create({
      operario: { connect: { id: dto.operarioId } },
      observaciones: dto.observaciones,
    });
  }

  findAll(operarioId?: string): Promise<OrdenProduccion[]> {
    return this.ordenesProduccionRepository.findAll(
      operarioId ? { operarioId } : undefined,
    );
  }

  async findOne(id: string) {
    const orden = await this.ordenesProduccionRepository.findById(id);
    if (!orden) {
      throw new NotFoundException(`Orden de producción ${id} no encontrada`);
    }
    return orden;
  }

  async getResumen(id: string): Promise<ResumenItemEntity[]> {
    await this.findOne(id);
    const grupos =
      await this.ordenesProduccionRepository.sumarCantidadesPorItem(id);

    const resumen: ResumenItemEntity[] = [];
    for (const grupo of grupos) {
      const item = await this.itemsService.findOne(grupo.itemId);
      resumen.push({
        itemId: grupo.itemId,
        itemNombre: item.colorNombre
          ? `${item.nombre} ${item.colorNombre}`
          : item.nombre,
        tipo: grupo.tipo,
        totalCantidad: (grupo._sum.cantidad ?? 0).toString(),
      });
    }
    return resumen;
  }
}
