import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  OpcionListado,
  WhatsappSession,
} from './types';
import { ItemsService } from '../../items/items.service';
import { OperariosService } from '../../operarios/operarios.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { OrdenesProduccionService } from '../../ordenes-produccion/ordenes-produccion.service';
import { StockService } from '../../stock/stock.service';

const MENSAJE_MENU = [
  '👋 *StockAsist*',
  '¿Qué querés registrar? Respondé con el número:',
  '',
  '1️⃣ Compra de tela',
  '2️⃣ Entrega de material a operaria',
  '3️⃣ Recepción de producto terminado',
  '4️⃣ Venta',
  '5️⃣ Ajuste de stock',
  '6️⃣ Ver stock',
  '7️⃣ Agregar operaria nueva',
  '8️⃣ Agregar material o producto nuevo',
  '9️⃣ Ver últimos movimientos',
  '',
  '_Escribí "0" o "menu" en cualquier momento para volver acá._',
].join('\n');

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

function etiquetaItem(item: Item): string {
  const nombre = item.colorNombre
    ? `${item.nombre} ${item.colorNombre}`
    : item.nombre;
  return `${nombre} (${item.unidad.toLowerCase()})`;
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

@Injectable()
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
      this.sessionStore.reiniciar(telefono);
      return MENSAJE_MENU;
    }

    const session = this.sessionStore.obtener(telefono);

    try {
      switch (session.step) {
        case FlowStep.MENU:
          return await this.manejarMenu(negocioId, telefono, texto, session);
        case FlowStep.SELECCION_ITEM_NOMBRE:
          return await this.manejarSeleccionItemNombre(
            negocioId,
            telefono,
            texto,
            session,
          );
        case FlowStep.SELECCION_ITEM_COLOR:
          return this.manejarSeleccionItemColor(telefono, texto, session);
        case FlowStep.COMPRA_CANTIDAD:
          return await this.prepararCompra(negocioId, telefono, texto, session);
        case FlowStep.ENTREGA_OPERARIO:
          return await this.manejarEntregaOperario(
            negocioId,
            telefono,
            texto,
            session,
          );
        case FlowStep.ENTREGA_CANTIDAD:
          return await this.prepararEntrega(
            negocioId,
            telefono,
            texto,
            session,
          );
        case FlowStep.RECEPCION_OPERARIO:
          return await this.manejarRecepcionOperario(
            negocioId,
            telefono,
            texto,
            session,
          );
        case FlowStep.RECEPCION_ORDEN:
          return await this.manejarRecepcionOrden(
            negocioId,
            telefono,
            texto,
            session,
          );
        case FlowStep.RECEPCION_CANTIDAD:
          return await this.prepararRecepcion(
            negocioId,
            telefono,
            texto,
            session,
          );
        case FlowStep.VENTA_CANTIDAD:
          return await this.prepararVenta(negocioId, telefono, texto, session);
        case FlowStep.AJUSTE_CANTIDAD:
          return await this.prepararAjuste(negocioId, telefono, texto, session);
        case FlowStep.STOCK_CATEGORIA:
          return await this.finalizarStock(negocioId, telefono, texto);
        case FlowStep.NUEVA_OPERARIA_NOMBRE:
          return this.prepararNuevaOperaria(telefono, texto, session);
        case FlowStep.NUEVO_ITEM_CATEGORIA:
          return this.manejarNuevoItemCategoria(telefono, texto, session);
        case FlowStep.NUEVO_ITEM_UNIDAD:
          return this.manejarNuevoItemUnidad(telefono, texto, session);
        case FlowStep.NUEVO_ITEM_NOMBRE:
          return this.manejarNuevoItemNombre(telefono, texto, session);
        case FlowStep.NUEVO_ITEM_TIENE_COLOR:
          return this.manejarNuevoItemTieneColor(telefono, texto, session);
        case FlowStep.NUEVO_ITEM_COLOR:
          return this.prepararNuevoItemConColor(telefono, texto, session);
        case FlowStep.CONFIRMAR:
          return await this.manejarConfirmacion(
            negocioId,
            telefono,
            texto,
            session,
          );
        default:
          this.sessionStore.reiniciar(telefono);
          return MENSAJE_MENU;
      }
    } catch (error) {
      this.sessionStore.reiniciar(telefono);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        const respuesta = error.getResponse();
        const mensaje =
          typeof respuesta === 'string'
            ? respuesta
            : (respuesta as { message?: string }).message;
        return `⚠️ ${mensaje ?? 'No se pudo completar la operación.'}\n\n${MENSAJE_MENU}`;
      }
      return `⚠️ Ocurrió un error inesperado. Intentá de nuevo.\n\n${MENSAJE_MENU}`;
    }
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
        );
      case '2':
        return this.pedirOperario(
          negocioId,
          session,
          FlowStep.ENTREGA_OPERARIO,
          '¿A qué operaria le entregás material?',
        );
      case '3':
        return this.pedirOperario(
          negocioId,
          session,
          FlowStep.RECEPCION_OPERARIO,
          '¿Qué operaria trae el producto terminado?',
        );
      case '4':
        return this.pedirItem(
          negocioId,
          session,
          Categoria.PRODUCTO,
          FlowStep.VENTA_CANTIDAD,
          '¿Qué producto vendiste?',
        );
      case '5':
        return this.pedirItem(
          negocioId,
          session,
          undefined,
          FlowStep.AJUSTE_CANTIDAD,
          '¿Qué item querés ajustar?',
        );
      case '6': {
        session.step = FlowStep.STOCK_CATEGORIA;
        session.opciones = [];
        this.sessionStore.guardar(telefono, session);
        return '¿Stock de qué querés ver?\n1. Materiales\n2. Productos\n3. Todo';
      }
      case '7': {
        session.step = FlowStep.NUEVA_OPERARIA_NOMBRE;
        session.opciones = [];
        this.sessionStore.guardar(telefono, session);
        return '¿Cómo se llama la nueva operaria?';
      }
      case '8': {
        session.step = FlowStep.NUEVO_ITEM_CATEGORIA;
        session.opciones = [];
        this.sessionStore.guardar(telefono, session);
        return '¿Es un material o un producto?\n1. Material\n2. Producto';
      }
      case '9':
        return this.mostrarUltimosMovimientos(negocioId, telefono);
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
  ): Promise<string> {
    const items = await this.itemsService.findAll(negocioId, true);
    const filtrados = categoria
      ? items.filter((item) => item.categoria === categoria)
      : items;

    if (filtrados.length === 0) {
      session.step = FlowStep.MENU;
      session.opciones = [];
      return `No hay items cargados en esa categoría todavía.\n\n${MENSAJE_MENU}`;
    }

    const nombresUnicos = [
      ...new Set(filtrados.map((item) => item.nombre)),
    ].sort();

    session.contextoItem = { categoria, siguienteStep };
    session.step = FlowStep.SELECCION_ITEM_NOMBRE;
    session.opciones = nombresUnicos.map((nombre) => ({
      id: nombre,
      etiqueta: nombre,
    }));

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

    const contexto = session.contextoItem!;
    const items = await this.itemsService.findAll(negocioId, true);
    const coincidencias = items.filter(
      (item) =>
        item.nombre === seleccion.etiqueta &&
        (!contexto.categoria || item.categoria === contexto.categoria),
    );

    if (coincidencias.length <= 1) {
      session.itemId = coincidencias[0]?.id;
      session.step = contexto.siguienteStep;
      this.sessionStore.guardar(telefono, session);
      return '¿Cuánta cantidad? (podés escribir con decimales, ej: 5.5)';
    }

    session.step = FlowStep.SELECCION_ITEM_COLOR;
    session.opciones = coincidencias.map((item) => ({
      id: item.id,
      etiqueta: item.colorNombre ?? item.nombre,
    }));
    this.sessionStore.guardar(telefono, session);

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
    this.sessionStore.guardar(telefono, session);

    return '¿Cuánta cantidad? (podés escribir con decimales, ej: 5.5)';
  }

  private async pedirOperario(
    negocioId: string,
    session: WhatsappSession,
    siguienteStep: FlowStep,
    pregunta: string,
  ): Promise<string> {
    const operarios = await this.operariosService.findAll(negocioId, true);
    const opciones: OpcionListado[] = operarios.map((op) => ({
      id: op.id,
      etiqueta: op.nombre,
    }));

    session.step = siguienteStep;
    session.opciones = opciones;

    return `${pregunta}\n${construirListado(opciones)}`;
  }

  private pedirConfirmacion(
    telefono: string,
    session: WhatsappSession,
    accion: AccionPendiente,
    resumen: string,
  ): string {
    session.accionPendiente = accion;
    session.step = FlowStep.CONFIRMAR;
    session.opciones = [];
    this.sessionStore.guardar(telefono, session);

    return `${resumen}\n¿Confirmás? Respondé *sí* o *no*.`;
  }

  private async prepararCompra(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null || cantidad <= 0) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    const item = await this.itemsService.findOne(negocioId, session.itemId!);
    return this.pedirConfirmacion(
      telefono,
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        payload: { itemId: item.id, tipo: MovimientoTipo.COMPRA, cantidad },
        etiquetaItem: etiquetaItem(item),
      },
      `Vas a registrar una *compra* de ${cantidad} de ${etiquetaItem(item)}.`,
    );
  }

  private async manejarEntregaOperario(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion || !seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }
    session.operarioId = seleccion.id;
    this.sessionStore.guardar(telefono, session);
    return this.pedirItem(
      negocioId,
      session,
      Categoria.MATERIAL,
      FlowStep.ENTREGA_CANTIDAD,
      '¿Qué material le entregás?',
    );
  }

  private async prepararEntrega(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null || cantidad <= 0) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    const item = await this.itemsService.findOne(negocioId, session.itemId!);
    const operario = await this.operariosService.findOne(
      negocioId,
      session.operarioId!,
    );

    return this.pedirConfirmacion(
      telefono,
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        payload: { itemId: item.id, tipo: MovimientoTipo.CONSUMO, cantidad },
        etiquetaItem: etiquetaItem(item),
        crearOrdenParaOperario: operario.id,
        mensajeExtra: `\nCuando ${operario.nombre} te traiga el producto terminado, elegí la opción 3 del menú y vas a poder vincularlo a esta misma entrega.`,
      },
      `Vas a registrar una *entrega* de ${cantidad} de ${etiquetaItem(item)} para ${operario.nombre}.`,
    );
  }

  private async manejarRecepcionOperario(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion || !seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }
    session.operarioId = seleccion.id;

    const ordenes = await this.ordenesProduccionService.findAll(
      negocioId,
      seleccion.id,
    );
    if (ordenes.length === 0) {
      this.sessionStore.guardar(telefono, session);
      return this.pedirItem(
        negocioId,
        session,
        Categoria.PRODUCTO,
        FlowStep.RECEPCION_CANTIDAD,
        '¿Qué producto terminado trae?',
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
    this.sessionStore.guardar(telefono, session);

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
    this.sessionStore.guardar(telefono, session);

    return this.pedirItem(
      negocioId,
      session,
      Categoria.PRODUCTO,
      FlowStep.RECEPCION_CANTIDAD,
      '¿Qué producto terminado trae?',
    );
  }

  private async prepararRecepcion(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null || cantidad <= 0) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    const item = await this.itemsService.findOne(negocioId, session.itemId!);
    const operario = await this.operariosService.findOne(
      negocioId,
      session.operarioId!,
    );

    return this.pedirConfirmacion(
      telefono,
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        payload: {
          itemId: item.id,
          tipo: MovimientoTipo.PRODUCCION,
          cantidad,
          operarioId: operario.id,
          ordenProduccionId: session.ordenProduccionId ?? undefined,
        },
        etiquetaItem: etiquetaItem(item),
      },
      `Vas a registrar una *recepción* de ${cantidad} de ${etiquetaItem(item)} de ${operario.nombre}.`,
    );
  }

  private async prepararVenta(
    negocioId: string,
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null || cantidad <= 0) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    const item = await this.itemsService.findOne(negocioId, session.itemId!);
    return this.pedirConfirmacion(
      telefono,
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        payload: { itemId: item.id, tipo: MovimientoTipo.VENTA, cantidad },
        etiquetaItem: etiquetaItem(item),
      },
      `Vas a registrar una *venta* de ${cantidad} de ${etiquetaItem(item)}.`,
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
      telefono,
      session,
      {
        tipoAccion: 'MOVIMIENTO',
        payload: { itemId: item.id, tipo: MovimientoTipo.AJUSTE, cantidad },
        etiquetaItem: etiquetaItem(item),
      },
      `Vas a registrar un *ajuste* de ${cantidad > 0 ? '+' : ''}${cantidad} en ${etiquetaItem(item)}.`,
    );
  }

  private async finalizarStock(
    negocioId: string,
    telefono: string,
    texto: string,
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
    this.sessionStore.reiniciar(telefono);

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

  private async mostrarUltimosMovimientos(
    negocioId: string,
    telefono: string,
  ): Promise<string> {
    const movimientos = await this.movimientosService.findAll(negocioId);
    this.sessionStore.reiniciar(telefono);

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

  private prepararNuevaOperaria(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const nombre = texto.trim();
    if (!nombre) {
      return 'Ingresá un nombre válido.';
    }
    return this.pedirConfirmacion(
      telefono,
      session,
      { tipoAccion: 'OPERARIA', nombre },
      `Vas a agregar a *${nombre}* como operaria.`,
    );
  }

  private manejarNuevoItemCategoria(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const categoria =
      texto.trim() === '1'
        ? Categoria.MATERIAL
        : texto.trim() === '2'
          ? Categoria.PRODUCTO
          : null;
    if (!categoria) {
      return 'Respondé 1 (material) o 2 (producto).';
    }

    session.nuevoItemCategoria = categoria;
    session.step = FlowStep.NUEVO_ITEM_UNIDAD;
    this.sessionStore.guardar(telefono, session);

    return `¿Unidad de medida?\n${UNIDADES.map((u) => `${u.opcion}. ${u.etiqueta}`).join('\n')}`;
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
    this.sessionStore.guardar(telefono, session);

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
    session.step = FlowStep.NUEVO_ITEM_TIENE_COLOR;
    this.sessionStore.guardar(telefono, session);

    return '¿Tiene color? Respondé si o no.';
  }

  private manejarNuevoItemTieneColor(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): string {
    const respuesta = texto.trim().toLowerCase();
    if (respuesta !== 'si' && respuesta !== 'sí' && respuesta !== 'no') {
      return 'Respondé si o no.';
    }

    if (respuesta === 'no') {
      return this.pedirConfirmacionNuevoItem(telefono, session, null);
    }

    session.step = FlowStep.NUEVO_ITEM_COLOR;
    this.sessionStore.guardar(telefono, session);
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
    return this.pedirConfirmacionNuevoItem(telefono, session, color);
  }

  private pedirConfirmacionNuevoItem(
    telefono: string,
    session: WhatsappSession,
    colorNombre: string | null,
  ): string {
    const nombreCompleto = colorNombre
      ? `${session.nuevoItemNombre} ${colorNombre}`
      : session.nuevoItemNombre;
    return this.pedirConfirmacion(
      telefono,
      session,
      {
        tipoAccion: 'ITEM',
        nombre: session.nuevoItemNombre!,
        categoria: session.nuevoItemCategoria!,
        unidad: session.nuevoItemUnidad!,
        colorNombre,
      },
      `Vas a agregar el item *${nombreCompleto}* (${session.nuevoItemCategoria}, ${session.nuevoItemUnidad}).`,
    );
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
    this.sessionStore.reiniciar(telefono);

    if (!respuesta) {
      return `Cancelado, no se registró nada.\n\n${MENSAJE_MENU}`;
    }
    if (!accion) {
      return MENSAJE_MENU;
    }

    switch (accion.tipoAccion) {
      case 'MOVIMIENTO':
        return this.ejecutarMovimientoPendiente(negocioId, accion);
      case 'OPERARIA': {
        const operaria = await this.operariosService.create(negocioId, {
          nombre: accion.nombre,
        });
        return `✅ Operaria agregada: ${operaria.nombre}.\n\n${MENSAJE_MENU}`;
      }
      case 'ITEM': {
        const item = await this.itemsService.create(negocioId, {
          nombre: accion.nombre,
          categoria: accion.categoria,
          unidad: accion.unidad,
          tieneColor: accion.colorNombre !== null,
          colorNombre: accion.colorNombre ?? undefined,
        });
        return `✅ Item agregado: ${etiquetaItem(item)}.\n\n${MENSAJE_MENU}`;
      }
    }
  }

  private async ejecutarMovimientoPendiente(
    negocioId: string,
    accion: AccionMovimientoPendiente,
  ): Promise<string> {
    let payload = accion.payload;
    if (accion.crearOrdenParaOperario) {
      const orden = await this.ordenesProduccionService.create(negocioId, {
        operarioId: accion.crearOrdenParaOperario,
        observaciones: 'Entrega registrada por WhatsApp',
      });
      payload = { ...payload, ordenProduccionId: orden.id };
    }

    await this.movimientosService.create(negocioId, payload);
    const stock = await this.stockService.getStock(negocioId, payload.itemId);

    return `✅ Registrado: ${accion.payload.cantidad} de ${accion.etiquetaItem}.\nStock actual: ${stock}${accion.mensajeExtra ?? ''}\n\n${MENSAJE_MENU}`;
  }
}
