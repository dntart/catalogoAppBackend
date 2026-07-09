import { Injectable, NotFoundException } from '@nestjs/common';
import { Item } from '@prisma/client';
import { ItemsRepository } from './items.repository';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly itemsRepository: ItemsRepository) {}

  create(dto: CreateItemDto): Promise<Item> {
    return this.itemsRepository.create({
      nombre: dto.nombre,
      categoria: dto.categoria,
      unidad: dto.unidad,
      tieneColor: dto.tieneColor,
      colorNombre: dto.tieneColor ? (dto.colorNombre ?? null) : null,
      imagenUrl: dto.imagenUrl,
    });
  }

  findAll(activo?: boolean): Promise<Item[]> {
    return this.itemsRepository.findAll(
      activo === undefined ? undefined : { activo },
    );
  }

  async findOne(id: string): Promise<Item> {
    const item = await this.itemsRepository.findById(id);
    if (!item) {
      throw new NotFoundException(`Item ${id} no encontrado`);
    }
    return item;
  }

  async update(id: string, dto: UpdateItemDto): Promise<Item> {
    await this.findOne(id);
    return this.itemsRepository.update(id, dto);
  }
}
