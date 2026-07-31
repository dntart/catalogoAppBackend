import { ApiProperty } from '@nestjs/swagger';

export class NegocioEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({
    description: 'Id del usuario dueño creado junto con el negocio',
  })
  ownerUserId!: string;
}
