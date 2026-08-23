import { NotFoundError as NotFoundException } from '../../auth';
import { OrdenProduccion } from '@prisma/client';
import { OrdenesProduccionRepository } from './ordenes-produccion.repository';
import { CreateOrdenProduccionDto } from './dto/create-orden-produccion.dto';
import { ResumenItemEntity } from './entities/orden-produccion.entity';
import { OperariosService } from '../operarios/operarios.service';
import { ItemsService } from '../items/items.service';

export class OrdenesProduccionService {
  constructor(
    private readonly ordenesProduccionRepository: OrdenesProduccionRepository,
    private readonly operariosService: OperariosService,
    private readonly itemsService: ItemsService,
  ) {}

  async create(
    negocioId: string,
    dto: CreateOrdenProduccionDto,
  ): Promise<OrdenProduccion> {
    await this.operariosService.findOne(negocioId, dto.operarioId);

    return this.ordenesProduccionRepository.create(negocioId, {
      operario: { connect: { id: dto.operarioId } },
      observaciones: dto.observaciones,
    });
  }

  findAll(negocioId: string, operarioId?: string): Promise<OrdenProduccion[]> {
    return this.ordenesProduccionRepository.findAll(
      negocioId,
      operarioId ? { operarioId } : undefined,
    );
  }

  async findOne(negocioId: string, id: string) {
    const orden = await this.ordenesProduccionRepository.findById(
      negocioId,
      id,
    );
    if (!orden) {
      throw new NotFoundException(`Orden de producción ${id} no encontrada`);
    }
    return orden;
  }

  async getResumen(
    negocioId: string,
    id: string,
  ): Promise<ResumenItemEntity[]> {
    await this.findOne(negocioId, id);
    const grupos =
      await this.ordenesProduccionRepository.sumarCantidadesPorItem(
        negocioId,
        id,
      );

    const resumen: ResumenItemEntity[] = [];
    for (const grupo of grupos) {
      const item = await this.itemsService.findOne(negocioId, grupo.itemId);
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
