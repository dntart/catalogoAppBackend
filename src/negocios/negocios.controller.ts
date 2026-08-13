import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from '../admin/admin.service';
import { CreateNegocioDto } from '../admin/dto/create-negocio.dto';
import { NegocioEntity } from '../admin/entities/negocio.entity';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('negocios')
@Controller('negocios')
export class NegociosController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('registro')
  @ApiOperation({
    summary: 'Alta self-service de un negocio nuevo (sin autenticación)',
    description:
      'Cualquiera puede crear su propio Negocio + usuario dueño. Es el camino recomendado; POST /admin/negocios queda como alta manual para cuando el cliente no puede hacerlo por su cuenta.',
  })
  @ApiResponse({ status: 201, type: NegocioEntity })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un usuario con ese email',
  })
  registrar(@Body() dto: CreateNegocioDto): Promise<NegocioEntity> {
    return this.adminService.crearNegocio(dto);
  }
}
