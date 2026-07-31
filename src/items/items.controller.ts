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
import { Item } from '@prisma/client';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemEntity } from './entities/item.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un item del catálogo (material o producto)' })
  @ApiResponse({ status: 201, type: ItemEntity })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateItemDto,
  ): Promise<Item> {
    return this.itemsService.create(user.negocioId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar items, con filtro opcional por activo' })
  @ApiResponse({ status: 200, type: [ItemEntity] })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('activo') activo?: string,
  ): Promise<Item[]> {
    const filtro = activo === undefined ? undefined : activo === 'true';
    return this.itemsService.findAll(user.negocioId, filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un item por id' })
  @ApiResponse({ status: 200, type: ItemEntity })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Item> {
    return this.itemsService.findOne(user.negocioId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente un item' })
  @ApiResponse({ status: 200, type: ItemEntity })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ): Promise<Item> {
    return this.itemsService.update(user.negocioId, id, dto);
  }
}
