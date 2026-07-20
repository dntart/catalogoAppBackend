import { BadRequestException } from '@nestjs/common';
import {
  Categoria,
  Item,
  MovimientoTipo,
  Operario,
  OrdenProduccion,
  Unidad,
} from '@prisma/client';
import { ConversationService } from './conversation.service';
import { SessionStoreService } from './session-store.service';
import { ItemsService } from '../../items/items.service';
import { OperariosService } from '../../operarios/operarios.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { OrdenesProduccionService } from '../../ordenes-produccion/ordenes-produccion.service';
import { StockService } from '../../stock/stock.service';

const TELEFONO = 'whatsapp:+5491100000000';

const GABARDINA = {
  id: 'item-gabardina',
  nombre: 'Gabardina',
  colorNombre: 'Beige',
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

const MARIA = {
  id: 'operario-maria',
  nombre: 'María',
  activo: true,
} as Operario;

describe('ConversationService', () => {
  let service: ConversationService;
  let itemsService: { findAll: jest.Mock; findOne: jest.Mock };
  let operariosService: { findAll: jest.Mock; findOne: jest.Mock };
  let movimientosService: { create: jest.Mock };
  let ordenesProduccionService: { create: jest.Mock; findAll: jest.Mock };
  let stockService: { getStock: jest.Mock; getResumen: jest.Mock };

  beforeEach(() => {
    itemsService = {
      findAll: jest.fn().mockResolvedValue([GABARDINA, ZORRO]),
      findOne: jest.fn(),
    };
    itemsService.findOne.mockImplementation((id: string) =>
      Promise.resolve([GABARDINA, ZORRO].find((item) => item.id === id)),
    );
    operariosService = {
      findAll: jest.fn().mockResolvedValue([MARIA]),
      findOne: jest.fn().mockResolvedValue(MARIA),
    };
    movimientosService = {
      create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
    };
    ordenesProduccionService = {
      create: jest.fn().mockResolvedValue({
        id: 'orden-1',
        operarioId: MARIA.id,
      }),
      findAll: jest.fn().mockResolvedValue([]),
    };
    stockService = {
      getStock: jest.fn().mockResolvedValue(15),
      getResumen: jest.fn().mockResolvedValue([]),
    };

    service = new ConversationService(
      new SessionStoreService(),
      itemsService as unknown as ItemsService,
      operariosService as unknown as OperariosService,
      movimientosService as unknown as MovimientosService,
      ordenesProduccionService as unknown as OrdenesProduccionService,
      stockService as unknown as StockService,
    );
  });

  it('cualquier mensaje inicial muestra el menu principal', async () => {
    const respuesta = await service.manejarMensaje(TELEFONO, 'hola');

    expect(respuesta).toContain('Fauna de Tela');
    expect(respuesta).toContain('1️⃣ Compra de tela');
  });

  it('flujo de compra: lista materiales, pide cantidad y registra el movimiento', async () => {
    await service.manejarMensaje(TELEFONO, 'menu');
    const listado = await service.manejarMensaje(TELEFONO, '1');
    expect(listado).toContain('Gabardina Beige');

    const pideCantidad = await service.manejarMensaje(TELEFONO, '1');
    expect(pideCantidad).toContain('cantidad');

    const confirmacion = await service.manejarMensaje(TELEFONO, '10');

    expect(movimientosService.create).toHaveBeenCalledWith({
      itemId: 'item-gabardina',
      tipo: MovimientoTipo.COMPRA,
      cantidad: 10,
    });
    expect(confirmacion).toContain('Compra registrada');
    expect(confirmacion).toContain('15');
  });

  it('flujo entrega -> recepcion: vincula CONSUMO y PRODUCCION a la misma orden', async () => {
    await service.manejarMensaje(TELEFONO, 'menu');
    await service.manejarMensaje(TELEFONO, '2'); // entrega de material
    await service.manejarMensaje(TELEFONO, '1'); // selecciona a María
    await service.manejarMensaje(TELEFONO, '1'); // selecciona Gabardina
    const confirmacionEntrega = await service.manejarMensaje(TELEFONO, '5'); // cantidad

    expect(ordenesProduccionService.create).toHaveBeenCalledWith({
      operarioId: 'operario-maria',
      observaciones: 'Entrega registrada por WhatsApp',
    });
    expect(movimientosService.create).toHaveBeenCalledWith({
      itemId: 'item-gabardina',
      tipo: MovimientoTipo.CONSUMO,
      cantidad: 5,
      ordenProduccionId: 'orden-1',
    });
    expect(confirmacionEntrega).toContain('Entrega registrada');

    // ahora la orden aparece como abierta para Maria
    ordenesProduccionService.findAll.mockResolvedValue([
      {
        id: 'orden-1',
        operarioId: MARIA.id,
        fecha: new Date(),
        observaciones: 'Entrega registrada por WhatsApp',
      } as OrdenProduccion,
    ]);

    await service.manejarMensaje(TELEFONO, '3'); // recepcion de producto
    const listadoOrdenes = await service.manejarMensaje(TELEFONO, '1'); // selecciona a María
    expect(listadoOrdenes).toContain('Sin vincular');

    await service.manejarMensaje(TELEFONO, '2'); // selecciona la entrega abierta (no "sin vincular")
    await service.manejarMensaje(TELEFONO, '1'); // selecciona Zorro
    const confirmacionRecepcion = await service.manejarMensaje(TELEFONO, '3'); // cantidad

    expect(movimientosService.create).toHaveBeenCalledWith({
      itemId: 'item-zorro',
      tipo: MovimientoTipo.PRODUCCION,
      cantidad: 3,
      operarioId: 'operario-maria',
      ordenProduccionId: 'orden-1',
    });
    expect(confirmacionRecepcion).toContain('Recepción registrada');
  });

  it('propaga el error de stock insuficiente en una venta y vuelve al menu', async () => {
    movimientosService.create.mockRejectedValue(
      new BadRequestException(
        'Stock insuficiente para el item item-zorro: stock actual 2, solicitado 100',
      ),
    );

    await service.manejarMensaje(TELEFONO, 'menu');
    await service.manejarMensaje(TELEFONO, '4'); // venta
    await service.manejarMensaje(TELEFONO, '1'); // selecciona Zorro (unico producto en el catalogo mockeado)
    const respuesta = await service.manejarMensaje(TELEFONO, '100');

    expect(respuesta).toContain('⚠️');
    expect(respuesta).toContain('Stock insuficiente');
    expect(respuesta).toContain('Fauna de Tela');
  });

  it('rechaza una seleccion fuera de rango sin romper la sesion', async () => {
    await service.manejarMensaje(TELEFONO, 'menu');
    const respuesta = await service.manejarMensaje(TELEFONO, '9');

    expect(respuesta).toContain('No entendí');
    expect(respuesta).toContain('Fauna de Tela');
  });

  it('"menu" reinicia la conversacion desde cualquier paso', async () => {
    await service.manejarMensaje(TELEFONO, 'menu');
    await service.manejarMensaje(TELEFONO, '1'); // entra al flujo de compra

    const respuesta = await service.manejarMensaje(TELEFONO, 'menu');

    expect(respuesta).toContain('Fauna de Tela');
  });
});
