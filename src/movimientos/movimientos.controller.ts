import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Movimiento } from '@prisma/client';
import { MovimientosService } from './movimientos.service';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { MovimientoEntity } from './entities/movimiento.entity';

@ApiTags('movimientos')
@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Post()
  @ApiOperation({
    summary:
      'Registrar un movimiento (compra, consumo, producción, venta o ajuste)',
    description:
      'Único punto de entrada que afecta el stock. Valida existencia de item/operario, signo de cantidad según el tipo, y que no deje stock negativo en CONSUMO/VENTA.',
  })
  @ApiResponse({ status: 201, type: MovimientoEntity })
  @ApiResponse({
    status: 400,
    description: 'Cantidad inválida o stock insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Item u operario no encontrado' })
  create(@Body() dto: CreateMovimientoDto): Promise<Movimiento> {
    return this.movimientosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar movimientos, con filtro opcional por item' })
  @ApiResponse({ status: 200, type: [MovimientoEntity] })
  findAll(@Query('itemId') itemId?: string): Promise<Movimiento[]> {
    return this.movimientosService.findAll(itemId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un movimiento por id' })
  @ApiResponse({ status: 200, type: MovimientoEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Movimiento> {
    return this.movimientosService.findOne(id);
  }
}
