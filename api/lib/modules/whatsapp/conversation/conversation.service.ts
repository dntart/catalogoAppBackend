import {
  BadRequestError as BadRequestException,
  NotFoundError as NotFoundException,
  HttpError,
} from '../../../auth';
import {
  Categoria,
  Item,
  MovimientoTipo,
  OrdenProduccion,
  Unidad,
} from '@prisma/client';
import { SessionStoreService } from './session-store.service';
import {
  AccionMovimientoPendiente,
  AccionPendiente,
  FlowStep,
  ItemNuevoPayload,
  MovimientoPayload,
  OpcionListado,
  WhatsappSession,
  nuevaSesion,
} from './types';
import { ItemsService } from '../../items/items.service';
import { OperariosService } from '../../operarios/operarios.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { OrdenesProduccionService } from '../../ordenes-produccion/ordenes-produccion.service';
import { StockService } from '../../stock/stock.service';
import { parsePositiveNumber, parsePrice, pluralize } from './parsing';
import {
  fmtFechaCorta,
  fmtFechaLarga,
  fmtMesLargo,
  rangoHoy,
  rangoMesActual,
  rangoUltimosDias,
} from './fechas';

const MENSAJE_MENU = [
  '👋 *Textil Stock*',
  '¿Qué querés registrar? Respondé con el número:',
  '',
  '1️⃣ Compra de material',
  '2️⃣ Orden de producción',
  '3️⃣ Venta',
  '4️⃣ Ajuste de stock',
  '5️⃣ Ver stock',
  '6️⃣ Reportes',
  '7️⃣ Catálogo',
  '8️⃣ Ver últimos movimientos',
  '',
  '_Escribí "0" o "menu" en cualquier momento para volver acá._',
].join('\n');

/// Opciones "cargar nuevo ..." que se anteponen a las listas de selección en
/// los flujos donde tiene sentido crear algo sobre la marcha (compra,
/// entrega, recepción) — así el usuario no tiene que salir al menú principal
/// y volver a entrar para cargar un material/producto/operaria que todavía
/// no existe.
const SENTINEL_NUEVO_ITEM = '__nuevo_item__';
const SENTINEL_NUEVA_OPERARIA = '__nueva_operaria__';

const OPCIONES_ORDEN_MENU: OpcionListado[] = [
  { id: 'ABRIR', etiqueta: 'Abrir nueva orden' },
  { id: 'AGREGAR', etiqueta: 'Agregar material a una orden abierta' },
  { id: 'CERRAR', etiqueta: 'Cerrar una orden abierta' },
  { id: 'HISTORIAL', etiqueta: 'Ver historial de órdenes cerradas' },
];

const OPCIONES_REPORTE: OpcionListado[] = [
  { id: 'HOY', etiqueta: 'Hoy' },
  { id: 'SEMANA', etiqueta: 'Esta semana' },
  { id: 'MES', etiqueta: 'Este mes' },
  { id: 'OPERARIA', etiqueta: 'Por operaria' },
  { id: 'CONSUMO', etiqueta: 'Consumo de materiales' },
  { id: 'PROD_VS_VENTAS', etiqueta: 'Producción vs Ventas' },
  { id: 'STOCK_BAJO', etiqueta: 'Stock bajo' },
];

/// Pasos donde la respuesta es un número contra `session.opciones` (a
/// diferencia de cantidad/precio/nombre en texto libre, o sí/no) — acá es
/// donde tiene sentido detectar que la lista quedó vieja.
const PASOS_CON_LISTA_NUMERADA: FlowStep[] = [
  FlowStep.SELECCION_ITEM_GRUPO,
  FlowStep.SELECCION_ITEM_NOMBRE,
  FlowStep.SELECCION_ITEM_COLOR,
  FlowStep.ORDEN_MENU,
  FlowStep.ORDEN_SELECCION_ABIERTA,
  FlowStep.ENTREGA_OPERARIO,
  FlowStep.RECEPCION_OPERARIO,
  FlowStep.RECEPCION_ORDEN,
  FlowStep.REPORTE_MENU,
  FlowStep.REPORTE_OPERARIA_SELECCION,
  FlowStep.CATALOGO_MENU,
];

/// Si pasó demasiado tiempo desde que se mostró la lista vigente, no se
/// interpreta un número a ciegas — se lo trata como potencialmente una
/// respuesta a una lista anterior ya reemplazada (ej. el usuario scrollea
/// para arriba en WhatsApp y toca/responde algo viejo).
const UMBRAL_SESION_VIEJA_MS = 15 * 60 * 1000;

const OPCIONES_CATALOGO: OpcionListado[] = [
  { id: 'MATERIAL', etiqueta: 'Materiales' },
  { id: 'PRODUCTO', etiqueta: 'Productos' },
  { id: 'OPERARIA', etiqueta: 'Operarias' },
];

const UNIDADES: { opcion: string; valor: Unidad; etiqueta: string }[] = [
  { opcion: '1', valor: Unidad.METRO, etiqueta: 'Metro' },
  { opcion: '2', valor: Unidad.KG, etiqueta: 'Kg' },
  { opcion: '3', valor: Unidad.CONO, etiqueta: 'Cono' },
  { opcion: '4', valor: Unidad.UNIDAD, etiqueta: 'Unidad' },
];

const SIGNO_POR_TIPO: Partial<Record<MovimientoTipo, string>> = {
  [MovimientoTipo.CONSUMO]: '-',
  [MovimientoTipo.VENTA]: '-',
};

const UNIDAD_PLURAL: Record<Unidad, string> = {
  [Unidad.METRO]: 'metros',
  [Unidad.KG]: 'kg',
  [Unidad.CONO]: 'conos',
  [Unidad.UNIDAD]: 'unidades',
};

/// "10 metros" / "1 metro" — pluraliza de verdad en vez de repetir siempre
/// la forma singular del enum.
function etiquetaCantidadUnidad(cantidad: number, unidad: Unidad): string {
  const singular = unidad.toLowerCase();
  return pluralize(cantidad, singular, UNIDAD_PLURAL[unidad]);
}

