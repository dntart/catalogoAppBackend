import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrdenProduccion } from '@prisma/client';
import { OrdenesProduccionService } from './ordenes-produccion.service';
import { CreateOrdenProduccionDto } from './dto/create-orden-produccion.dto';
import {
  OrdenProduccionEntity,
  ResumenItemEntity,
} from './entities/orden-produccion.entity';

@ApiTags('ordenes-produccion')
@ApiBearerAuth()
@Controller('ordenes-produccion')
export class OrdenesProduccionController {
  constructor(
    private readonly ordenesProduccionService: OrdenesProduccionService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Abrir una orden de producción (entrega de material a un operario)',
    description:
      'Agrupa los movimientos de CONSUMO (material entregado) y PRODUCCION (producto terminado) de una misma entrega, para poder trazar qué salió y qué volvió.',
  })
  @ApiResponse({ status: 201, type: OrdenProduccionEntity })
  create(@Body() dto: CreateOrdenProduccionDto): Promise<OrdenProduccion> {
    return this.ordenesProduccionService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar órdenes de producción, con filtro opcional por operario',
  })
  @ApiResponse({ status: 200, type: [OrdenProduccionEntity] })
  findAll(
    @Query('operarioId') operarioId?: string,
  ): Promise<OrdenProduccion[]> {
    return this.ordenesProduccionService.findAll(operarioId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una orden de producción con sus movimientos',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordenesProduccionService.findOne(id);
  }

  @Get(':id/resumen')
  @ApiOperation({
    summary:
      'Resumen agregado: total consumido/producido por item dentro de la orden',
  })
  @ApiResponse({ status: 200, type: [ResumenItemEntity] })
  getResumen(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResumenItemEntity[]> {
    return this.ordenesProduccionService.getResumen(id);
  }
}
