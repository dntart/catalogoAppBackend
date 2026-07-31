import { Injectable, NotFoundException } from '@nestjs/common';
import { Item } from '@prisma/client';
import { ItemsRepository } from './items.repository';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly itemsRepository: ItemsRepository) {}

  create(negocioId: string, dto: CreateItemDto): Promise<Item> {
    return this.itemsRepository.create(negocioId, {
      nombre: dto.nombre,
      categoria: dto.categoria,
      unidad: dto.unidad,
      tieneColor: dto.tieneColor,
      colorNombre: dto.tieneColor ? (dto.colorNombre ?? null) : null,
      imagenUrl: dto.imagenUrl,
      stockMinimo: dto.stockMinimo,
    });
  }

  findAll(negocioId: string, activo?: boolean): Promise<Item[]> {
    return this.itemsRepository.findAll(
      negocioId,
      activo === undefined ? undefined : { activo },
    );
  }

  async findOne(negocioId: string, id: string): Promise<Item> {
    const item = await this.itemsRepository.findById(negocioId, id);
    if (!item) {
      throw new NotFoundException(`Item ${id} no encontrado`);
    }
    return item;
  }

  async update(
    negocioId: string,
    id: string,
    dto: UpdateItemDto,
  ): Promise<Item> {
    await this.findOne(negocioId, id);
    return this.itemsRepository.update(id, dto);
  }
}
