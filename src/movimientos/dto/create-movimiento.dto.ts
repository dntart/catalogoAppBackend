import { MovimientoTipo } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  NotEquals,
} from 'class-validator';

export class CreateMovimientoDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  operarioId?: string;

  @IsEnum(MovimientoTipo)
  tipo!: MovimientoTipo;

  @IsNumber({ maxDecimalPlaces: 2 })
  @NotEquals(0)
  cantidad!: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
