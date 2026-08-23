import { Categoria, MovimientoTipo, Unidad } from '@prisma/client';

export enum FlowStep {
  MENU = 'MENU',
  SELECCION_ITEM_GRUPO = 'SELECCION_ITEM_GRUPO',
  SELECCION_ITEM_NOMBRE = 'SELECCION_ITEM_NOMBRE',
  SELECCION_ITEM_COLOR = 'SELECCION_ITEM_COLOR',
  COMPRA_CANTIDAD = 'COMPRA_CANTIDAD',
  ENTREGA_OPERARIO = 'ENTREGA_OPERARIO',
  ENTREGA_CANTIDAD = 'ENTREGA_CANTIDAD',
  RECEPCION_OPERARIO = 'RECEPCION_OPERARIO',
  RECEPCION_ORDEN = 'RECEPCION_ORDEN',
  RECEPCION_CANTIDAD = 'RECEPCION_CANTIDAD',
  VENTA_CANTIDAD = 'VENTA_CANTIDAD',
  AJUSTE_CANTIDAD = 'AJUSTE_CANTIDAD',
  STOCK_CATEGORIA = 'STOCK_CATEGORIA',
  NUEVA_OPERARIA_NOMBRE = 'NUEVA_OPERARIA_NOMBRE',
  NUEVO_ITEM_CATEGORIA = 'NUEVO_ITEM_CATEGORIA',
  NUEVO_ITEM_UNIDAD = 'NUEVO_ITEM_UNIDAD',
  NUEVO_ITEM_NOMBRE = 'NUEVO_ITEM_NOMBRE',
  NUEVO_ITEM_GRUPO = 'NUEVO_ITEM_GRUPO',
  NUEVO_ITEM_TIENE_COLOR = 'NUEVO_ITEM_TIENE_COLOR',
  NUEVO_ITEM_COLOR = 'NUEVO_ITEM_COLOR',
  CONFIRMAR = 'CONFIRMAR',
}

export interface OpcionListado {
  id: string | null;
  etiqueta: string;
}

export interface ContextoSeleccionItem {
  categoria?: Categoria;
  /// Grupo elegido en el paso SELECCION_ITEM_GRUPO (si hubo uno) — acota la
  /// búsqueda de nombres para no cruzar items de otro grupo con el mismo nombre.
  grupo?: string | null;
  siguienteStep: FlowStep;
}

export interface MovimientoPayload {
  itemId: string;
  tipo: MovimientoTipo;
  cantidad: number;
  operarioId?: string;
  ordenProduccionId?: string;
}

export interface AccionMovimientoPendiente {
  tipoAccion: 'MOVIMIENTO';
  payload: MovimientoPayload;
  etiquetaItem: string;
  crearOrdenParaOperario?: string;
  mensajeExtra?: string;
}

export interface AccionOperariaPendiente {
  tipoAccion: 'OPERARIA';
  nombre: string;
}

export interface AccionItemPendiente {
  tipoAccion: 'ITEM';
  grupo: string | null;
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  colorNombre: string | null;
}

export type AccionPendiente =
  AccionMovimientoPendiente | AccionOperariaPendiente | AccionItemPendiente;

export interface WhatsappSession {
  step: FlowStep;
  opciones: OpcionListado[];
  itemId?: string;
  operarioId?: string;
  ordenProduccionId?: string | null;
  contextoItem?: ContextoSeleccionItem;
  nuevoItemCategoria?: Categoria;
  nuevoItemUnidad?: Unidad;
  nuevoItemNombre?: string;
  nuevoItemGrupo?: string | null;
  accionPendiente?: AccionPendiente;
}

export function nuevaSesion(): WhatsappSession {
  return { step: FlowStep.MENU, opciones: [] };
}
