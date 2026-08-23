import { Categoria, Unidad } from '@prisma/client';

export class ResumenStockItemEntity {
  itemId!: string;

  codigo!: string;

  /// Agrupador opcional (ej. "Hilo") — null si el item no pertenece a ninguno.
  grupo!: string | null;

  /// Nombre base sin el color (ej. "Corderoy") — para agrupar en el frontend.
  nombreBase!: string;

  /// Color de esta variante, o null si el item no tiene color.
  colorNombre!: string | null;

  /// Nombre + color combinados para mostrar (ej. "Corderoy Rosa") — se
  /// mantiene por compatibilidad con lo que ya consume el bot de WhatsApp.
  nombre!: string;

  categoria!: Categoria;

  unidad!: Unidad;

  stock!: number;

  stockMinimo!: number | null;

  bajoMinimo!: boolean;
}
