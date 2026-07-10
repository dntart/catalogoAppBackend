import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovimientoTipo } from '@prisma/client';

export class MovimientoEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  operarioId!: string | null;

  @ApiProperty({ enum: MovimientoTipo })
  tipo!: MovimientoTipo;

  @ApiProperty({
    example: '10.00',
    description: 'Decimal serializado como string en la respuesta JSON',
  })
  cantidad!: string;

  @ApiProperty()
  fecha!: Date;

  @ApiPropertyOptional({ nullable: true })
  observaciones!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