function fmtMoney(monto: number): string {
  return `$${monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

function etiquetaItem(item: Item): string {
  const nombre = item.colorNombre
    ? `${item.nombre} ${item.colorNombre}`
    : item.nombre;
  return `${nombre} (${item.unidad.toLowerCase()})`;
}

function etiquetaItemNuevo(item: ItemNuevoPayload): string {
  return item.colorNombre ? `${item.nombre} ${item.colorNombre}` : item.nombre;
}

/** Junta los datos del item que se venía armando paso a paso (nombre, grupo,
 * unidad, color) en el payload que hay que crear antes de registrar el
 * movimiento — se usa cuando se eligió "cargar nuevo ..." dentro de compra
 * o recepción en vez de un item ya existente. */
function armarItemNuevoPendiente(
  session: WhatsappSession,
  categoria: Categoria,
): ItemNuevoPayload {
  return {
    grupo: session.nuevoItemGrupo ?? null,
    nombre: session.nuevoItemNombre!,
    categoria,
    unidad: session.nuevoItemUnidad!,
    colorNombre: session.nuevoItemColorNombre ?? null,
  };
}

function construirListado(opciones: OpcionListado[]): string {
  return opciones.map((op, i) => `${i + 1}. ${op.etiqueta}`).join('\n');
}

function parseSeleccion(
  texto: string,
  opciones: OpcionListado[],
): OpcionListado | undefined {
  const numero = Number(texto.trim());
  if (!Number.isInteger(numero) || numero < 1 || numero > opciones.length) {
    return undefined;
  }
  return opciones[numero - 1];
}

/// Cantidad de un movimiento: acepta negativos (los usa Ajuste), a
/// diferencia de parsePositiveNumber que exige > 0.
function parseCantidad(texto: string): number | null {
  const normalizado = texto.trim().replace(',', '.');
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero !== 0 ? numero : null;
}

function normalizarSiNo(texto: string): boolean | null {
  const t = texto.trim().toLowerCase();
  if (t === 'si' || t === 'sí') return true;
  if (t === 'no') return false;
  return null;
}

/** Reinicia el objeto de sesión EN EL LUGAR (mismas referencias que ya tienen
 * los handlers en curso) en vez de reemplazarlo — así el guardado único al
 * final de manejarMensaje() siempre persiste el estado correcto, sin
 * importar si algún handler intermedio "reinició" la conversación. */
function resetearSesion(session: WhatsappSession): void {
  const blank = nuevaSesion();
  const mutable = session as unknown as Record<string, unknown>;
  for (const key of Object.keys(session)) {
    delete mutable[key];
  }
  Object.assign(session, blank);
}

export class ConversationService {
  constructor(
    private readonly sessionStore: SessionStoreService,
    private readonly itemsService: ItemsService,
    private readonly operariosService: OperariosService,
    private readonly movimientosService: MovimientosService,
    private readonly ordenesProduccionService: OrdenesProduccionService,
    private readonly stockService: StockService,
  ) {}

  async manejarMensaje(
    negocioId: string,
    telefono: string,
    textoOriginal: string,
  ): Promise<string> {
    const texto = textoOriginal.trim();
    const comando = texto.toLowerCase();

    if (
      comando === 'menu' ||
      comando === 'cancelar' ||
      comando === 'hola' ||
      comando === '0'
    ) {
      await this.sessionStore.reiniciar(telefono);
      return MENSAJE_MENU;
    }

    const { session, actualizadoEn } = await this.sessionStore.obtenerConFecha(telefono);

    if (this.esRespuestaAListaVieja(session, texto, actualizadoEn)) {
      // Se re-guarda tal cual (sin cambiar step/opciones) solo para
      // refrescar actualizadoEn — si no, el próximo mensaje volvería a
      // pegar contra este mismo chequeo indefinidamente.
      await this.sessionStore.guardar(telefono, session);
      return `Pasó un rato desde tu último mensaje — esta sigue siendo la opción vigente:\n${construirListado(session.opciones)}\n\n_0️⃣ para volver al menú_`;
    }

    try {
      let respuesta: string;
      switch (session.step) {
        case FlowStep.MENU:
          respuesta = await this.manejarMenu(negocioId, telefono, texto, session);
          break;
        case FlowStep.SELECCION_ITEM_GRUPO:
          respuesta = await this.manejarSeleccionItemGrupo(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.SELECCION_ITEM_NOMBRE:
          respuesta = await this.manejarSeleccionItemNombre(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.SELECCION_ITEM_COLOR:
          respuesta = this.manejarSeleccionItemColor(telefono, texto, session);
          break;
        case FlowStep.COMPRA_CANTIDAD:
          respuesta = this.prepararCompra(negocioId, telefono, texto, session);
          break;
        case FlowStep.COMPRA_PRECIO:
          respuesta = await this.manejarCompraPrecio(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.ORDEN_MENU:
          respuesta = await this.manejarOrdenMenu(negocioId, telefono, texto, session);
          break;
        case FlowStep.ORDEN_SELECCION_ABIERTA:
          respuesta = await this.manejarOrdenSeleccionAbierta(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.ORDEN_AGREGAR_CANTIDAD:
          respuesta = await this.prepararOrdenAgregarMaterial(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.ENTREGA_OPERARIO:
          respuesta = await this.manejarEntregaOperario(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.ENTREGA_CANTIDAD:
          respuesta = await this.prepararEntrega(negocioId, telefono, texto, session);
          break;
        case FlowStep.RECEPCION_OPERARIO:
          respuesta = await this.manejarRecepcionOperario(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.RECEPCION_ORDEN:
          respuesta = await this.manejarRecepcionOrden(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.RECEPCION_CANTIDAD:
          respuesta = await this.prepararRecepcion(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.VENTA_CANTIDAD:
          respuesta = this.prepararVenta(negocioId, telefono, texto, session);
          break;
        case FlowStep.VENTA_PRECIO:
          respuesta = await this.manejarVentaPrecio(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.AJUSTE_CANTIDAD:
          respuesta = await this.prepararAjuste(negocioId, telefono, texto, session);
          break;
        case FlowStep.STOCK_CATEGORIA:
          respuesta = await this.finalizarStock(negocioId, telefono, texto, session);
          break;
        case FlowStep.REPORTE_MENU:
          respuesta = await this.manejarReporteMenu(negocioId, telefono, texto, session);
          break;
        case FlowStep.REPORTE_OPERARIA_SELECCION:
          respuesta = await this.manejarReporteOperariaSeleccion(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.CATALOGO_MENU:
          respuesta = await this.manejarCatalogoMenu(negocioId, telefono, texto, session);
          break;
        case FlowStep.NUEVA_OPERARIA_NOMBRE:
          respuesta = await this.manejarNuevaOperariaNombre(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        case FlowStep.NUEVO_ITEM_UNIDAD:
          respuesta = this.manejarNuevoItemUnidad(telefono, texto, session);
          break;
        case FlowStep.NUEVO_ITEM_NOMBRE:
          respuesta = this.manejarNuevoItemNombre(telefono, texto, session);
          break;
        case FlowStep.NUEVO_ITEM_TIENE_GRUPO:
          respuesta = this.manejarNuevoItemTieneGrupo(telefono, texto, session);
          break;
        case FlowStep.NUEVO_ITEM_GRUPO:
          respuesta = this.manejarNuevoItemGrupo(telefono, texto, session);
          break;
        case FlowStep.NUEVO_ITEM_TIENE_COLOR:
          respuesta = this.manejarNuevoItemTieneColor(telefono, texto, session);
          break;
        case FlowStep.NUEVO_ITEM_COLOR:
          respuesta = this.prepararNuevoItemConColor(telefono, texto, session);
          break;
        case FlowStep.CONFIRMAR:
          respuesta = await this.manejarConfirmacion(
            negocioId,
            telefono,
            texto,
            session,
          );
          break;
        default:
          resetearSesion(session);
          respuesta = MENSAJE_MENU;
      }

      // Guardado único: cubre tanto las mutaciones en memoria de `session`
      // como los resetearSesion() intermedios — sin importar qué handler corrió.
      await this.sessionStore.guardar(telefono, session);

      // Si seguimos en medio de un flujo (no volvió al menú), recordamos el
      // atajo "0" en cada paso — antes solo aparecía en el menú principal.
      if (session.step !== FlowStep.MENU) {
        respuesta += '\n\n_0️⃣ para volver al menú_';
      }

      return respuesta;
    } catch (error) {
      await this.sessionStore.reiniciar(telefono);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        return `⚠️ ${(error as HttpError).message ?? 'No se pudo completar la operación.'}\n\n${MENSAJE_MENU}`;
      }
      return `⚠️ Ocurrió un error inesperado. Intentá de nuevo.\n\n${MENSAJE_MENU}`;
    }
  }

  private esRespuestaAListaVieja(
    session: WhatsappSession,
    texto: string,
    actualizadoEn: Date | null,
  ): boolean {
    if (!actualizadoEn) return false;
    if (!PASOS_CON_LISTA_NUMERADA.includes(session.step)) return false;
    if (!/^\d+$/.test(texto)) return false;
    return Date.now() - actualizadoEn.getTime() > UMBRAL_SESION_VIEJA_MS;
  }

  private async manejarMenu(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    switch (texto.trim()) {
      case '1':
        return this.pedirItem(
          negocioId,
          session,
          Categoria.MATERIAL,
          FlowStep.COMPRA_CANTIDAD,
          '¿Qué material compraste?',
          true,
        );
      case '2':
        return this.mostrarOrdenMenu(negocioId, session);
      case '3':
        return this.pedirItem(
          negocioId,
          session,
          Categoria.PRODUCTO,
          FlowStep.VENTA_CANTIDAD,
          '¿Qué producto vendiste?',
        );
      case '4':
        return this.pedirItem(
          negocioId,
          session,
          undefined,
          FlowStep.AJUSTE_CANTIDAD,
          '¿Qué item querés ajustar?',
        );
      case '5': {
        session.step = FlowStep.STOCK_CATEGORIA;
        session.opciones = [];
        return '¿Stock de qué querés ver?\n1. Materiales\n2. Productos\n3. Todo';
      }
      case '6': {
        session.step = FlowStep.REPORTE_MENU;
        session.opciones = OPCIONES_REPORTE;
        return `¿Qué reporte querés ver?\n${construirListado(OPCIONES_REPORTE)}`;
      }
      case '7': {
        session.step = FlowStep.CATALOGO_MENU;
        session.opciones = OPCIONES_CATALOGO;
        return `¿Qué querés ver o cargar?\n${construirListado(OPCIONES_CATALOGO)}`;
      }
      case '8':
        return this.mostrarUltimosMovimientos(negocioId, telefono, session);
      default:
        return `No entendí esa opción.\n\n${MENSAJE_MENU}`;
    }
  }

  private async pedirItem(
    negocioId: string,
    session: WhatsappSession,
    categoria: Categoria | undefined,
    siguienteStep: FlowStep,
    pregunta: string,
    permitirCrear = false,
  ): Promise<string> {
    const items = await this.itemsService.findAll(negocioId, true);
    const filtrados = categoria
      ? items.filter((item) => item.categoria === categoria)
      : items;

    session.contextoItem = { categoria, siguienteStep };

    if (filtrados.length === 0) {
      if (permitirCrear && categoria) {
        return this.iniciarNuevoItemInline(session, categoria);
      }
      session.step = FlowStep.MENU;
      session.opciones = [];
      return `No hay items cargados en esa categoría todavía.\n\n${MENSAJE_MENU}`;
    }

    const opcionNuevo: OpcionListado[] =
      permitirCrear && categoria
        ? [
            {
              id: SENTINEL_NUEVO_ITEM,
              etiqueta: `➕ Cargar nuevo ${categoria === Categoria.PRODUCTO ? 'producto' : 'material'}`,
            },
          ]
        : [];

    // Si nadie en este grupo de items usa "grupo", vamos directo a elegir
    // nombre — no le sumamos un paso de más a Corderoy/Gabardina/etc.
    const grupos = [...new Set(filtrados.map((i) => i.grupo).filter((g): g is string => !!g))].sort();
    if (grupos.length === 0) {
      return this.pedirNombreItem(filtrados, session, pregunta, opcionNuevo);
    }

    const hayItemsSinGrupo = filtrados.some((i) => !i.grupo);
    session.step = FlowStep.SELECCION_ITEM_GRUPO;
    session.opciones = [
      ...opcionNuevo,
      ...grupos.map((g) => ({ id: g, etiqueta: g })),
      ...(hayItemsSinGrupo ? [{ id: null, etiqueta: 'Otros' }] : []),
    ];

    return `${pregunta}\n${construirListado(session.opciones)}`;
  }

  /// Arranca la creación de un item nuevo "sobre la marcha" dentro de un
  /// flujo de compra/recepción — se salta el paso de categoría porque ya se
  /// conoce por el contexto (material o producto según de dónde vino).
  private iniciarNuevoItemInline(
    session: WhatsappSession,
    categoria: Categoria,
  ): string {
    session.nuevoItemCategoria = categoria;
    session.step = FlowStep.NUEVO_ITEM_UNIDAD;
    session.opciones = [];
    return `¿Unidad de medida?\n${UNIDADES.map((u) => `${u.opcion}. ${u.etiqueta}`).join('\n')}`;
  }

  private async manejarSeleccionItemGrupo(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    if (seleccion.id === SENTINEL_NUEVO_ITEM) {
      return this.iniciarNuevoItemInline(session, session.contextoItem!.categoria!);
    }

    const contexto = session.contextoItem!;
    const items = await this.itemsService.findAll(negocioId, true);
    const filtrados = (
      contexto.categoria ? items.filter((i) => i.categoria === contexto.categoria) : items
    ).filter((i) => (seleccion.id === null ? !i.grupo : i.grupo === seleccion.id));

    session.contextoItem = { ...contexto, grupo: seleccion.id };
    return this.pedirNombreItem(filtrados, session, '¿Cuál?');
  }

  private pedirNombreItem(
    itemsDisponibles: Item[],
    session: WhatsappSession,
    pregunta: string,
    opcionesExtra: OpcionListado[] = [],
  ): string {
    const nombresUnicos = [
      ...new Set(itemsDisponibles.map((item) => item.nombre)),
    ].sort();

    session.step = FlowStep.SELECCION_ITEM_NOMBRE;
    session.opciones = [
      ...opcionesExtra,
      ...nombresUnicos.map((nombre) => ({
        id: nombre,
        etiqueta: nombre,
      })),
    ];

    return `${pregunta}\n${construirListado(session.opciones)}`;
  }

  private async manejarSeleccionItemNombre(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    if (seleccion.id === SENTINEL_NUEVO_ITEM) {
      return this.iniciarNuevoItemInline(session, session.contextoItem!.categoria!);
    }

    const contexto = session.contextoItem!;
    const items = await this.itemsService.findAll(negocioId, true);
    const coincidencias = items.filter(
      (item) =>
        item.nombre === seleccion.etiqueta &&
        (!contexto.categoria || item.categoria === contexto.categoria) &&
        (contexto.grupo === undefined ||
          (contexto.grupo === null ? !item.grupo : item.grupo === contexto.grupo)),
    );

    if (coincidencias.length <= 1) {
      session.itemId = coincidencias[0]?.id;
      session.step = contexto.siguienteStep;
      return '¿Cuánta cantidad? (podés escribir con decimales, ej: 5.5)';
    }

    session.step = FlowStep.SELECCION_ITEM_COLOR;
    session.opciones = coincidencias.map((item) => ({
      id: item.id,
      etiqueta: item.colorNombre ?? item.nombre,
    }));

    return `¿De qué color?\n${construirListado(session.opciones)}`;
  }

  private manejarSeleccionItemColor(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion || !seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    session.itemId = seleccion.id;
    session.step = session.contextoItem!.siguienteStep;

    return '¿Cuánta cantidad? (podés escribir con decimales, ej: 5.5)';
  }

  private async pedirOperario(
    negocioId: string,
    session: WhatsappSession,
    siguienteStep: FlowStep,
    pregunta: string,
    permitirCrear = false,
  ): Promise<string> {
    const flujo =
      siguienteStep === FlowStep.ENTREGA_OPERARIO ? 'ENTREGA' : 'RECEPCION';
    const operarios = await this.operariosService.findAll(negocioId, true);

    if (permitirCrear && operarios.length === 0) {
      session.operarioParaFlujo = flujo;
      session.step = FlowStep.NUEVA_OPERARIA_NOMBRE;
      session.opciones = [];
      return 'Todavía no cargaste ninguna operaria. ¿Cómo se llama?';
    }

    const opciones: OpcionListado[] = [
      ...(permitirCrear
        ? [{ id: SENTINEL_NUEVA_OPERARIA, etiqueta: '➕ Cargar operaria nueva' }]
        : []),
      ...operarios.map((op) => ({ id: op.id, etiqueta: op.nombre })),
    ];

    session.step = siguienteStep;
    session.opciones = opciones;
    session.operarioParaFlujo = permitirCrear ? flujo : undefined;

    return `${pregunta}\n${construirListado(opciones)}`;
  }

  private pedirConfirmacion(
    session: WhatsappSession,
    accion: AccionPendiente,
    resumen: string,
  ): string {
    session.accionPendiente = accion;
    session.step = FlowStep.CONFIRMAR;
    session.opciones = [];

    return `${resumen}\n¿Confirmás? Respondé *sí* o *no*.`;
  }

  private prepararCompra(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const cantidad = parsePositiveNumber(texto);
    if (cantidad === null) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    session.cantidadPendiente = cantidad;
    session.step = FlowStep.COMPRA_PRECIO;
    return '¿Cuál fue el precio total pagado (en pesos)?\nSi no querés registrarlo, respondé "no".';
  }

  private async manejarCompraPrecio(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const montoTotal = this.resolverPrecioOpcional(texto);
    if (montoTotal === null) {
      return '⚠️ Precio inválido. Ingresá solo números (ej: 15000 o 15.000), o "no" para omitirlo.';
    }

    const cantidad = session.cantidadPendiente!;
    const lineaPrecio = (unidad: Unidad) =>
      montoTotal
        ? `\n💰 Total: ${fmtMoney(montoTotal)} (${fmtMoney(montoTotal / cantidad)} por ${unidad.toLowerCase()}).`
        : '';

    if (!session.itemId) {
      const itemNuevo = armarItemNuevoPendiente(session, Categoria.MATERIAL);
      const nombreCompleto = etiquetaItemNuevo(itemNuevo);
      return this.pedirConfirmacion(
        session,
        {
          tipoAccion: 'MOVIMIENTO',
          itemNuevo,
          movimiento: { tipo: MovimientoTipo.COMPRA, cantidad, montoTotal },
          etiquetaItem: nombreCompleto,
        },
        `➕ Vas a agregar el material *${nombreCompleto}*.\nVas a registrar una *compra* de ${etiquetaCantidadUnidad(cantidad, itemNuevo.unidad)}.${lineaPrecio(itemNuevo.unidad)}`,
      );
    }

    const item = await this.itemsService.findOne(negocioId, session.itemId);
    return this.pedirConfirmacion(
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        itemId: item.id,
        movimiento: { tipo: MovimientoTipo.COMPRA, cantidad, montoTotal },
        etiquetaItem: etiquetaItem(item),
      },
      `Vas a registrar una *compra* de ${cantidad} de ${etiquetaItem(item)}.${lineaPrecio(item.unidad)}`,
    );
  }

  /// "no" (sin registrar precio) -> undefined. Un precio válido -> el
  /// número. Cualquier otra entrada -> null, que el caller interpreta como
  /// inválida (a diferencia de undefined, que es "no aplica, seguí sin precio").
  private resolverPrecioOpcional(texto: string): number | null | undefined {
    if (normalizarSiNo(texto) === false) return undefined;
    return parsePrice(texto);
  }

  private async mostrarOrdenMenu(
    negocioId: string,
    session: WhatsappSession,
  ): Promise<string> {
    const abiertas = await this.ordenesProduccionService.findAll(
      negocioId,
      undefined,
      true,
    );
    session.step = FlowStep.ORDEN_MENU;
    session.opciones = OPCIONES_ORDEN_MENU;
    return `Tenés ${pluralize(abiertas.length, 'orden abierta', 'órdenes abiertas')}. ¿Qué querés hacer?\n${construirListado(OPCIONES_ORDEN_MENU)}`;
  }

  private async manejarOrdenMenu(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    switch (seleccion.id) {
      case 'ABRIR':
        return this.pedirOperario(
          negocioId,
          session,
          FlowStep.ENTREGA_OPERARIO,
          '¿A qué operaria le entregás material?',
          true,
        );
      case 'AGREGAR':
        return this.mostrarOrdenesAbiertasParaSeleccion(negocioId, session);
      case 'CERRAR':
        return this.pedirOperario(
          negocioId,
          session,
          FlowStep.RECEPCION_OPERARIO,
          '¿Qué operaria trae el producto terminado?',
          true,
        );
      case 'HISTORIAL':
        return this.mostrarHistorialOrdenes(negocioId, session);
      default:
        resetearSesion(session);
        return MENSAJE_MENU;
    }
  }

  private async mostrarOrdenesAbiertasParaSeleccion(
    negocioId: string,
    session: WhatsappSession,
  ): Promise<string> {
    const abiertas = await this.ordenesProduccionService.findAll(
      negocioId,
      undefined,
      true,
    );
    if (abiertas.length === 0) {
      session.step = FlowStep.MENU;
      session.opciones = [];
      return `No hay órdenes abiertas todavía — abrí una nueva primero.\n\n${MENSAJE_MENU}`;
    }

    const etiquetas = await Promise.all(
      abiertas.map((orden) => this.etiquetaOrdenConOperario(negocioId, orden)),
    );
    session.step = FlowStep.ORDEN_SELECCION_ABIERTA;
    session.opciones = abiertas.map((orden, i) => ({
      id: orden.id,
      etiqueta: etiquetas[i],
    }));
    return `¿A qué orden le agregás material?\n${construirListado(session.opciones)}`;
  }

  private async manejarOrdenSeleccionAbierta(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion || !seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    session.ordenProduccionId = seleccion.id;
    const orden = await this.ordenesProduccionService.findOne(
      negocioId,
      seleccion.id,
    );
    session.operarioId = orden.operarioId;

    return this.pedirItem(
      negocioId,
      session,
      Categoria.MATERIAL,
      FlowStep.ORDEN_AGREGAR_CANTIDAD,
      '¿Qué material agregás a la orden?',
      true,
    );
  }

  private async prepararOrdenAgregarMaterial(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parsePositiveNumber(texto);
    if (cantidad === null) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    let itemNuevo: ItemNuevoPayload | undefined;
    let etiquetaItemTexto: string;
    if (session.itemId) {
      const item = await this.itemsService.findOne(negocioId, session.itemId);
      etiquetaItemTexto = etiquetaItem(item);
    } else {
      itemNuevo = armarItemNuevoPendiente(session, Categoria.MATERIAL);
      etiquetaItemTexto = etiquetaItemNuevo(itemNuevo);
    }

    const orden = await this.ordenesProduccionService.findOne(
      negocioId,
      session.ordenProduccionId!,
    );
    const operario = await this.operariosService.findOne(
      negocioId,
      orden.operarioId,
    );

    const lineas: string[] = [];
    if (itemNuevo) lineas.push(`➕ Vas a agregar el material *${etiquetaItemTexto}*.`);
    lineas.push(
      `Vas a agregar ${cantidad} de ${etiquetaItemTexto} a la orden de ${operario.nombre}.`,
    );

    return this.pedirConfirmacion(
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        itemId: session.itemId,
        itemNuevo,
        operarioId: operario.id,
        movimiento: {
          tipo: MovimientoTipo.CONSUMO,
          cantidad,
          ordenProduccionId: orden.id,
        },
        etiquetaItem: etiquetaItemTexto,
      },
      lineas.join('\n'),
    );
  }

  private async mostrarHistorialOrdenes(
    negocioId: string,
    session: WhatsappSession,
  ): Promise<string> {
    const todas = await this.ordenesProduccionService.findAll(negocioId);
    const cerradas = todas
      .filter((o) => o.estado === 'CERRADA')
      .sort(
        (a, b) => (b.cerradaEn?.getTime() ?? 0) - (a.cerradaEn?.getTime() ?? 0),
      )
      .slice(0, 5);
    resetearSesion(session);

    if (cerradas.length === 0) {
      return `Todavía no hay órdenes cerradas.\n\n${MENSAJE_MENU}`;
    }

    const etiquetas = await Promise.all(
      cerradas.map((orden) => this.etiquetaOrdenConOperario(negocioId, orden)),
    );
    const lineas = etiquetas.map((e) => `• ${e}`).join('\n');
    return `📋 *Últimas órdenes cerradas*\n${lineas}\n\n${MENSAJE_MENU}`;
  }

  private async etiquetaOrdenConOperario(
    negocioId: string,
    orden: OrdenProduccion,
  ): Promise<string> {
    const [operario, base] = await Promise.all([
      this.operariosService.findOne(negocioId, orden.operarioId),
      this.etiquetaOrden(negocioId, orden),
    ]);
    return `${operario.nombre} — ${base}`;
  }

  private async manejarEntregaOperario(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }
    if (seleccion.id === SENTINEL_NUEVA_OPERARIA) {
      session.step = FlowStep.NUEVA_OPERARIA_NOMBRE;
      session.opciones = [];
      return '¿Cómo se llama la nueva operaria?';
    }
    if (!seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }
    session.operarioId = seleccion.id;
    return this.pedirItem(
      negocioId,
      session,
      Categoria.MATERIAL,
      FlowStep.ENTREGA_CANTIDAD,
      '¿Qué material le entregás?',
      true,
    );
  }

  private async prepararEntrega(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parsePositiveNumber(texto);
    if (cantidad === null) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    let itemNuevo: ItemNuevoPayload | undefined;
    let etiquetaItemTexto: string;
    if (session.itemId) {
      const item = await this.itemsService.findOne(negocioId, session.itemId);
      etiquetaItemTexto = etiquetaItem(item);
    } else {
      itemNuevo = armarItemNuevoPendiente(session, Categoria.MATERIAL);
      etiquetaItemTexto = etiquetaItemNuevo(itemNuevo);
    }

    let operarioId: string | undefined;
    let operariaNuevaNombre: string | undefined;
    let nombreOperaria: string;
    if (session.operarioId) {
      const operario = await this.operariosService.findOne(
        negocioId,
        session.operarioId,
      );
      operarioId = operario.id;
      nombreOperaria = operario.nombre;
    } else {
      operariaNuevaNombre = session.nuevaOperariaNombrePendiente!;
      nombreOperaria = operariaNuevaNombre;
    }

    const lineas: string[] = [];
    if (itemNuevo) lineas.push(`➕ Vas a agregar el material *${etiquetaItemTexto}*.`);
    if (operariaNuevaNombre) lineas.push(`➕ Vas a agregar a *${operariaNuevaNombre}* como operaria.`);
    lineas.push(
      `Vas a registrar una *entrega* de ${cantidad} de ${etiquetaItemTexto} para ${nombreOperaria}.`,
    );

    return this.pedirConfirmacion(
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        itemId: session.itemId,
        itemNuevo,
        operarioId,
        operariaNuevaNombre,
        crearOrdenParaOperario: true,
        movimiento: { tipo: MovimientoTipo.CONSUMO, cantidad },
        etiquetaItem: etiquetaItemTexto,
        mensajeExtra: `\nCuando ${nombreOperaria} te traiga el producto terminado, elegí la opción 3 del menú y vas a poder vincularlo a esta misma entrega.`,
      },
      lineas.join('\n'),
    );
  }

  private async manejarRecepcionOperario(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }
    if (seleccion.id === SENTINEL_NUEVA_OPERARIA) {
      session.step = FlowStep.NUEVA_OPERARIA_NOMBRE;
      session.opciones = [];
      return '¿Cómo se llama la nueva operaria?';
    }
    if (!seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }
    session.operarioId = seleccion.id;

    const ordenes = await this.ordenesProduccionService.findAll(
      negocioId,
      seleccion.id,
    );
    if (ordenes.length === 0) {
      return this.pedirItem(
        negocioId,
        session,
        Categoria.PRODUCTO,
        FlowStep.RECEPCION_CANTIDAD,
        '¿Qué producto terminado trae?',
        true,
      );
    }

    const ordenesRecientes = ordenes.slice(0, 5);
    const etiquetas = await Promise.all(
      ordenesRecientes.map((orden) => this.etiquetaOrden(negocioId, orden)),
    );
    const opciones: OpcionListado[] = [
      { id: null, etiqueta: 'Sin vincular a ninguna entrega' },
      ...ordenesRecientes.map((orden, i) => ({
        id: orden.id,
        etiqueta: etiquetas[i],
      })),
    ];
    session.step = FlowStep.RECEPCION_ORDEN;
    session.opciones = opciones;

    return `¿A qué entrega corresponde este producto?\n${construirListado(opciones)}`;
  }

  private async etiquetaOrden(
    negocioId: string,
    orden: OrdenProduccion,
  ): Promise<string> {
    const fecha = new Date(orden.fecha).toLocaleDateString();
    const detalle = await this.ordenesProduccionService.findOne(
      negocioId,
      orden.id,
    );
    const consumos = detalle.movimientos.filter(
      (m) => m.tipo === MovimientoTipo.CONSUMO,
    );

    if (consumos.length === 0) {
      return `Entrega del ${fecha}`;
    }

    const materiales = consumos
      .map(
        (m) =>
          `${m.cantidad.toString()} ${m.item.colorNombre ? `${m.item.nombre} ${m.item.colorNombre}` : m.item.nombre}`,
      )
      .join(' + ');
    return `${fecha} · ${materiales}`;
  }

  private async manejarRecepcionOrden(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const numero = Number(texto.trim());
    if (
      !Number.isInteger(numero) ||
      numero < 1 ||
      numero > session.opciones.length
    ) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }
    session.ordenProduccionId = session.opciones[numero - 1].id;

    return this.pedirItem(
      negocioId,
      session,
      Categoria.PRODUCTO,
      FlowStep.RECEPCION_CANTIDAD,
      '¿Qué producto terminado trae?',
      true,
    );
  }

  private async prepararRecepcion(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parsePositiveNumber(texto);
    if (cantidad === null) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    let itemNuevo: ItemNuevoPayload | undefined;
    let etiquetaItemTexto: string;
    if (session.itemId) {
      const item = await this.itemsService.findOne(negocioId, session.itemId);
      etiquetaItemTexto = etiquetaItem(item);
    } else {
      itemNuevo = armarItemNuevoPendiente(session, Categoria.PRODUCTO);
      etiquetaItemTexto = etiquetaItemNuevo(itemNuevo);
    }

    let operarioId: string | undefined;
    let operariaNuevaNombre: string | undefined;
    let nombreOperaria: string;
    if (session.operarioId) {
      const operario = await this.operariosService.findOne(
        negocioId,
        session.operarioId,
      );
      operarioId = operario.id;
      nombreOperaria = operario.nombre;
    } else {
      operariaNuevaNombre = session.nuevaOperariaNombrePendiente!;
      nombreOperaria = operariaNuevaNombre;
    }

    const lineas: string[] = [];
    if (itemNuevo) lineas.push(`➕ Vas a agregar el producto *${etiquetaItemTexto}*.`);
    if (operariaNuevaNombre) lineas.push(`➕ Vas a agregar a *${operariaNuevaNombre}* como operaria.`);
    lineas.push(
      `Vas a registrar una *recepción* de ${cantidad} de ${etiquetaItemTexto} de ${nombreOperaria}.`,
    );

    return this.pedirConfirmacion(
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        itemId: session.itemId,
        itemNuevo,
        operarioId,
        operariaNuevaNombre,
        movimiento: {
          tipo: MovimientoTipo.PRODUCCION,
          cantidad,
          ordenProduccionId: session.ordenProduccionId ?? undefined,
        },
        etiquetaItem: etiquetaItemTexto,
      },
      lineas.join('\n'),
    );
  }

  private prepararVenta(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const cantidad = parsePositiveNumber(texto);
    if (cantidad === null) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    session.cantidadPendiente = cantidad;
    session.step = FlowStep.VENTA_PRECIO;
    return '¿Cuál fue el precio total cobrado (en pesos)?\nSi no querés registrarlo, respondé "no".';
  }

  private async manejarVentaPrecio(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const montoTotal = this.resolverPrecioOpcional(texto);
    if (montoTotal === null) {
      return '⚠️ Precio inválido. Ingresá solo números (ej: 12500 o 12.500), o "no" para omitirlo.';
    }

    const cantidad = session.cantidadPendiente!;
    const item = await this.itemsService.findOne(negocioId, session.itemId!);
    const lineaPrecio = montoTotal
      ? `\n💰 Total: ${fmtMoney(montoTotal)} (${fmtMoney(montoTotal / cantidad)} por ${item.unidad.toLowerCase()}).`
      : '';

    return this.pedirConfirmacion(
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        itemId: item.id,
        movimiento: { tipo: MovimientoTipo.VENTA, cantidad, montoTotal },
        etiquetaItem: etiquetaItem(item),
      },
      `Vas a registrar una *venta* de ${cantidad} de ${etiquetaItem(item)}.${lineaPrecio}`,
    );
  }

  private async prepararAjuste(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null) {
      return 'Ingresá un número distinto de cero (puede ser negativo, ej: -2).';
    }

    const item = await this.itemsService.findOne(negocioId, session.itemId!);
    return this.pedirConfirmacion(
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        itemId: item.id,
        movimiento: { tipo: MovimientoTipo.AJUSTE, cantidad },
        etiquetaItem: etiquetaItem(item),
      },
      `Vas a registrar un *ajuste* de ${cantidad > 0 ? '+' : ''}${cantidad} en ${etiquetaItem(item)}.`,
    );
  }

  private async finalizarStock(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const categoriaPorOpcion: Record<string, Categoria | undefined> = {
      '1': Categoria.MATERIAL,
      '2': Categoria.PRODUCTO,
      '3': undefined,
    };
    const opcion = texto.trim();
    if (!(opcion in categoriaPorOpcion)) {
      return 'Respondé 1 (materiales), 2 (productos) o 3 (todo).';
    }

    const resumen = await this.stockService.getResumen(
      negocioId,
      categoriaPorOpcion[opcion],
    );
    resetearSesion(session);

    if (resumen.length === 0) {
      return `No hay items cargados en esa categoría.\n\n${MENSAJE_MENU}`;
    }

    const lineas = resumen
      .map(
        (r) =>
          `${r.bajoMinimo ? '⚠️' : '•'} ${r.nombre}: ${r.stock} ${r.unidad.toLowerCase()}`,
      )
      .join('\n');
    return `📦 *Stock actual*\n${lineas}\n\n${MENSAJE_MENU}`;
  }

  private async manejarReporteMenu(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    switch (seleccion.id) {
      case 'HOY':
        return this.mostrarReporteVentas(
          negocioId,
          session,
          rangoHoy(),
          'Reporte de Hoy',
          fmtFechaLarga(new Date()),
        );
      case 'SEMANA':
        return this.mostrarReporteVentas(
          negocioId,
          session,
          rangoUltimosDias(7),
          'Reporte Semanal',
          'Últimos 7 días',
        );
      case 'MES':
        return this.mostrarReporteVentas(
          negocioId,
          session,
          rangoMesActual(),
          'Reporte Mensual',
          fmtMesLargo(new Date()),
        );
      case 'OPERARIA':
        return this.mostrarSeleccionOperariaReporte(negocioId, session);
      case 'CONSUMO':
        return this.mostrarReporteConsumo(negocioId, session);
      case 'PROD_VS_VENTAS':
        return this.mostrarReporteProdVsVentas(negocioId, session);
      case 'STOCK_BAJO':
        return this.mostrarReporteStockBajo(negocioId, session);
      default:
        resetearSesion(session);
        return MENSAJE_MENU;
    }
  }

  private async mostrarReporteVentas(
    negocioId: string,
    session: WhatsappSession,
    rango: { desde: Date; hasta: Date },
    titulo: string,
    subtitulo: string,
  ): Promise<string> {
    const ventas = await this.movimientosService.buscarPorTipo(negocioId, {
      tipo: MovimientoTipo.VENTA,
      desde: rango.desde,
      hasta: rango.hasta,
    });
    resetearSesion(session);

    const totalMonto = ventas.reduce(
      (suma, v) => suma + (v.montoTotal ? Number(v.montoTotal) : 0),
      0,
    );
    let cuerpo = `💰 Ventas: ${pluralize(ventas.length, 'transacción', 'transacciones')}`;
    if (totalMonto > 0) cuerpo += ` · ${fmtMoney(totalMonto)}`;

    const porItem = new Map<string, { etiqueta: string; unidad: Unidad; cantidad: number }>();
    for (const v of ventas) {
      const previo = porItem.get(v.itemId);
      const cantidadNum = Number(v.cantidad);
      if (previo) previo.cantidad += cantidadNum;
      else
        porItem.set(v.itemId, {
          etiqueta: etiquetaItem(v.item),
          unidad: v.item.unidad,
          cantidad: cantidadNum,
        });
    }
    const masVendido = [...porItem.values()].sort((a, b) => b.cantidad - a.cantidad)[0];
    if (masVendido) {
      cuerpo += `\n🏆 Más vendido: ${masVendido.etiqueta} (${etiquetaCantidadUnidad(masVendido.cantidad, masVendido.unidad)})`;
    }

    return `📅 *${titulo}*\n${subtitulo}\n\n${cuerpo}\n\n${MENSAJE_MENU}`;
  }

  private async mostrarSeleccionOperariaReporte(
    negocioId: string,
    session: WhatsappSession,
  ): Promise<string> {
    const operarios = await this.operariosService.findAll(negocioId, true);
    if (operarios.length === 0) {
      resetearSesion(session);
      return `Todavía no hay operarias cargadas.\n\n${MENSAJE_MENU}`;
    }
    session.step = FlowStep.REPORTE_OPERARIA_SELECCION;
    session.opciones = operarios.map((op) => ({ id: op.id, etiqueta: op.nombre }));
    return `¿Qué operaria querés ver?\n${construirListado(session.opciones)}`;
  }

  private async manejarReporteOperariaSeleccion(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion || !seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    const operario = await this.operariosService.findOne(negocioId, seleccion.id);
    const ordenes = await this.ordenesProduccionService.findAll(negocioId, seleccion.id);
    const abiertas = ordenes.filter((o) => o.estado === 'ABIERTA').length;
    const cerradas = ordenes.filter((o) => o.estado === 'CERRADA').length;

    const produccion = await this.movimientosService.buscarPorTipo(negocioId, {
      tipo: MovimientoTipo.PRODUCCION,
    });
    const idsOrdenes = new Set(ordenes.map((o) => o.id));
    const totalProductos = produccion
      .filter((m) => m.ordenProduccionId && idsOrdenes.has(m.ordenProduccionId))
      .reduce((suma, m) => suma + Number(m.cantidad), 0);

    resetearSesion(session);
    const cuerpo = [
      `👩 *${operario.nombre}*`,
      '',
      `📬 Órdenes abiertas: ${abiertas}`,
      `✅ Órdenes cerradas: ${cerradas}`,
      `🧸 Productos recibidos: ${totalProductos}`,
    ].join('\n');
    return `${cuerpo}\n\n${MENSAJE_MENU}`;
  }

  private async mostrarReporteConsumo(
    negocioId: string,
    session: WhatsappSession,
  ): Promise<string> {
    const consumos = await this.movimientosService.buscarPorTipo(negocioId, {
      tipo: MovimientoTipo.CONSUMO,
    });
    resetearSesion(session);
    if (consumos.length === 0) {
      return `Todavía no hay consumo de materiales registrado.\n\n${MENSAJE_MENU}`;
    }

    const porItem = new Map<string, { etiqueta: string; unidad: Unidad; cantidad: number }>();
    for (const m of consumos) {
      const previo = porItem.get(m.itemId);
      const cantidadNum = Number(m.cantidad);
      if (previo) previo.cantidad += cantidadNum;
      else
        porItem.set(m.itemId, {
          etiqueta: etiquetaItem(m.item),
          unidad: m.item.unidad,
          cantidad: cantidadNum,
        });
    }
    const lineas = [...porItem.values()]
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((x) => `• ${x.etiqueta}: ${etiquetaCantidadUnidad(x.cantidad, x.unidad)}`)
      .join('\n');

    return `🧵 *Consumo de materiales*\n${lineas}\n\n${MENSAJE_MENU}`;
  }

  private async mostrarReporteProdVsVentas(
    negocioId: string,
    session: WhatsappSession,
  ): Promise<string> {
    const [producciones, ventas] = await Promise.all([
      this.movimientosService.buscarPorTipo(negocioId, { tipo: MovimientoTipo.PRODUCCION }),
      this.movimientosService.buscarPorTipo(negocioId, { tipo: MovimientoTipo.VENTA }),
    ]);
    resetearSesion(session);

    const producidoPorItem = new Map<string, number>();
    for (const m of producciones) {
      producidoPorItem.set(m.itemId, (producidoPorItem.get(m.itemId) ?? 0) + Number(m.cantidad));
    }
    const vendidoPorItem = new Map<string, number>();
    for (const m of ventas) {
      vendidoPorItem.set(m.itemId, (vendidoPorItem.get(m.itemId) ?? 0) + Number(m.cantidad));
    }
    const itemsPorId = new Map<string, Item>();
    for (const m of [...producciones, ...ventas]) itemsPorId.set(m.itemId, m.item);

    const idsTodos = new Set([...producidoPorItem.keys(), ...vendidoPorItem.keys()]);
    if (idsTodos.size === 0) {
      return `Todavía no hay producción ni ventas registradas.\n\n${MENSAJE_MENU}`;
    }

    const lineas = [...idsTodos]
      .map((itemId) => {
        const item = itemsPorId.get(itemId)!;
        const producido = producidoPorItem.get(itemId) ?? 0;
        const vendido = vendidoPorItem.get(itemId) ?? 0;
        const diff = producido - vendido;
        const icono = diff < 0 ? '🔴' : diff === 0 ? '🟡' : '🟢';
        return `${icono} ${etiquetaItem(item)}: producido ${producido} · vendido ${vendido} · diferencia ${diff >= 0 ? '+' : ''}${diff}`;
      })
      .join('\n');

    return `📦 *Producción vs Ventas*\n${lineas}\n\n_🟢 superávit · 🟡 equilibrio · 🔴 vendiste más de lo producido_\n\n${MENSAJE_MENU}`;
  }

  private async mostrarReporteStockBajo(
    negocioId: string,
    session: WhatsappSession,
  ): Promise<string> {
    const resumen = await this.stockService.getResumen(negocioId);
    resetearSesion(session);

    const bajos = resumen.filter((r) => r.bajoMinimo);
    if (bajos.length === 0) {
      return `✅ Todo el stock está por encima del mínimo.\n\n${MENSAJE_MENU}`;
    }
    const lineas = bajos
      .map((r) => `⚠️ ${r.nombre}: ${r.stock} ${r.unidad.toLowerCase()} (mín: ${r.stockMinimo})`)
      .join('\n');
    return `⚠️ *Stock bajo*\n${lineas}\n\n${MENSAJE_MENU}`;
  }

  private async manejarCatalogoMenu(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    if (seleccion.id === 'OPERARIA') {
      const operarios = await this.operariosService.findAll(negocioId, true);
      resetearSesion(session);
      if (operarios.length === 0) {
        return `Todavía no hay operarias cargadas. Se agregan sobre la marcha desde "Orden de producción".\n\n${MENSAJE_MENU}`;
      }
      const lineas = operarios.map((op) => `• ${op.nombre}`).join('\n');
      return `👩 *Operarias*\n${lineas}\n\n_Para agregar una nueva, entrá a "Orden de producción"._\n\n${MENSAJE_MENU}`;
    }

    const categoria = seleccion.id as Categoria;
    const items = await this.itemsService.findAll(negocioId, true);
    const filtrados = items.filter((item) => item.categoria === categoria);
    resetearSesion(session);

    const esMaterial = categoria === Categoria.MATERIAL;
    const tituloTipo = esMaterial ? 'Materiales' : 'Productos';
    const dondeAgregar = esMaterial ? '"Compra de material"' : '"Orden de producción" (al cerrar una orden)';
    if (filtrados.length === 0) {
      return `Todavía no hay ${tituloTipo.toLowerCase()} cargados. Se agregan sobre la marcha desde ${dondeAgregar}.\n\n${MENSAJE_MENU}`;
    }
    const lineas = filtrados
      .map((item) => `• ${item.codigo} ${etiquetaItem(item)}`)
      .join('\n');
    return `📦 *${tituloTipo}*\n${lineas}\n\n_Para agregar uno nuevo, entrá a ${dondeAgregar}._\n\n${MENSAJE_MENU}`;
  }

  private async mostrarUltimosMovimientos(
    negocioId: string,
    telefono: string,
    session: WhatsappSession,
  ): Promise<string> {
    const movimientos = await this.movimientosService.findAll(negocioId);
    resetearSesion(session);

    if (movimientos.length === 0) {
      return `Todavía no hay movimientos registrados.\n\n${MENSAJE_MENU}`;
    }

    const lineas = movimientos
      .slice(0, 8)
      .map((mov) => {
        const fecha = new Date(mov.fecha).toLocaleDateString();
        const nombre = mov.item.colorNombre
          ? `${mov.item.nombre} ${mov.item.colorNombre}`
          : mov.item.nombre;
        const esAjustePositivo =
          mov.tipo === MovimientoTipo.AJUSTE && Number(mov.cantidad) > 0;
        const signo =
          mov.tipo === MovimientoTipo.AJUSTE
            ? esAjustePositivo
              ? '+'
              : ''
            : (SIGNO_POR_TIPO[mov.tipo] ?? '+');
        return `• ${fecha} ${mov.tipo}: ${signo}${mov.cantidad.toString()} ${nombre}`;
      })
      .join('\n');

    return `🕓 *Últimos movimientos*\n${lineas}\n\n${MENSAJE_MENU}`;
  }

  /// Se llega acá siempre desde el sentinel "cargar operaria nueva" elegido
  /// dentro de entrega o recepción (las opciones standalone del menú
  /// principal para agregar operaria/item se sacaron: ahora se cargan sobre
  /// la marcha, pegadas al movimiento que las originó). No confirma ni crea
  /// nada todavía — sigue el flujo original hasta la cantidad, y recién ahí
  /// se junta todo en una sola confirmación.
  private async manejarNuevaOperariaNombre(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const nombre = texto.trim();
    if (!nombre) {
      return 'Ingresá un nombre válido.';
    }
    session.nuevaOperariaNombrePendiente = nombre;

    if (session.operarioParaFlujo === 'RECEPCION') {
      return this.pedirItem(
        negocioId,
        session,
        Categoria.PRODUCTO,
        FlowStep.RECEPCION_CANTIDAD,
        '¿Qué producto terminado trae?',
        true,
      );
    }
    return this.pedirItem(
      negocioId,
      session,
      Categoria.MATERIAL,
      FlowStep.ENTREGA_CANTIDAD,
      '¿Qué material le entregás?',
      true,
    );
  }

  private manejarNuevoItemUnidad(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const unidad = UNIDADES.find((u) => u.opcion === texto.trim());
    if (!unidad) {
      return `Respondé con el número de la lista.\n${UNIDADES.map((u) => `${u.opcion}. ${u.etiqueta}`).join('\n')}`;
    }

    session.nuevoItemUnidad = unidad.valor;
    session.step = FlowStep.NUEVO_ITEM_NOMBRE;

    return '¿Cómo se llama? (ej: Pana)';
  }

  private manejarNuevoItemNombre(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const nombre = texto.trim();
    if (!nombre) {
      return 'Ingresá un nombre válido.';
    }

    session.nuevoItemNombre = nombre;
    session.step = FlowStep.NUEVO_ITEM_TIENE_GRUPO;

    return '¿Pertenece a algún grupo? (ej: "Hilo", para agrupar Poliéster/Algodón/etc.)';
  }

  /// Pregunta booleana separada del nombre del grupo en sí — así se puede
  /// contestar con los botones táctiles Sí/No en vez de tener que escribir
  /// "no" a mano cuando no aplica.
  private manejarNuevoItemTieneGrupo(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const respuesta = normalizarSiNo(texto);
    if (respuesta === null) {
      return 'Respondé sí o no.';
    }

    if (!respuesta) {
      session.nuevoItemGrupo = null;
      session.step = FlowStep.NUEVO_ITEM_TIENE_COLOR;
      return '¿Tiene color?';
    }

    session.step = FlowStep.NUEVO_ITEM_GRUPO;
    return '¿Cómo se llama el grupo? (ej: Hilo)';
  }

  private manejarNuevoItemGrupo(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const grupo = texto.trim();
    if (!grupo) {
      return 'Ingresá un nombre de grupo válido.';
    }

    session.nuevoItemGrupo = grupo;
    session.step = FlowStep.NUEVO_ITEM_TIENE_COLOR;

    return '¿Tiene color?';
  }

  private manejarNuevoItemTieneColor(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const respuesta = normalizarSiNo(texto);
    if (respuesta === null) {
      return 'Respondé sí o no.';
    }

    if (!respuesta) {
      return this.finalizarDatosNuevoItem(session, null);
    }

    session.step = FlowStep.NUEVO_ITEM_COLOR;
    return '¿De qué color?';
  }

  private prepararNuevoItemConColor(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const color = texto.trim();
    if (!color) {
      return 'Ingresá un color válido.';
    }
    return this.finalizarDatosNuevoItem(session, color);
  }

  /// Última pregunta antes de la cantidad: ya se tienen todos los datos del
  /// item nuevo (unidad, nombre, grupo, color), pero todavía no se creó — se
  /// crea junto con el movimiento al confirmar (ver ejecutarMovimientoPendiente).
  private finalizarDatosNuevoItem(
    session: WhatsappSession,
    colorNombre: string | null,
  ): string {
    session.nuevoItemColorNombre = colorNombre;
    session.itemId = undefined;
    session.step = session.contextoItem!.siguienteStep;

    const nombreCompleto = colorNombre
      ? `${session.nuevoItemNombre} ${colorNombre}`
      : session.nuevoItemNombre;
    return `Nuevo: *${nombreCompleto}*.\n¿Cuánta cantidad? (podés escribir con decimales, ej: 5.5)`;
  }

  private async manejarConfirmacion(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const respuesta = normalizarSiNo(texto);
    if (respuesta === null) {
      return 'Respondé *sí* o *no* (o "0" para cancelar).';
    }

    const accion = session.accionPendiente;
    resetearSesion(session);

    if (!respuesta) {
      return `Cancelado, no se registró nada.\n\n${MENSAJE_MENU}`;
    }
    if (!accion) {
      return MENSAJE_MENU;
    }

    return this.ejecutarMovimientoPendiente(negocioId, accion);
  }

  /// Resuelve (creando si hace falta) el item y la operaria de la acción, y
  /// recién ahí registra el movimiento — así una sola confirmación puede
  /// cubrir "crear material nuevo + registrar la compra" o "crear operaria
  /// nueva + registrar la entrega" sin pasos de más.
  private async ejecutarMovimientoPendiente(
    negocioId: string,
    accion: AccionMovimientoPendiente,
  ): Promise<string> {
    const mensajesCreacion: string[] = [];

    let itemId = accion.itemId;
    if (accion.itemNuevo) {
      const item = await this.itemsService.create(negocioId, {
        grupo: accion.itemNuevo.grupo ?? undefined,
        nombre: accion.itemNuevo.nombre,
        categoria: accion.itemNuevo.categoria,
        unidad: accion.itemNuevo.unidad,
        tieneColor: accion.itemNuevo.colorNombre !== null,
        colorNombre: accion.itemNuevo.colorNombre ?? undefined,
      });
      itemId = item.id;
      const tipo = accion.itemNuevo.categoria === Categoria.PRODUCTO ? 'Producto' : 'Material';
      mensajesCreacion.push(`✅ ${tipo} agregado: ${etiquetaItem(item)}.`);
    }

    let operarioId = accion.operarioId;
    if (accion.operariaNuevaNombre) {
      const operaria = await this.operariosService.create(negocioId, {
        nombre: accion.operariaNuevaNombre,
      });
      operarioId = operaria.id;
      mensajesCreacion.push(`✅ Operaria agregada: ${operaria.nombre}.`);
    }

    let ordenProduccionId = accion.movimiento.ordenProduccionId;
    if (accion.crearOrdenParaOperario) {
      const orden = await this.ordenesProduccionService.create(negocioId, {
        operarioId: operarioId!,
        observaciones: 'Entrega registrada por WhatsApp',
      });
      ordenProduccionId = orden.id;
    }

    const payload: MovimientoPayload = {
      itemId: itemId!,
      tipo: accion.movimiento.tipo,
      cantidad: accion.movimiento.cantidad,
      montoTotal: accion.movimiento.montoTotal,
      operarioId,
      ordenProduccionId,
    };

    await this.movimientosService.create(negocioId, payload);
    const stock = await this.stockService.getStock(negocioId, itemId!);

    const encabezado = mensajesCreacion.length ? `${mensajesCreacion.join('\n')}\n` : '';
    return `${encabezado}✅ Registrado: ${accion.movimiento.cantidad} de ${accion.etiquetaItem}.\nStock actual: ${stock}${accion.mensajeExtra ?? ''}\n\n${MENSAJE_MENU}`;
  }
}
