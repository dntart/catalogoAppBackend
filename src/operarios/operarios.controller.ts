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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Operario } from '@prisma/client';
import { OperariosService } from './operarios.service';
import { CreateOperarioDto } from './dto/create-operario.dto';
import { UpdateOperarioDto } from './dto/update-operario.dto';
import { OperarioEntity } from './entities/operario.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('operarios')
@ApiBearerAuth()
@Controller('operarios')
export class OperariosController {
  constructor(private readonly operariosService: OperariosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un operario' })
  @ApiResponse({ status: 201, type: OperarioEntity })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOperarioDto,
  ): Promise<Operario> {
    return this.operariosService.create(user.negocioId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar operarios, con filtro opcional por activo' })
  @ApiResponse({ status: 200, type: [OperarioEntity] })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('activo') activo?: string,
  ): Promise<Operario[]> {
    const filtro = activo === undefined ? undefined : activo === 'true';
    return this.operariosService.findAll(user.negocioId, filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un operario por id' })
  @ApiResponse({ status: 200, type: OperarioEntity })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Operario> {
    return this.operariosService.findOne(user.negocioId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente un operario' })
  @ApiResponse({ status: 200, type: OperarioEntity })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperarioDto,
  ): Promise<Operario> {
    return this.operariosService.update(user.negocioId, id, dto);
  }
}
