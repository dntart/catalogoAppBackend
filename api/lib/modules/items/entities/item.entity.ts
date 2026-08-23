import { Categoria, Unidad } from '@prisma/client';

export class ItemEntity {
  id!: string;

  codigo!: string;

  nombre!: string;

  categoria!: Categoria;

  unidad!: Unidad;

  tieneColor!: boolean;

  colorNombre!: string | null;

  imagenUrl!: string | null;

  stockMinimo!: string | null;

  activo!: boolean;

  createdAt!: Date;
}
