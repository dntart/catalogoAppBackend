import { Module } from '@nestjs/common';
import { OperariosController } from './operarios.controller';
import { OperariosService } from './operarios.service';
import { OperariosRepository } from './operarios.repository';

@Module({
  controllers: [OperariosController],
  providers: [OperariosService, OperariosRepository],
  exports: [OperariosService],
})
export class OperariosModule {}
