import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Movimiento, MovimientoTipo } from '@prisma/client';
import { MovimientosRepository } from './movimientos.repository';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { StockService } from '../stock/stock.service';
import { ItemsService } from '../items/items.service';
import { OperariosService } from '../operarios/operarios.service';

const TIPOS_SALIDA: MovimientoTipo[] = [
  MovimientoTipo.CONSUMO,
  MovimientoTipo.VENTA,
];

@Injectable()
export class MovimientosService {
  constructor(
    private readonly movimientosRepository: MovimientosRepository,
    private readonly stockService: StockService,
    private readonly itemsService: ItemsService,
    private readonly operariosService: OperariosService,
  ) {}

  async create(dto: CreateMovimientoDto): Promise<Movimiento> {
    await this.itemsService.findOne(dto.itemId);

    if (dto.operarioId) {
      await this.operariosService.findOne(dto.operarioId);
    }

    if (dto.tipo !== MovimientoTipo.AJUSTE && dto.cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser mayor a cero para este tipo de movimiento',
      );
    }

    if (TIPOS_SALIDA.includes(dto.tipo)) {
      await this.stockService.validarStockSuficiente(dto.itemId, dto.cantidad);
    }

    return this.movimientosRepository.create({
      item: { connect: { id: dto.itemId } },
      operario: dto.operarioId
        ? { connect: { id: dto.operarioId } }
        : undefined,
      tipo: dto.tipo,
      cantidad: dto.cantidad,
      fecha: dto.fecha ? new Date(dto.fecha) : undefined,
      observaciones: dto.observaciones,
    });
  }

  findAll(itemId?: string): Promise<Movimiento[]> {
    return this.movimientosRepository.findAll(itemId ? { itemId } : undefined);
  }

  async findOne(id: string): Promise<Movimiento> {
    const movimiento = await this.movimientosRepository.findById(id);
    if (!movimiento) {
      throw new NotFoundException(`Movimiento ${id} no encontrado`);
    }
    return movimiento;
  }
}
