import { MovimientoTipo } from '@prisma/client';

export class MovimientoEntity {
  id!: string;

  itemId!: string;

  operarioId!: string | null;

  ordenProduccionId!: string | null;

  tipo!: MovimientoTipo;

  cantidad!: string;

  fecha!: Date;

  observaciones!: string | null;

  createdAt!: Date;
}
