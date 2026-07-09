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
import { Operario } from '@prisma/client';
import { OperariosService } from './operarios.service';
import { CreateOperarioDto } from './dto/create-operario.dto';
import { UpdateOperarioDto } from './dto/update-operario.dto';

@Controller('operarios')
export class OperariosController {
  constructor(private readonly operariosService: OperariosService) {}

  @Post()
  create(@Body() dto: CreateOperarioDto): Promise<Operario> {
    return this.operariosService.create(dto);
  }

  @Get()
  findAll(@Query('activo') activo?: string): Promise<Operario[]> {
    const filtro = activo === undefined ? undefined : activo === 'true';
    return this.operariosService.findAll(filtro);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Operario> {
    return this.operariosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperarioDto,
  ): Promise<Operario> {
    return this.operariosService.update(id, dto);
  }
}
