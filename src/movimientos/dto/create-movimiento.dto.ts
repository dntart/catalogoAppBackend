import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: '9c3f1e2a-...' })
  @IsUUID()
  itemId!: string;

  @ApiPropertyOptional({
    example: '5a2b8c1d-...',
    description:
      'Opcional: no todo movimiento tiene un operario asociado (ej. una compra a proveedor)',
  })
  @IsOptional()
  @IsUUID()
  operarioId?: string;

  @ApiProperty({ enum: MovimientoTipo })
  @IsEnum(MovimientoTipo)
  tipo!: MovimientoTipo;

  @ApiProperty({
    example: 10,
    description: 'Debe ser > 0 salvo en AJUSTE, donde puede ser negativa',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @NotEquals(0)
  cantidad!: number;

  @ApiPropertyOptional({ example: '2026-07-09T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiPropertyOptional({ example: 'Compra a proveedor Textiles SA' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
