import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { NegocioEntity } from './entities/negocio.entity';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('negocios')
  @ApiOperation({
    summary:
      'Dar de alta un negocio nuevo con su usuario dueño (solo super-admin)',
    description:
      'Crea el Negocio y el User dueño en un solo paso. Pensado para altas manuales por el fundador del SaaS, no es un registro self-service.',
  })
  @ApiResponse({ status: 201, type: NegocioEntity })
  @ApiResponse({
    status: 403,
    description: 'El usuario autenticado no es super-admin',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un usuario con ese email',
  })
  crearNegocio(@Body() dto: CreateNegocioDto): Promise<NegocioEntity> {
    return this.adminService.crearNegocio(dto);
  }
}
