export type Categoria = 'MATERIAL' | 'PRODUCTO';
export type Unidad = 'METRO' | 'KG' | 'CONO' | 'UNIDAD';
export type MovimientoTipo = 'COMPRA' | 'CONSUMO' | 'PRODUCCION' | 'VENTA' | 'AJUSTE';

export interface Item {
  id: string;
  codigo: string;
  grupo: string | null;
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
  codigo: string;
  grupo: string | null;
  nombreBase: string;
  colorNombre: string | null;
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
  negocioId: string;
  whatsappNumber: string | null;
  esSuperAdmin: boolean;
  activo: boolean;
  createdAt: string;
}

export interface UsuarioResumen {
  id: string;
  nombre: string;
  email: string;
  whatsappNumber: string | null;
  esSuperAdmin: boolean;
  activo: boolean;
}

export interface NegocioConUsuarios {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  usuarios: UsuarioResumen[];
}
