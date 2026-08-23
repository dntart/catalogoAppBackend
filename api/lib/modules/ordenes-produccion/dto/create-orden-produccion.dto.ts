import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrdenProduccionDto {
  @IsUUID()
  operarioId!: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
