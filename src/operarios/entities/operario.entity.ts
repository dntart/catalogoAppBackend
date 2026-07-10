import { ApiProperty } from '@nestjs/swagger';

export class OperarioEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
