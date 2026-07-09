import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateOperarioDto } from './create-operario.dto';

export class UpdateOperarioDto extends PartialType(CreateOperarioDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
