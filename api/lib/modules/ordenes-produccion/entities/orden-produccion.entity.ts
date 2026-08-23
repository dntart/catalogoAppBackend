
export class OrdenProduccionEntity {
  id!: string;

  operarioId!: string;

  fecha!: Date;

  observaciones!: string | null;

  createdAt!: Date;
}

export class ResumenItemEntity {
  itemId!: string;

  itemNombre!: string;

  tipo!: string;

  totalCantidad!: string;
}
