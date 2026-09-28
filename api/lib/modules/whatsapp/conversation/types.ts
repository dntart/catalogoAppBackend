import { Categoria, MovimientoTipo, Unidad } from '@prisma/client';

export enum FlowStep {
  MENU = 'MENU',
  SELECCION_ITEM_GRUPO = 'SELECCION_ITEM_GRUPO',
  SELECCION_ITEM_NOMBRE = 'SELECCION_ITEM_NOMBRE',
  SELECCION_ITEM_COLOR = 'SELECCION_ITEM_COLOR',
  COMPRA_CANTIDAD = 'COMPRA_CANTIDAD',
  COMPRA_PRECIO = 'COMPRA_PRECIO',
  ORDEN_MENU = 'ORDEN_MENU',
  ORDEN_SELECCION_ABIERTA = 'ORDEN_SELECCION_ABIERTA',
  ORDEN_AGREGAR_CANTIDAD = 'ORDEN_AGREGAR_CANTIDAD',
  ENTREGA_OPERARIO = 'ENTREGA_OPERARIO',
  ENTREGA_CANTIDAD = 'ENTREGA_CANTIDAD',
  RECEPCION_OPERARIO = 'RECEPCION_OPERARIO',
  RECEPCION_ORDEN = 'RECEPCION_ORDEN',
  RECEPCION_CANTIDAD = 'RECEPCION_CANTIDAD',
  VENTA_CANTIDAD = 'VENTA_CANTIDAD',
  VENTA_PRECIO = 'VENTA_PRECIO',
  AJUSTE_CANTIDAD = 'AJUSTE_CANTIDAD',
  STOCK_CATEGORIA = 'STOCK_CATEGORIA',
  REPORTE_MENU = 'REPORTE_MENU',
  REPORTE_OPERARIA_SELECCION = 'REPORTE_OPERARIA_SELECCION',
  CATALOGO_MENU = 'CATALOGO_MENU',
  NUEVA_OPERARIA_NOMBRE = 'NUEVA_OPERARIA_NOMBRE',
  NUEVO_ITEM_UNIDAD = 'NUEVO_ITEM_UNIDAD',
  NUEVO_ITEM_NOMBRE = 'NUEVO_ITEM_NOMBRE',
  NUEVO_ITEM_TIENE_GRUPO = 'NUEVO_ITEM_TIENE_GRUPO',
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
  montoTotal?: number;
  operarioId?: string;
  ordenProduccionId?: string;
}

/// Datos de un item que todavía no existe y hay que crear antes de poder
/// registrar el movimiento (compra de un material nuevo, recepción de un
/// producto nuevo).
export interface ItemNuevoPayload {
  grupo: string | null;
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  colorNombre: string | null;
}

/// Un solo tipo de acción pendiente para todo movimiento — puede llevar
/// pegada la creación del item y/o de la operaria si todavía no existían,
/// para poder confirmar todo junto con un solo sí/no.
export interface AccionMovimientoPendiente {
  tipoAccion: 'MOVIMIENTO';
  itemId?: string;
  itemNuevo?: ItemNuevoPayload;
  operarioId?: string;
  operariaNuevaNombre?: string;
  /// true en "entrega a operaria": siempre genera una orden de producción
  /// nueva vinculada al operarioId ya resuelto (existente o recién creado).
  crearOrdenParaOperario?: boolean;
  movimiento: {
    tipo: MovimientoTipo;
    cantidad: number;
    montoTotal?: number;
    ordenProduccionId?: string;
  };
  etiquetaItem: string;
  mensajeExtra?: string;
}

export type AccionPendiente = AccionMovimientoPendiente;

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
  nuevoItemColorNombre?: string | null;
  /// A qué flujo volver después de pedir el nombre de una operaria nueva
  /// (elegida con el sentinel "cargar operaria nueva" desde pedirOperario).
  operarioParaFlujo?: 'ENTREGA' | 'RECEPCION';
  nuevaOperariaNombrePendiente?: string;
  /// Cantidad ya confirmada, mientras se pregunta el precio total opcional
  /// (paso intermedio entre cantidad y confirmación en Compra/Venta).
  cantidadPendiente?: number;
  /// Item elegido para agregarle un reporte por operaria, o para "agregar
  /// material a una orden abierta" — reusa `opciones` para listar, este
  /// campo guarda el operarioId de la orden abierta seleccionada.
  reporteOperarioId?: string;
  accionPendiente?: AccionPendiente;
}

export function nuevaSesion(): WhatsappSession {
  return { step: FlowStep.MENU, opciones: [] };
}
