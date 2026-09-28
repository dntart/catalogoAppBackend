import { MovimientoTipo } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
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

  @IsOptional()
  @IsUUID()
  ordenProduccionId?: string;

  @IsEnum(MovimientoTipo)
  tipo!: MovimientoTipo;

  @IsNumber({ maxDecimalPlaces: 2 })
  @NotEquals(0)
  cantidad!: number;

  /// Precio total pagado/cobrado — tiene sentido en COMPRA y VENTA, opcional
  /// en el resto. No se valida el tipo acá porque es una decisión de UX del
  /// bot/panel (preguntarlo o no), no una regla de integridad de datos.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoTotal?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
