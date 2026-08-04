export type Categoria = 'MATERIAL' | 'PRODUCTO';
export type Unidad = 'METRO' | 'KG' | 'CONO' | 'UNIDAD';
export type MovimientoTipo = 'COMPRA' | 'CONSUMO' | 'PRODUCCION' | 'VENTA' | 'AJUSTE';

export interface Item {
  id: string;
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  tieneColor: boolean;
  colorNombre: string | null;
  imagenUrl: string | null;
  activo: boolean;
  createdAt: string;
}

export interface Operario {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
}

export interface OrdenProduccion {
  id: string;
  operarioId: string;
  fecha: string;
  observaciones: string | null;
  createdAt: string;
}

export interface Movimiento {
  id: string;
  itemId: string;
  operarioId: string | null;
  ordenProduccionId: string | null;
  tipo: MovimientoTipo;
  cantidad: string;
  fecha: string;
  observaciones: string | null;
  createdAt: string;
  item?: Item;
  operario?: Operario | null;
}

export interface ResumenStockItem {
  itemId: string;
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  stock: number;
  stockMinimo: number | null;
  bajoMinimo: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
}
