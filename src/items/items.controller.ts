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
import { Item } from '@prisma/client';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemEntity } from './entities/item.entity';

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un item del catálogo (material o producto)' })
  @ApiResponse({ status: 201, type: ItemEntity })
  create(@Body() dto: CreateItemDto): Promise<Item> {
    return this.itemsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar items, con filtro opcional por activo' })
  @ApiResponse({ status: 200, type: [ItemEntity] })
  findAll(@Query('activo') activo?: string): Promise<Item[]> {
    const filtro = activo === undefined ? undefined : activo === 'true';
    return this.itemsService.findAll(filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un item por id' })
  @ApiResponse({ status: 200, type: ItemEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Item> {
    return this.itemsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente un item' })
  @ApiResponse({ status: 200, type: ItemEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ): Promise<Item> {
    return this.itemsService.update(id, dto);
  }
}
