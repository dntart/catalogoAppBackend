export enum FlowStep {
  MENU = 'MENU',
  COMPRA_ITEM = 'COMPRA_ITEM',
  COMPRA_CANTIDAD = 'COMPRA_CANTIDAD',
  ENTREGA_OPERARIO = 'ENTREGA_OPERARIO',
  ENTREGA_ITEM = 'ENTREGA_ITEM',
  ENTREGA_CANTIDAD = 'ENTREGA_CANTIDAD',
  RECEPCION_OPERARIO = 'RECEPCION_OPERARIO',
  RECEPCION_ORDEN = 'RECEPCION_ORDEN',
  RECEPCION_ITEM = 'RECEPCION_ITEM',
  RECEPCION_CANTIDAD = 'RECEPCION_CANTIDAD',
  VENTA_ITEM = 'VENTA_ITEM',
  VENTA_CANTIDAD = 'VENTA_CANTIDAD',
  AJUSTE_ITEM = 'AJUSTE_ITEM',
  AJUSTE_CANTIDAD = 'AJUSTE_CANTIDAD',
  STOCK_CATEGORIA = 'STOCK_CATEGORIA',
}

export interface OpcionListado {
  id: string | null;
  etiqueta: string;
}

export interface WhatsappSession {
  step: FlowStep;
  opciones: OpcionListado[];
  itemId?: string;
  operarioId?: string;
  ordenProduccionId?: string | null;
}

export function nuevaSesion(): WhatsappSession {
  return { step: FlowStep.MENU, opciones: [] };
}
