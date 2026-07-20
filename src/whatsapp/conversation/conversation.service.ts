import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Categoria, Item, MovimientoTipo } from '@prisma/client';
import { SessionStoreService } from './session-store.service';
import { FlowStep, OpcionListado, WhatsappSession } from './types';
import { ItemsService } from '../../items/items.service';
import { OperariosService } from '../../operarios/operarios.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { OrdenesProduccionService } from '../../ordenes-produccion/ordenes-produccion.service';
import { StockService } from '../../stock/stock.service';

const MENSAJE_MENU = [
  '👋 *Fauna de Tela*',
  '¿Qué querés registrar? Respondé con el número:',
  '',
  '1️⃣ Compra de tela',
  '2️⃣ Entrega de material a operaria',
  '3️⃣ Recepción de producto terminado',
  '4️⃣ Venta',
  '5️⃣ Ajuste de stock',
  '6️⃣ Ver stock',
  '',
  '_En cualquier momento escribí "menu" para volver acá._',
].join('\n');

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
    telefono: string,
    textoOriginal: string,
  ): Promise<string> {
    const texto = textoOriginal.trim();
    const comando = texto.toLowerCase();

    if (comando === 'menu' || comando === 'cancelar' || comando === 'hola') {
      this.sessionStore.reiniciar(telefono);
      return MENSAJE_MENU;
    }

    const session = this.sessionStore.obtener(telefono);

    try {
      switch (session.step) {
        case FlowStep.MENU:
          return await this.manejarMenu(telefono, texto, session);
        case FlowStep.COMPRA_ITEM:
          return this.manejarSeleccionCantidadPendiente(
            session,
            texto,
            FlowStep.COMPRA_CANTIDAD,
            telefono,
          );
        case FlowStep.COMPRA_CANTIDAD:
          return await this.finalizarCompra(telefono, texto, session);
        case FlowStep.ENTREGA_OPERARIO:
          return await this.manejarEntregaOperario(telefono, texto, session);
        case FlowStep.ENTREGA_ITEM:
          return this.manejarSeleccionCantidadPendiente(
            session,
            texto,
            FlowStep.ENTREGA_CANTIDAD,
            telefono,
          );
        case FlowStep.ENTREGA_CANTIDAD:
          return await this.finalizarEntrega(telefono, texto, session);
        case FlowStep.RECEPCION_OPERARIO:
          return await this.manejarRecepcionOperario(telefono, texto, session);
        case FlowStep.RECEPCION_ORDEN:
          return this.manejarRecepcionOrden(telefono, texto, session);
        case FlowStep.RECEPCION_ITEM:
          return this.manejarSeleccionCantidadPendiente(
            session,
            texto,
            FlowStep.RECEPCION_CANTIDAD,
            telefono,
          );
        case FlowStep.RECEPCION_CANTIDAD:
          return await this.finalizarRecepcion(telefono, texto, session);
        case FlowStep.VENTA_ITEM:
          return this.manejarSeleccionCantidadPendiente(
            session,
            texto,
            FlowStep.VENTA_CANTIDAD,
            telefono,
          );
        case FlowStep.VENTA_CANTIDAD:
          return await this.finalizarVenta(telefono, texto, session);
        case FlowStep.AJUSTE_ITEM:
          return this.manejarSeleccionCantidadPendiente(
            session,
            texto,
            FlowStep.AJUSTE_CANTIDAD,
            telefono,
          );
        case FlowStep.AJUSTE_CANTIDAD:
          return await this.finalizarAjuste(telefono, texto, session);
        case FlowStep.STOCK_CATEGORIA:
          return await this.finalizarStock(telefono, texto);
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
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    switch (texto.trim()) {
      case '1':
        return this.pedirItem(
          session,
          Categoria.MATERIAL,
          FlowStep.COMPRA_ITEM,
          '¿Qué material compraste?',
        );
      case '2':
        return this.pedirOperario(
          session,
          FlowStep.ENTREGA_OPERARIO,
          '¿A qué operaria le entregás material?',
        );
      case '3':
        return this.pedirOperario(
          session,
          FlowStep.RECEPCION_OPERARIO,
          '¿Qué operaria trae el producto terminado?',
        );
      case '4':
        return this.pedirItem(
          session,
          Categoria.PRODUCTO,
          FlowStep.VENTA_ITEM,
          '¿Qué producto vendiste?',
        );
      case '5':
        return this.pedirItem(
          session,
          undefined,
          FlowStep.AJUSTE_ITEM,
          '¿Qué item querés ajustar?',
        );
      case '6': {
        session.step = FlowStep.STOCK_CATEGORIA;
        session.opciones = [];
        this.sessionStore.guardar(telefono, session);
        return '¿Stock de qué querés ver?\n1. Materiales\n2. Productos\n3. Todo';
      }
      default:
        return `No entendí esa opción.\n\n${MENSAJE_MENU}`;
    }
  }

  private async pedirItem(
    session: WhatsappSession,
    categoria: Categoria | undefined,
    siguienteStep: FlowStep,
    pregunta: string,
  ): Promise<string> {
    const items = await this.itemsService.findAll(true);
    const filtrados = categoria
      ? items.filter((item) => item.categoria === categoria)
      : items;
    const opciones: OpcionListado[] = filtrados.map((item) => ({
      id: item.id,
      etiqueta: etiquetaItem(item),
    }));

    session.step = siguienteStep;
    session.opciones = opciones;

    return `${pregunta}\n${construirListado(opciones)}`;
  }

  private async pedirOperario(
    session: WhatsappSession,
    siguienteStep: FlowStep,
    pregunta: string,
  ): Promise<string> {
    const operarios = await this.operariosService.findAll(true);
    const opciones: OpcionListado[] = operarios.map((op) => ({
      id: op.id,
      etiqueta: op.nombre,
    }));

    session.step = siguienteStep;
    session.opciones = opciones;

    return `${pregunta}\n${construirListado(opciones)}`;
  }

  private manejarSeleccionCantidadPendiente(
    session: WhatsappSession,
    texto: string,
    siguienteStep: FlowStep,
    telefono: string,
  ): string {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion || !seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }

    session.itemId = seleccion.id;
    session.step = siguienteStep;
    this.sessionStore.guardar(telefono, session);

    return `¿Cuánta cantidad? (podés escribir con decimales, ej: 5.5)`;
  }

  private async finalizarCompra(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null || cantidad <= 0) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    const item = await this.itemsService.findOne(session.itemId!);
    await this.movimientosService.create({
      itemId: item.id,
      tipo: MovimientoTipo.COMPRA,
      cantidad,
    });
    const stock = await this.stockService.getStock(item.id);

    this.sessionStore.reiniciar(telefono);
    return `✅ Compra registrada: ${cantidad} de ${etiquetaItem(item)}.\nStock actual: ${stock}\n\n${MENSAJE_MENU}`;
  }

  private async manejarEntregaOperario(
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
      session,
      Categoria.MATERIAL,
      FlowStep.ENTREGA_ITEM,
      '¿Qué material le entregás?',
    );
  }

  private async finalizarEntrega(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null || cantidad <= 0) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    const item = await this.itemsService.findOne(session.itemId!);
    const operario = await this.operariosService.findOne(session.operarioId!);
    const orden = await this.ordenesProduccionService.create({
      operarioId: operario.id,
      observaciones: 'Entrega registrada por WhatsApp',
    });
    await this.movimientosService.create({
      itemId: item.id,
      tipo: MovimientoTipo.CONSUMO,
      cantidad,
      ordenProduccionId: orden.id,
    });
    const stock = await this.stockService.getStock(item.id);

    this.sessionStore.reiniciar(telefono);
    return (
      `✅ Entrega registrada: ${cantidad} de ${etiquetaItem(item)} para ${operario.nombre}.\n` +
      `Stock actual: ${stock}\n` +
      `Cuando te traiga el producto terminado, elegí la opción 3 del menú y vas a poder vincularlo a esta misma entrega.\n\n${MENSAJE_MENU}`
    );
  }

  private async manejarRecepcionOperario(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const seleccion = parseSeleccion(texto, session.opciones);
    if (!seleccion || !seleccion.id) {
      return `No entendí esa opción, respondé con el número de la lista.\n${construirListado(session.opciones)}`;
    }
    session.operarioId = seleccion.id;

    const ordenes = await this.ordenesProduccionService.findAll(seleccion.id);
    if (ordenes.length === 0) {
      this.sessionStore.guardar(telefono, session);
      return this.pedirItem(
        session,
        Categoria.PRODUCTO,
        FlowStep.RECEPCION_ITEM,
        '¿Qué producto terminado trae?',
      );
    }

    const opciones: OpcionListado[] = [
      { id: null, etiqueta: 'Sin vincular a ninguna entrega' },
      ...ordenes.slice(0, 5).map((orden) => ({
        id: orden.id,
        etiqueta: `Entrega del ${new Date(orden.fecha).toLocaleDateString()}${orden.observaciones ? ` — ${orden.observaciones}` : ''}`,
      })),
    ];
    session.step = FlowStep.RECEPCION_ORDEN;
    session.opciones = opciones;
    this.sessionStore.guardar(telefono, session);

    return `¿A qué entrega corresponde este producto?\n${construirListado(opciones)}`;
  }

  private manejarRecepcionOrden(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> | string {
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
      session,
      Categoria.PRODUCTO,
      FlowStep.RECEPCION_ITEM,
      '¿Qué producto terminado trae?',
    );
  }

  private async finalizarRecepcion(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null || cantidad <= 0) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    const item = await this.itemsService.findOne(session.itemId!);
    const operario = await this.operariosService.findOne(session.operarioId!);
    await this.movimientosService.create({
      itemId: item.id,
      tipo: MovimientoTipo.PRODUCCION,
      cantidad,
      operarioId: operario.id,
      ordenProduccionId: session.ordenProduccionId ?? undefined,
    });
    const stock = await this.stockService.getStock(item.id);

    this.sessionStore.reiniciar(telefono);
    return `✅ Recepción registrada: ${cantidad} de ${etiquetaItem(item)} de ${operario.nombre}.\nStock actual: ${stock}\n\n${MENSAJE_MENU}`;
  }

  private async finalizarVenta(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null || cantidad <= 0) {
      return 'Ingresá un número mayor a cero para la cantidad.';
    }

    const item = await this.itemsService.findOne(session.itemId!);
    await this.movimientosService.create({
      itemId: item.id,
      tipo: MovimientoTipo.VENTA,
      cantidad,
    });
    const stock = await this.stockService.getStock(item.id);

    this.sessionStore.reiniciar(telefono);
    return `✅ Venta registrada: ${cantidad} de ${etiquetaItem(item)}.\nStock actual: ${stock}\n\n${MENSAJE_MENU}`;
  }

  private async finalizarAjuste(
    telefono: string,
    texto: string,
    session: WhatsappSession,
  ): Promise<string> {
    const cantidad = parseCantidad(texto);
    if (cantidad === null) {
      return 'Ingresá un número distinto de cero (puede ser negativo, ej: -2).';
    }

    const item = await this.itemsService.findOne(session.itemId!);
    await this.movimientosService.create({
      itemId: item.id,
      tipo: MovimientoTipo.AJUSTE,
      cantidad,
    });
    const stock = await this.stockService.getStock(item.id);

    this.sessionStore.reiniciar(telefono);
    return `✅ Ajuste registrado: ${cantidad > 0 ? '+' : ''}${cantidad} de ${etiquetaItem(item)}.\nStock actual: ${stock}\n\n${MENSAJE_MENU}`;
  }

  private async finalizarStock(
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
      categoriaPorOpcion[opcion],
    );
    this.sessionStore.reiniciar(telefono);

    if (resumen.length === 0) {
      return `No hay items cargados en esa categoría.\n\n${MENSAJE_MENU}`;
    }

    const lineas = resumen
      .map((r) => `• ${r.nombre}: ${r.stock} ${r.unidad.toLowerCase()}`)
      .join('\n');
    return `📦 *Stock actual*\n${lineas}\n\n${MENSAJE_MENU}`;
  }
}
