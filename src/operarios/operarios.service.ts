import { Injectable, NotFoundException } from '@nestjs/common';
import { Operario } from '@prisma/client';
import { OperariosRepository } from './operarios.repository';
import { CreateOperarioDto } from './dto/create-operario.dto';
import { UpdateOperarioDto } from './dto/update-operario.dto';

@Injectable()
export class OperariosService {
  constructor(private readonly operariosRepository: OperariosRepository) {}

  create(dto: CreateOperarioDto): Promise<Operario> {
    return this.operariosRepository.create({ nombre: dto.nombre });
  }

  findAll(activo?: boolean): Promise<Operario[]> {
    return this.operariosRepository.findAll(
      activo === undefined ? undefined : { activo },
    );
  }

  async findOne(id: string): Promise<Operario> {
    const operario = await this.operariosRepository.findById(id);
    if (!operario) {
      throw new NotFoundException(`Operario ${id} no encontrado`);
    }
    return operario;
  }

  async update(id: string, dto: UpdateOperarioDto): Promise<Operario> {
    await this.findOne(id);
    return this.operariosRepository.update(id, dto);
  }
}
