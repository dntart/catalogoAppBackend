import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { NegociosController } from './negocios.controller';

@Module({
  imports: [AdminModule],
  controllers: [NegociosController],
})
export class NegociosModule {}
