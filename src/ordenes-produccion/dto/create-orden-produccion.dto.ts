import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrdenProduccionDto {
  @ApiProperty({ example: '5a2b8c1d-...' })
  @IsUUID()
  operarioId!: string;

  @ApiPropertyOptional({ example: 'Entrega de gabardina beige para 10 Zorros' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
