import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Operario } from '@prisma/client';
import { OperariosService } from './operarios.service';
import { CreateOperarioDto } from './dto/create-operario.dto';
import { UpdateOperarioDto } from './dto/update-operario.dto';
import { OperarioEntity } from './entities/operario.entity';

@ApiTags('operarios')
@Controller('operarios')
export class OperariosController {
  constructor(private readonly operariosService: OperariosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un operario' })
  @ApiResponse({ status: 201, type: OperarioEntity })
  create(@Body() dto: CreateOperarioDto): Promise<Operario> {
    return this.operariosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar operarios, con filtro opcional por activo' })
  @ApiResponse({ status: 200, type: [OperarioEntity] })
  findAll(@Query('activo') activo?: string): Promise<Operario[]> {
    const filtro = activo === undefined ? undefined : activo === 'true';
    return this.operariosService.findAll(filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un operario por id' })
  @ApiResponse({ status: 200, type: OperarioEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Operario> {
    return this.operariosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente un operario' })
  @ApiResponse({ status: 200, type: OperarioEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperarioDto,
  ): Promise<Operario> {
    return this.operariosService.update(id, dto);
  }
}
