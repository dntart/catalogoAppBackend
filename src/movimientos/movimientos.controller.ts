import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Movimiento } from '@prisma/client';
import { MovimientosService } from './movimientos.service';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';

@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Post()
  create(@Body() dto: CreateMovimientoDto): Promise<Movimiento> {
    return this.movimientosService.create(dto);
  }

  @Get()
  findAll(@Query('itemId') itemId?: string): Promise<Movimiento[]> {
    return this.movimientosService.findAll(itemId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Movimiento> {
    return this.movimientosService.findOne(id);
  }
}
