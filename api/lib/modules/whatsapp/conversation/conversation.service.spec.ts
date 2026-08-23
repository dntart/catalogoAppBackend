import { BadRequestError as BadRequestException } from '../../../auth';
import {
  Categoria,
  Item,
  MovimientoTipo,
  Operario,
  Unidad,
} from '@prisma/client';
import { ConversationService } from './conversation.service';
import type { SessionStoreService } from './session-store.service';
import { nuevaSesion, WhatsappSession } from './types';
import { ItemsService } from '../../items/items.service';
import { OperariosService } from '../../operarios/operarios.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { OrdenesProduccionService } from '../../ordenes-produccion/ordenes-produccion.service';
import { StockService } from '../../stock/stock.service';

const NEGOCIO_ID = 'negocio-1';
const TELEFONO = 'whatsapp:+5491100000000';

const GABARDINA_BEIGE = {
  id: 'item-gabardina-beige',
  nombre: 'Gabardina',
  colorNombre: 'Beige',
  categoria: Categoria.MATERIAL,
  unidad: Unidad.METRO,
  activo: true,
} as Item;

const GABARDINA_NEGRO = {
  id: 'item-gabardina-negro',
  nombre: 'Gabardina',
  colorNombre: 'Negro',
  categoria: Categoria.MATERIAL,
  unidad: Unidad.METRO,
  activo: true,
} as Item;

const ZORRO = {
  id: 'item-zorro',
  nombre: 'Zorro',
  colorNombre: null,
  categoria: Categoria.PRODUCTO,
  unidad: Unidad.UNIDAD,
  activo: true,
} as Item;

const HILO_POLIESTER_BLANCO = {
  id: 'item-hilo-poliester-blanco',
  grupo: 'Hilo',
  nombre: 'Poliéster',
  colorNombre: 'Blanco',
  categoria: Categoria.MATERIAL,
  unidad: Unidad.CONO,
  activo: true,
} as Item;

const HILO_ALGODON_BLANCO = {
  id: 'item-hilo-algodon-blanco',
  grupo: 'Hilo',
  nombre: 'Algodón',
  colorNombre: 'Blanco',
  categoria: Categoria.MATERIAL,
  unidad: Unidad.CONO,
  activo: true,
} as Item;

const CATALOGO = [GABARDINA_BEIGE, GABARDINA_NEGRO, ZORRO];
const CATALOGO_CON_GRUPO = [
  ...CATALOGO,
  HILO_POLIESTER_BLANCO,
  HILO_ALGODON_BLANCO,
];

const MARIA = {
  id: 'operario-maria',
  nombre: 'María',
  activo: true,
} as Operario;

/** Doble en memoria de SessionStoreService (que en producción persiste en
 * Postgres) — acá alcanza con memoria, el test no ejercita esa persistencia. */
class SessionStoreServiceFake {
  private readonly sesiones = new Map<string, WhatsappSession>();

  async obtener(telefono: string): Promise<WhatsappSession> {
    return this.sesiones.get(telefono) ?? nuevaSesion();
  }

  async guardar(telefono: string, session: WhatsappSession): Promise<void> {
    this.sesiones.set(telefono, session);
  }

  async reiniciar(telefono: string): Promise<WhatsappSession> {
    const sesion = nuevaSesion();
    this.sesiones.set(telefono, sesion);
    return sesion;
  }
}

