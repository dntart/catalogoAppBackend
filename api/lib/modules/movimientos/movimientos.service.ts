import { BadRequestError as BadRequestException, NotFoundError as NotFoundException } from '../../auth';
import { Movimiento, MovimientoTipo } from '@prisma/client';
import {
  MovimientosRepository,
  MovimientoConRelaciones,
} from './movimientos.repository';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { StockService } from '../stock/stock.service';
import { ItemsService } from '../items/items.service';
import { OperariosService } from '../operarios/operarios.service';
import { OrdenesProduccionService } from '../ordenes-produccion/ordenes-produccion.service';

const TIPOS_SALIDA: MovimientoTipo[] = [
  MovimientoTipo.CONSUMO,
  MovimientoTipo.VENTA,
];

export class MovimientosService {
  constructor(
    private readonly movimientosRepository: MovimientosRepository,
    private readonly stockService: StockService,
    private readonly itemsService: ItemsService,
    private readonly operariosService: OperariosService,
    private readonly ordenesProduccionService: OrdenesProduccionService,
  ) {}

  async create(
    negocioId: string,
    dto: CreateMovimientoDto,
  ): Promise<Movimiento> {
    await this.itemsService.findOne(negocioId, dto.itemId);

    let operarioId = dto.operarioId;
    if (dto.ordenProduccionId) {
      const orden = await this.ordenesProduccionService.findOne(
        negocioId,
        dto.ordenProduccionId,
      );
      operarioId = orden.operarioId;
    } else if (operarioId) {
      await this.operariosService.findOne(negocioId, operarioId);
    }

    if (dto.tipo !== MovimientoTipo.AJUSTE && dto.cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser mayor a cero para este tipo de movimiento',
      );
    }

    if (TIPOS_SALIDA.includes(dto.tipo)) {
      await this.stockService.validarStockSuficiente(
        negocioId,
        dto.itemId,
        dto.cantidad,
      );
    }

    return this.movimientosRepository.create(negocioId, {
      item: { connect: { id: dto.itemId } },
      operario: operarioId ? { connect: { id: operarioId } } : undefined,
      ordenProduccion: dto.ordenProduccionId
        ? { connect: { id: dto.ordenProduccionId } }
        : undefined,
      tipo: dto.tipo,
      cantidad: dto.cantidad,
      montoTotal: dto.montoTotal,
      fecha: dto.fecha ? new Date(dto.fecha) : undefined,
      observaciones: dto.observaciones,
    });
  }

  findAll(
    negocioId: string,
    itemId?: string,
  ): Promise<MovimientoConRelaciones[]> {
    return this.movimientosRepository.findAll(
      negocioId,
      itemId ? { itemId } : undefined,
    );
  }

  /// Para reportes: movimientos de un tipo dado, opcionalmente acotados a un
  /// rango de fechas (ya calculado en huso horario del negocio, ver
  /// fechas.ts) — sin rango, trae todo el histórico de ese tipo.
  buscarPorTipo(
    negocioId: string,
    filtro: { tipo?: MovimientoTipo; desde?: Date; hasta?: Date },
  ): Promise<MovimientoConRelaciones[]> {
    return this.movimientosRepository.findAll(negocioId, {
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.desde && filtro.hasta
        ? { fecha: { gte: filtro.desde, lt: filtro.hasta } }
        : {}),
    });
  }

  async findOne(
    negocioId: string,
    id: string,
  ): Promise<MovimientoConRelaciones> {
    const movimiento = await this.movimientosRepository.findById(negocioId, id);
    if (!movimiento) {
      throw new NotFoundException(`Movimiento ${id} no encontrado`);
    }
    return movimiento;
  }
}
