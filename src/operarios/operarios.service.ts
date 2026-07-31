import { Injectable, NotFoundException } from '@nestjs/common';
import { Operario } from '@prisma/client';
import { OperariosRepository } from './operarios.repository';
import { CreateOperarioDto } from './dto/create-operario.dto';
import { UpdateOperarioDto } from './dto/update-operario.dto';

@Injectable()
export class OperariosService {
  constructor(private readonly operariosRepository: OperariosRepository) {}

  create(negocioId: string, dto: CreateOperarioDto): Promise<Operario> {
    return this.operariosRepository.create(negocioId, { nombre: dto.nombre });
  }

  findAll(negocioId: string, activo?: boolean): Promise<Operario[]> {
    return this.operariosRepository.findAll(
      negocioId,
      activo === undefined ? undefined : { activo },
    );
  }

  async findOne(negocioId: string, id: string): Promise<Operario> {
    const operario = await this.operariosRepository.findById(negocioId, id);
    if (!operario) {
      throw new NotFoundException(`Operario ${id} no encontrado`);
    }
    return operario;
  }

  async update(
    negocioId: string,
    id: string,
    dto: UpdateOperarioDto,
  ): Promise<Operario> {
    await this.findOne(negocioId, id);
    return this.operariosRepository.update(id, dto);
  }
}