describe('ConversationService', () => {
  let service: ConversationService;
  let itemsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let operariosService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let movimientosService: { create: jest.Mock; findAll: jest.Mock };
  let ordenesProduccionService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
  };
  let stockService: { getStock: jest.Mock; getResumen: jest.Mock };

  beforeEach(() => {
    itemsService = {
      findAll: jest.fn().mockResolvedValue(CATALOGO),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    itemsService.findOne.mockImplementation((_negocioId: string, id: string) =>
      Promise.resolve(CATALOGO.find((item) => item.id === id)),
    );
    operariosService = {
      findAll: jest.fn().mockResolvedValue([MARIA]),
      findOne: jest.fn().mockResolvedValue(MARIA),
      create: jest.fn(),
    };
    movimientosService = {
      create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      findAll: jest.fn().mockResolvedValue([]),
    };
    ordenesProduccionService = {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'orden-1', operarioId: MARIA.id }),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    stockService = {
      getStock: jest.fn().mockResolvedValue(15),
      getResumen: jest.fn().mockResolvedValue([]),
    };

    service = new ConversationService(
      new SessionStoreServiceFake() as unknown as SessionStoreService,
      itemsService as unknown as ItemsService,
      operariosService as unknown as OperariosService,
      movimientosService as unknown as MovimientosService,
      ordenesProduccionService as unknown as OrdenesProduccionService,
      stockService as unknown as StockService,
    );
  });

  it('cualquier mensaje inicial muestra el menu principal', async () => {
    const respuesta = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'hola',
    );

    expect(respuesta).toContain('StockAsist');
    expect(respuesta).toContain('1️⃣ Compra de tela');
  });

  it('flujo de compra con color: nombre -> color -> cantidad -> confirmar -> registra', async () => {
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    const listadoNombres = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '1',
    );
    expect(listadoNombres).toContain('Gabardina');
    expect(listadoNombres).not.toContain('Beige');

    const listadoColores = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '1',
    );
    expect(listadoColores).toContain('Beige');
    expect(listadoColores).toContain('Negro');

    const pideCantidad = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '1',
    );
    expect(pideCantidad).toContain('cantidad');

    const pideConfirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '10',
    );
    expect(pideConfirmacion).toContain('Confirmás');
    expect(movimientosService.create).not.toHaveBeenCalled();

    const confirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'si',
    );

    expect(movimientosService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      itemId: 'item-gabardina-beige',
      tipo: MovimientoTipo.COMPRA,
      cantidad: 10,
    });
    expect(confirmacion).toContain('Registrado');
    expect(confirmacion).toContain('15');
  });

  it('sin variantes de color, salta directo de nombre a cantidad', async () => {
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '5'); // ajuste: todos los items (Gabardina, Zorro)
    const pideCantidad = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '2',
    ); // Zorro
    expect(pideCantidad).toContain('cantidad');

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '-3');
    const confirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'si',
    );

    expect(movimientosService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      itemId: 'item-zorro',
      tipo: MovimientoTipo.AJUSTE,
      cantidad: -3,
    });
    expect(confirmacion).toContain('Registrado');
  });

  it('items con grupo: primero pide el grupo, despues el nombre dentro de ese grupo', async () => {
    itemsService.findAll.mockResolvedValue(CATALOGO_CON_GRUPO);
    itemsService.findOne.mockImplementation((_negocioId: string, id: string) =>
      Promise.resolve(CATALOGO_CON_GRUPO.find((item) => item.id === id)),
    );

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    const listadoGrupos = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '1', // compra
    );
    // Gabardina no tiene grupo -> aparece como "Otros"; Hilo si tiene grupo.
    expect(listadoGrupos).toContain('Hilo');
    expect(listadoGrupos).toContain('Otros');
    expect(listadoGrupos).not.toContain('Poliéster');

    const listadoNombres = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '1', // grupo "Hilo"
    );
    expect(listadoNombres).toContain('Poliéster');
    expect(listadoNombres).toContain('Algodón');
    expect(listadoNombres).not.toContain('Gabardina');

    const pideCantidad = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '2', // Poliéster (unico color, no pide color aparte)
    );
    expect(pideCantidad).toContain('cantidad');

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '10');
    const confirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'si',
    );

    expect(movimientosService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      itemId: 'item-hilo-poliester-blanco',
      tipo: MovimientoTipo.COMPRA,
      cantidad: 10,
    });
    expect(confirmacion).toContain('Registrado');
  });

  it('responder "no" en la confirmacion cancela sin registrar nada', async () => {
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '5');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '2'); // Zorro
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '4');
    const respuesta = await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'no');

    expect(movimientosService.create).not.toHaveBeenCalled();
    expect(respuesta).toContain('Cancelado');
    expect(respuesta).toContain('StockAsist');
  });

  it('flujo entrega -> recepcion: vincula CONSUMO y PRODUCCION a la misma orden', async () => {
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '2'); // entrega de material
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // selecciona a María
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // Gabardina
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // Beige
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '5'); // cantidad
    const confirmacionEntrega = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'si',
    );

    expect(ordenesProduccionService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      operarioId: 'operario-maria',
      observaciones: 'Entrega registrada por WhatsApp',
    });
    expect(movimientosService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      itemId: 'item-gabardina-beige',
      tipo: MovimientoTipo.CONSUMO,
      cantidad: 5,
      ordenProduccionId: 'orden-1',
    });
    expect(confirmacionEntrega).toContain('Registrado');

    // ahora la orden aparece como abierta para Maria, con su detalle de consumo
    ordenesProduccionService.findAll.mockResolvedValue([
      {
        id: 'orden-1',
        operarioId: MARIA.id,
        fecha: new Date(),
        observaciones: 'Entrega registrada por WhatsApp',
      },
    ]);
    ordenesProduccionService.findOne.mockResolvedValue({
      id: 'orden-1',
      operarioId: MARIA.id,
      movimientos: [
        {
          tipo: MovimientoTipo.CONSUMO,
          cantidad: 5,
          item: { nombre: 'Gabardina', colorNombre: 'Beige' },
        },
      ],
    });

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '3'); // recepcion de producto
    const listadoOrdenes = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '1',
    ); // selecciona a María
    expect(listadoOrdenes).toContain('Sin vincular');
    expect(listadoOrdenes).toContain('Gabardina Beige');

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '2'); // selecciona la entrega abierta (no "sin vincular")
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // Zorro
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '3'); // cantidad
    const confirmacionRecepcion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'si',
    );

    expect(movimientosService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      itemId: 'item-zorro',
      tipo: MovimientoTipo.PRODUCCION,
      cantidad: 3,
      operarioId: 'operario-maria',
      ordenProduccionId: 'orden-1',
    });
    expect(confirmacionRecepcion).toContain('Registrado');
  });

  it('propaga el error de stock insuficiente al confirmar una venta, y vuelve al menu', async () => {
    movimientosService.create.mockRejectedValue(
      new BadRequestException(
        'Stock insuficiente de Zorro: stock actual 2, solicitado 100',
      ),
    );

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '4'); // venta
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // Zorro (unico producto)
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '100');
    const respuesta = await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'si');

    expect(respuesta).toContain('⚠️');
    expect(respuesta).toContain('Stock insuficiente');
    expect(respuesta).toContain('StockAsist');
  });

  it('rechaza una seleccion fuera de rango sin romper la sesion', async () => {
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    const respuesta = await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '99');

    expect(respuesta).toContain('No entendí');
    expect(respuesta).toContain('StockAsist');
  });

  it('"menu" y "0" reinician la conversacion desde cualquier paso', async () => {
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // entra al flujo de compra

    const respuestaMenu = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'menu',
    );
    expect(respuestaMenu).toContain('StockAsist');

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1');
    const respuestaCero = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      '0',
    );
    expect(respuestaCero).toContain('StockAsist');
  });

  it('flujo agregar operaria: pide el nombre, confirma y la crea', async () => {
    operariosService.create.mockResolvedValue({
      id: 'operario-lujan',
      nombre: 'Luján',
    });

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    const pideNombre = await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '7');
    expect(pideNombre).toContain('¿Cómo se llama');

    const pideConfirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'Luján',
    );
    expect(pideConfirmacion).toContain('Confirmás');
    expect(operariosService.create).not.toHaveBeenCalled();

    const confirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'si',
    );

    expect(operariosService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      nombre: 'Luján',
    });
    expect(confirmacion).toContain('Operaria agregada');
    expect(confirmacion).toContain('Luján');
  });

  it('flujo agregar item sin color: pide categoria, unidad, nombre, confirma y crea el item', async () => {
    itemsService.create.mockResolvedValue({
      id: 'item-vellon',
      nombre: 'Vellón',
      colorNombre: null,
      unidad: Unidad.KG,
    });

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '8');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // material
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '2'); // unidad: Kg
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'Vellón');
    const pideGrupo = await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'no'); // sin grupo
    expect(pideGrupo).toContain('color');

    const pideConfirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'no',
    ); // sin color
    expect(pideConfirmacion).toContain('Confirmás');
    expect(itemsService.create).not.toHaveBeenCalled();

    const confirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'si',
    );

    expect(itemsService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      grupo: undefined,
      nombre: 'Vellón',
      categoria: Categoria.MATERIAL,
      unidad: Unidad.KG,
      tieneColor: false,
      colorNombre: undefined,
    });
    expect(confirmacion).toContain('Item agregado');
  });

  it('flujo agregar item con color: pide el color antes de confirmar', async () => {
    itemsService.create.mockResolvedValue({
      id: 'item-pana',
      nombre: 'Pana',
      colorNombre: 'Negro',
      unidad: Unidad.METRO,
    });

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '8');
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // material
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '1'); // unidad: Metro
    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'Pana');
    const pideTieneColor = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'Telares', // grupo
    );
    expect(pideTieneColor).toContain('color');

    const pideColor = await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'si');
    expect(pideColor).toContain('color');

    const pideConfirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'Negro',
    );
    expect(pideConfirmacion).toContain('Confirmás');
    expect(pideConfirmacion).toContain('Telares');

    const confirmacion = await service.manejarMensaje(
      NEGOCIO_ID,
      TELEFONO,
      'si',
    );

    expect(itemsService.create).toHaveBeenCalledWith(NEGOCIO_ID, {
      grupo: 'Telares',
      nombre: 'Pana',
      categoria: Categoria.MATERIAL,
      unidad: Unidad.METRO,
      tieneColor: true,
      colorNombre: 'Negro',
    });
    expect(confirmacion).toContain('Item agregado');
  });

  it('opcion 9 muestra los ultimos movimientos con nombre de item y signo segun tipo', async () => {
    movimientosService.findAll.mockResolvedValue([
      {
        fecha: new Date('2026-07-20'),
        tipo: MovimientoTipo.COMPRA,
        cantidad: '10.00',
        item: { nombre: 'Gabardina', colorNombre: 'Beige' },
      },
      {
        fecha: new Date('2026-07-19'),
        tipo: MovimientoTipo.VENTA,
        cantidad: '2.00',
        item: { nombre: 'Zorro', colorNombre: null },
      },
    ]);

    await service.manejarMensaje(NEGOCIO_ID, TELEFONO, 'menu');
    const respuesta = await service.manejarMensaje(NEGOCIO_ID, TELEFONO, '9');

    expect(respuesta).toContain('Gabardina Beige');
    expect(respuesta).toContain('+10.00');
    expect(respuesta).toContain('Zorro');
    expect(respuesta).toContain('-2.00');
  });
});
