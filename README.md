# StockAsist

Sistema de gestión de producción e inventario multi-tenant (SaaS) para emprendimientos textiles. Lleva el catálogo de productos y materiales, registra quién hizo qué movimiento (compra, consumo, producción, venta, ajuste) y calcula el stock siempre a partir de ese historial — nunca se edita un número de stock a mano. Cada negocio (`Negocio`) tiene sus propios datos, completamente aislados de los demás, y puede operar tanto desde la API/Swagger como desde un bot de WhatsApp.

> "Fauna de Tela" es el primer cliente real del sistema (una fábrica de muñecos de tela), no el nombre del producto — vas a ver ese nombre como dato de ejemplo en el seed y en algunos ejemplos, no como marca.

Este documento cubre dos cosas: cómo funciona el sistema tal como está hoy, y cómo replicar el proceso completo de armado desde cero (útil si querés adaptar esta misma base a otro rubro/negocio).

---

## Índice

1. [Stack](#stack)
2. [Arquitectura](#arquitectura)
3. [Multi-tenancy](#multi-tenancy)
4. [Modelo de datos](#modelo-de-datos)
5. [Motor de stock](#motor-de-stock)
6. [Trazabilidad: entrega de material → producto terminado](#trazabilidad-entrega-de-material--producto-terminado)
7. [Autenticación](#autenticación)
8. [Alta de negocios](#alta-de-negocios)
9. [Seguridad](#seguridad)
10. [Bot de WhatsApp](#bot-de-whatsapp)
11. [Panel web](#panel-web)
12. [Deploy en producción](#deploy-en-producción)
13. [Guía de uso para el dueño del negocio](#guía-de-uso-para-el-dueño-del-negocio)
14. [Puesta en marcha (proyecto ya clonado)](#puesta-en-marcha-proyecto-ya-clonado)
15. [Variables de entorno](#variables-de-entorno)
16. [Scripts disponibles](#scripts-disponibles)
17. [API — endpoints](#api--endpoints)
18. [Testing](#testing)
19. [Troubleshooting](#troubleshooting)
20. [Cómo se construyó desde cero (guía de replicación)](#cómo-se-construyó-desde-cero-guía-de-replicación)
21. [Cómo adaptar esta base a otro negocio](#cómo-adaptar-esta-base-a-otro-negocio)

---

## Stack

- **NestJS** + **TypeScript** (modo `strict`, prohibido `any` — ver `eslint.config.mjs`)
- **Prisma 6** como ORM, generador clásico `prisma-client-js`
- **PostgreSQL 16**, corriendo en Docker vía `docker-compose.yml`
- **class-validator** / **class-transformer** para DTOs
- **@nestjs/swagger** para documentación OpenAPI interactiva (`/docs`)
- **@nestjs/jwt** + **passport-jwt** + **bcrypt** para autenticación
- **twilio** (SDK oficial) para el bot de WhatsApp
- **Jest** para tests unitarios

## Arquitectura

Un módulo por dominio (`items`, `operarios`, `movimientos`, `stock`), cada uno con separación estricta en tres capas:

```
Controller  → solo HTTP: recibe el DTO, delega, devuelve la respuesta
Service     → reglas de negocio y validaciones
Repository  → única capa que toca Prisma / la base de datos
```

Ningún Controller llama a un Repository directamente, y ningún Service arma queries de Prisma a mano — eso vive únicamente en el Repository correspondiente.

```
src/
  prisma/           PrismaService global (conecta/desconecta el cliente)
  users/            Repository/Service internos, sin controller (lo usa auth)
  auth/             Login JWT, guard global, decorator @Public
  items/            Catálogo de materiales y productos
  operarios/         Personas que hacen movimientos (ej. María, Luján)
  movimientos/       Ledger de entradas/salidas de stock
  stock/            Motor de cálculo de stock (lee movimientos, no los escribe)
```

`movimientos` depende de `stock`, `items` y `operarios` (para validar existencia y stock antes de crear un movimiento). `stock` no depende de `movimientos`: consulta la tabla `movimientos` directamente vía su propio repository, evitando un ciclo de módulos.

## Multi-tenancy

El sistema es multi-tenant desde el modelo de datos: todas las tablas de negocio (`Item`, `Operario`, `Movimiento`, `OrdenProduccion`, `User`) tienen una columna `negocioId` que las liga a un `Negocio`. Es una base de datos compartida (no una DB ni un schema por cliente) — la elección correcta para esta etapa: más simple de operar y migrar que aislar por schema/DB, y suficiente mientras el volumen por tenant sea chico.

**El aislamiento se fuerza por firma de método, no solo por convención**: todo método público de cada `Repository`/`Service` recibe `negocioId` como **primer parámetro obligatorio**, así que es un error de compilación de TypeScript olvidarse de filtrarlo — no depende de que alguien recuerde agregar un `where: { negocioId }` a mano en cada query nueva.

```ts
// ejemplo real, src/items/items.repository.ts
findById(negocioId: string, id: string): Promise<Item | null> {
  return this.prisma.item.findFirst({ where: { id, negocioId } });
}
```

Notar `findFirst` en vez de `findUnique`: como la unicidad de `id` ya no alcanza para saber que ese registro pertenece a este tenant, hay que filtrar por ambos campos en la misma query (`findUnique` sólo acepta filtrar por campos únicos).

**De dónde sale el `negocioId` en cada request**: viaja dentro del JWT (`negocioId` en el payload, ver [Autenticación](#autenticación)) y el `Controller` lo extrae de `@CurrentUser()` — nunca del body ni de un query param, así que un usuario no puede pedir datos de otro negocio ni aunque lo intente a propósito. En el bot de WhatsApp, se resuelve a partir del número de teléfono entrante (ver [Bot de WhatsApp](#bot-de-whatsapp)).

## Modelo de datos

`prisma/schema.prisma` define:

**Enums**
- `Categoria`: `MATERIAL` | `PRODUCTO`
- `Unidad`: `METRO` | `KG` | `CONO` | `UNIDAD`
- `MovimientoTipo`: `COMPRA` | `CONSUMO` | `PRODUCCION` | `VENTA` | `AJUSTE`

**Negocio** — el tenant. Raíz de la que cuelga todo lo demás.
| campo | tipo |
|---|---|
| id | String (uuid) |
| nombre | String |
| activo | Boolean |
| createdAt | DateTime |

**User** — el dueño del emprendimiento (o cualquier otra persona con acceso a la app; no confundir con `Operario`, ver [Autenticación](#autenticación))
| campo | tipo | notas |
|---|---|---|
| id | String (uuid) | |
| negocioId | String | FK a `Negocio` — a qué tenant pertenece este usuario |
| email | String (unique) | único en toda la plataforma, no solo dentro del negocio |
| passwordHash | String | |
| nombre | String | |
| whatsappNumber | String? (unique) | número de WhatsApp vinculado; el bot lo usa para resolver a qué negocio pertenece un mensaje entrante |
| esSuperAdmin | Boolean | privilegio de plataforma, no de negocio — habilita `POST /admin/negocios` (ver [Alta de negocios](#alta-de-negocios)) |
| activo | Boolean | |
| createdAt | DateTime | |

**Item** — catálogo de materiales y productos
| campo | tipo | notas |
|---|---|---|
| id | String (uuid) | |
| negocioId | String | FK a `Negocio` |
| codigo | String | autogenerado (`MAT-0007`, `PROD-0012`, ...), nunca lo escribe el usuario — ver más abajo |
| nombre | String | ej. "Gabardina", "Zorro" |
| categoria | Categoria | |
| unidad | Unidad | |
| tieneColor | Boolean | si es `false`, `colorNombre` siempre es `null` |
| colorNombre | String? | solo relevante si `tieneColor` |
| imagenUrl | String? | |
| stockMinimo | Decimal(10,2)? | opcional; si está seteado, `GET /stock` marca el item con `bajoMinimo: true` cuando el stock calculado cae a ese valor o por debajo (ver [Motor de stock](#motor-de-stock)) |
| activo | Boolean | soft-flag, no hay borrado físico |
| createdAt | DateTime | |

Unique compuesto `(negocioId, nombre, colorNombre)` — mismo nombre/color puede repetirse entre negocios distintos, no dentro del mismo. También hay un unique compuesto `(negocioId, codigo)`.

**Código autogenerado (`Item.codigo`)**: soluciona el caso de dos variantes que comparten nombre/color pero no son el mismo item — ej. "Pollera" marrón hecha de Corderoy vs. de Gabardina, donde forzar toda esa diferencia dentro del nombre lo vuelve largo e inmanejable. Cada categoría tiene su propia numeración (`MAT-` para `MATERIAL`, `PROD-` para `PRODUCTO`), asignada por `ItemsRepository.create()` dentro de la misma transacción que crea el item:

```ts
// src/items/items.repository.ts — simplificado
const secuencia = await tx.secuenciaCodigo.upsert({
  where: { negocioId_categoria: { negocioId, categoria } },
  update: { ultimoValor: { increment: 1 } },
  create: { negocioId, categoria, ultimoValor: 1 },
});
const codigo = `${prefijo}-${String(secuencia.ultimoValor).padStart(4, '0')}`;
```

El contador vive en su propia tabla (`SecuenciaCodigo`, una fila por `negocioId` + `categoria`) para que el incremento sea atómico a nivel de fila de Postgres — dos altas simultáneas del mismo negocio nunca terminan con el mismo código, sin necesidad de reintentos ni locks manuales.

**Operario** — quién hace el movimiento
| campo | tipo |
|---|---|
| id | String (uuid) |
| negocioId | String (FK a `Negocio`) |
| nombre | String |
| activo | Boolean |
| createdAt | DateTime |

**Movimiento** — el ledger. Es append-only: no tiene endpoint de edición ni de borrado.
| campo | tipo | notas |
|---|---|---|
| id | String (uuid) | |
| negocioId | String | FK a `Negocio` |
| itemId | String | FK a Item |
| operarioId | String? | FK a Operario, opcional (una `COMPRA` a proveedor no siempre tiene un operario asociado). Si el movimiento pertenece a una `OrdenProduccion`, se autocompleta con el operario de esa orden |
| ordenProduccionId | String? | FK a `OrdenProduccion`, opcional — agrupa la tela entregada (`CONSUMO`) y el producto devuelto (`PRODUCCION`) de una misma entrega |
| tipo | MovimientoTipo | |
| cantidad | Decimal(10,2) | positiva salvo en `AJUSTE` (ver más abajo) |
| fecha | DateTime | default `now()`, puede informarse explícitamente |
| observaciones | String? | |
| createdAt | DateTime | |

`OrdenProduccion` tiene la misma columna `negocioId` que el resto, con el mismo propósito de aislamiento.

## Motor de stock

El stock de un `Item` **nunca se persiste como columna**. Se calcula on-the-fly sumando y restando todos sus `Movimiento` (`src/stock/stock.service.ts`):

- **Entradas (suman):** `COMPRA`, `PRODUCCION`
- **Salidas (restan):** `CONSUMO`, `VENTA`
- **AJUSTE:** la `cantidad` viaja con signo — positiva suma, negativa resta. Es el único tipo donde `cantidad` puede ser negativa; para el resto, el `Service` rechaza `cantidad <= 0` antes de llegar a la base.

Antes de crear un movimiento de `CONSUMO` o `VENTA`, `MovimientosService.create()` llama a `StockService.validarStockSuficiente(itemId, cantidad)`, que recalcula el stock actual y lanza `BadRequestException` si la operación lo dejaría negativo. No hay ningún endpoint `PATCH /stock` — la única forma de modificar stock es insertar un `Movimiento`.

Los cálculos usan `Prisma.Decimal` en vez de `number` en los pasos intermedios para evitar errores de redondeo de punto flotante al sumar/restar cantidades.

**Alertas de stock bajo**: `Item.stockMinimo` es un umbral opcional por item. `GET /stock` calcula, además del stock, un flag `bajoMinimo: true` cuando `stockMinimo` está seteado y el stock calculado es `<= stockMinimo`. Es deliberadamente simple — no hay notificaciones push ni email todavía, es un campo que un frontend puede leer para pintar el item en rojo/con un ícono de alerta. El bot de WhatsApp también lo usa: el flujo "Ver stock" antepone ⚠️ a los items bajo mínimo.

## Trazabilidad: entrega de material → producto terminado

`OrdenProduccion` (`/ordenes-produccion`) agrupa una entrega puntual: "le doy tela a María" y, más tarde, "María me devuelve los muñecos terminados". Sin esto, un `CONSUMO` y una `PRODUCCION` son dos filas de ledger sin relación entre sí; con esto, se pueden agrupar bajo el mismo `ordenProduccionId`.

- `POST /ordenes-produccion` — abre una orden para un `operarioId`.
- `POST /movimientos` con `ordenProduccionId` — el `CONSUMO` (material que sale) y la `PRODUCCION` (producto que vuelve) quedan linkeados a esa orden. El `operarioId` **se autocompleta desde la orden**, no hace falta repetirlo.
- `GET /ordenes-produccion/:id` — la orden con todos sus movimientos.
- `GET /ordenes-produccion/:id/resumen` — total consumido/producido por item dentro de esa orden (agregado con `groupBy`, mismo patrón que `StockService`).

No hay estados (abierta/cerrada) en esta versión — una orden queda simplemente disponible para seguir agregándole movimientos indefinidamente; si hace falta "cerrarla" más adelante es un campo fácil de sumar sin romper lo existente.

## Autenticación

`User` y `Operario` son conceptos distintos y no deben confundirse:

- **`User`** es quien usa la aplicación — hoy, el dueño del emprendimiento. Tiene email + contraseña y es quien hace login.
- **`Operario`** (María, Luján) **no tiene login ni contraseña**: es solo una etiqueta (`operarioId`) dentro de `Movimiento` para registrar a quién se le entregó material o quién produjo. El dueño es el único que interactúa con el sistema; los operarios no cargan nada ellos mismos.

Login vía JWT (`src/auth`):

- `POST /auth/login` (público, `@Public()`) — recibe `{ email, password }`, devuelve `{ accessToken }`. El token expira según `JWT_EXPIRES_IN` (default `7d`).
- `GET /auth/me` (protegido) — devuelve el usuario autenticado a partir del token.
- **El payload del JWT incluye `negocioId`** (`{ sub, email, negocioId }`) — es la fuente de verdad de a qué tenant pertenece cada request; todo `Controller` lo lee vía `@CurrentUser()` y lo pasa como primer parámetro a su `Service` (ver [Multi-tenancy](#multi-tenancy)). No hace falta ni se acepta un `negocioId` en el body o la URL de ningún endpoint de negocio.
- **Todas las demás rutas están protegidas por default** vía un `JwtAuthGuard` global (`APP_GUARD` en `app.module.ts`). Para marcar una ruta como pública se usa el decorator `@Public()` (ver `src/auth/decorators/public.decorator.ts`), que el guard chequea con `Reflector` antes de exigir el token.
- El token se manda como header `Authorization: Bearer <token>`. En Swagger UI (`/docs`), el botón **Authorize** permite pegar el token una vez y que se use en todos los requests de prueba.
- Las contraseñas se guardan hasheadas con `bcrypt` (`passwordHash`, nunca en texto plano). El primer usuario de cada negocio se crea vía seed, o vía `POST /negocios/registro` (self-service) o `POST /admin/negocios` (manual) — ver [Alta de negocios](#alta-de-negocios). No existe un `POST /users` público por separado: el alta de un `User` siempre va acompañada de la creación de su `Negocio`.
- **`esSuperAdmin`** es un flag por `User`, independiente de a qué negocio pertenece — no es un rol dentro del negocio, es el privilegio de plataforma que habilita crear negocios nuevos. Un `User` normal (`esSuperAdmin: false`) nunca lo ve ni lo necesita.

## Alta de negocios

Cómo se crea un tenant nuevo (un cliente nuevo de esta plataforma) — hay dos caminos, ambos crean exactamente lo mismo (`Negocio` + su `User` dueño, en una única transacción vía `AdminService.crearNegocio()`):

- **`POST /negocios/registro`** — público, sin autenticación (`@Public()`), es el camino recomendado. El propio cliente completa el formulario de `/registro` en el panel web (o llama al endpoint directo) con `nombreNegocio`, `ownerNombre`, `ownerEmail`, `ownerPassword` (mínimo 8 caracteres) y `ownerWhatsappNumber?`, y queda de alta y logueado al instante. Limitado a 5 requests/minuto por IP (`@Throttle`, ver [Seguridad](#seguridad)).
- **`POST /admin/negocios`** — protegido por `SuperAdminGuard` (`src/auth/guards/super-admin.guard.ts`) además del `JwtAuthGuard` global; rechaza con `403` a cualquier token sin `esSuperAdmin: true`. Es el **respaldo manual** para cuando el cliente no puede o no quiere autogestionarse — el operador de la plataforma lo da de alta a mano desde Swagger UI (`/docs`) con su propio token de super-admin.
- Ninguno de los dos verifica el email — no hay servicio de envío de correo integrado todavía. Es una decisión consciente para esta etapa (ver historial de commits); si el spam de altas falsas se vuelve un problema, ahí conviene sumar verificación (ej. Resend, que tiene plan gratis hasta 3.000 emails/mes pero exige un dominio propio verificado).
- El primer super-admin de la plataforma se crea vía `prisma/seed.ts`, no vía ninguno de estos dos endpoints (ver [Variables de entorno](#variables-de-entorno)) — tiene que existir al menos un super-admin antes de poder usar `POST /admin/negocios`.

## Seguridad

Prácticas puntuales de este proyecto, más allá de lo ya cubierto en [Autenticación](#autenticación) (JWT, bcrypt, aislamiento multi-tenant forzado por tipo):

- **Rate limiting** (`@nestjs/throttler`, `src/app.module.ts`): límite global de 20 requests/minuto por IP, y un límite más estricto de 5/minuto en los endpoints públicos sensibles (`POST /auth/login`, `POST /negocios/registro`) vía `@Throttle()` por ruta — sin esto, cualquiera podía probar contraseñas por fuerza bruta o inundar el alta de cuentas falsas sin límite.
- **Firma de Twilio verificada en el webhook** (`src/whatsapp/whatsapp.controller.ts`): `POST /whatsapp/webhook` valida el header `X-Twilio-Signature` con `validateRequest()` del SDK de Twilio antes de procesar cualquier mensaje, usando `TWILIO_AUTH_TOKEN` y la URL pública exacta (`PUBLIC_APP_URL`, ver [Variables de entorno](#variables-de-entorno)). Sin esto, cualquiera que supiera la URL del webhook y el número de WhatsApp de un dueño podía simular mensajes suyos y cargar movimientos falsos en su negocio — no hacía falta pasar por WhatsApp en absoluto. Requests sin firma válida se rechazan con `403` y no llegan a `ConversationService`.
- `/auth/login` ya devolvía (antes de este cambio) el mismo mensaje genérico ("Credenciales inválidas") tanto si el email no existe como si la contraseña está mal — no filtra qué emails están registrados en la plataforma.
- `CORS_ORIGIN` restringido a una lista explícita de orígenes, nunca abierto.
- Prisma parametriza todas las queries — sin riesgo de SQL injection por diseño del ORM.

## Bot de WhatsApp

Pensado para que el dueño registre todo (compra de tela, entrega a una operaria, recepción de producto terminado, venta, ajuste, consulta de stock) charlando con un bot de WhatsApp, sin tocar la API ni el frontend. Es una interfaz conversacional sobre la misma lógica de negocio ya existente — no duplica reglas, llama a los mismos `Service` que usan el resto de los módulos.

**Cómo está armado** (`src/whatsapp`):

- `WhatsappController` (`POST /whatsapp/webhook`, `@Public()`) — recibe los mensajes entrantes que manda Twilio. Como el payload de Twilio trae ~20 campos que no controlamos, el body se lee como `Record<string, string>` en vez de un DTO con `class-validator`, para no chocar con `forbidNonWhitelisted` del `ValidationPipe` global.
- **Autorización y resolución de negocio**: no usa JWT. El campo `From` del mensaje se busca contra `User.whatsappNumber` (`UsersService.findByWhatsappNumber`); si no hay match o el usuario está inactivo, el mensaje se ignora y se loguea como advertencia. El `negocioId` del `User` encontrado es el que viaja a `ConversationService.manejarMensaje(negocioId, from, texto)` — así el mismo bot (mismo número de Twilio) atiende a todos los negocios de la plataforma a la vez, cada uno viendo únicamente sus propios datos. Dar de alta el número de un dueño nuevo es simplemente setear `User.whatsappNumber` (vía `POST /admin/negocios` con `ownerWhatsappNumber`, o editándolo después).
- `ConversationService` (`src/whatsapp/conversation`) — el motor de la conversación: una máquina de estados simple (`FlowStep`) por número de teléfono. Cada paso muestra una lista numerada (materiales, operarios, órdenes abiertas, etc.), guarda en la sesión qué eligió el usuario, y en el último paso de cada flujo llama a `MovimientosService.create()`, `OrdenesProduccionService.create()` o `StockService.getResumen()` — los mismos services que usan el resto de los módulos.
- `SessionStoreService` — guarda el estado de cada conversación en memoria (`Map<telefono, sesion>`). **Se pierde si el proceso se reinicia** (aceptable para esta v1; para producción real conviene pasar esto a Redis o una tabla). Escribir "menu", "0" o "cancelar" en cualquier momento reinicia la conversación.
- `WhatsappService` — wrapper fino sobre el SDK de Twilio para mandar la respuesta por la API REST (no se usa TwiML: el webhook siempre responde `200` vacío, y el mensaje se manda aparte).

**Flujos disponibles**: Compra, Entrega a operaria (abre una `OrdenProduccion` y crea el `CONSUMO` ya vinculado), Recepción de producto (vinculada a la misma orden si corresponde), Venta, Ajuste (acepta cantidad negativa), Ver stock, Agregar operaria nueva, Agregar material/producto nuevo, Ver últimos movimientos. Los primeros seis terminan en `MovimientosService.create()`; los dos de alta de catálogo van a `OperariosService.create()`/`ItemsService.create()` — mismos `Service` que usa el resto de los módulos, la capa conversacional no reimplementa ninguna regla.

**Decisiones de UX** (agregadas después de un review pensando en alguien no acostumbrado a usar sistemas):

- **Selección de item en dos pasos**: primero el nombre genérico ("Gabardina"), después el color si tiene más de una variante. Elegir de una lista plana de ~30 colores mezclados es mucho peor en un teléfono que dos listas cortas encadenadas (`pedirItem` → `SELECCION_ITEM_NOMBRE` → `SELECCION_ITEM_COLOR` si corresponde).
- **Confirmación antes de guardar**: ningún flujo escribe en la base apenas se informa la cantidad — arma un resumen ("Vas a registrar una compra de 10 de Gabardina Beige") y espera *sí*/*no* (`FlowStep.CONFIRMAR`, `session.accionPendiente`). Evita que un typo en la cantidad quede grabado sin que el dueño se dé cuenta.
- **"0" como atajo universal** para volver al menú, además de "menu"/"cancelar" — mismo patrón mental que un menú telefónico de call center.
- **Las opciones de "a qué entrega corresponde" muestran qué material tenía esa entrega** (ej. "24/07 · 5 Gabardina Beige"), no solo la fecha — si hiciste varias entregas el mismo día, antes eran indistinguibles.
- **El mensaje de stock insuficiente muestra el nombre del item, no su UUID** — antes exponía el id interno de la base de datos en un mensaje pensado para un usuario no técnico.

### Probarlo con Twilio Sandbox (gratis, sin verificación de negocio)

1. Entrá a la [consola de Twilio](https://console.twilio.com/) → **Messaging → Try it out → Send a WhatsApp message**, y desde tu WhatsApp real mandale al número del sandbox el código que te indican (algo como `join palabra-clave`). Quedás vinculado al sandbox.
2. Copiá `Account SID` y `Auth Token` del dashboard de Twilio a tu `.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`). `TWILIO_WHATSAPP_FROM` normalmente es `whatsapp:+14155238886` (el número compartido del sandbox).
3. Poné tu propio número en `OWNER_WHATSAPP_NUMBER`, formato `whatsapp:+549...` (con `whatsapp:` adelante).
4. Twilio necesita una URL pública para mandarte los mensajes — tu `localhost:3000` no le sirve. Exponelo con [ngrok](https://ngrok.com/) (o similar):
   ```bash
   ngrok http 3000
   ```
5. En la consola de Twilio, en la config del sandbox ("Sandbox settings"), pegá `https://<tu-url-de-ngrok>/whatsapp/webhook` como **"WHEN A MESSAGE COMES IN"** (método `POST`).
6. **Actualizá `PUBLIC_APP_URL` en tu `.env` con esa misma URL de ngrok** (sin barra final) — la validación de la firma de Twilio (ver [Seguridad](#seguridad)) compara byte a byte contra esta variable, así que si no coincide exactamente con la URL que Twilio usó para llamarte, rechaza el mensaje aunque sea 100% legítimo.
7. Levantá el backend (`npm run start:dev`) y escribile "hola" al número del sandbox desde tu WhatsApp. Debería responderte el menú.

> Nota: cada vez que reiniciás ngrok (versión gratuita) la URL cambia, así que hay que volver a pegarla en la consola de Twilio **y en `PUBLIC_APP_URL`**.

## Panel web

`web/` es un frontend aparte (React + Vite + Tailwind, `web/README.md` tiene el detalle propio). No es solo de consulta — tiene formularios de carga en cada sección, así que también sirve como respaldo completo si el bot de WhatsApp no está disponible (ver [Guía de uso](#guía-de-uso-para-el-dueño-del-negocio)).

- Login contra `POST /auth/login`, mismo JWT que usa el resto de la API — el token se guarda en el browser y viaja en cada request (`web/src/lib/api.ts`).
- Secciones (`web/src/pages/`), en el orden del nav:
  - **Resumen** — landing page (`/`). Gráfico de barras de stock por Materiales y Productos (`ResumenPage.tsx`), ordenado de menor a mayor cantidad, con alerta visual (ícono + etiqueta, nunca solo color) para "Sin stock" (stock en 0) y "Bajo mínimo" (`bajoMinimo` del resumen de `GET /stock`). Es la vista que más valor da de un vistazo, por eso quedó como entrada en vez de Items.
  - **Items** — catálogo con su stock (`GET /stock` en bloque, no item por item — ver nota de rendimiento más abajo), fecha de alta, y formulario para dar de alta uno nuevo.
  - **Operarios** — listado + alta.
  - **Órdenes de producción** — listado + alta.
  - **Movimientos** — historial del ledger + formulario para cargar un movimiento nuevo (equivalente a las opciones 1–5 del bot). A diferencia del bot, **no pide confirmación** antes de guardar.
- **Rendimiento**: `ItemsPage` trae el stock de todos los items con una sola llamada a `GET /stock` (`Promise.all` junto con `GET /items`) en vez de pedirlo item por item — la versión anterior tenía un botón "ver" por fila que disparaba un request por click, un N+1 evitable ya que el endpoint de resumen siempre devolvió todo junto.
- Se conecta al backend vía `VITE_API_URL` (env var de build, no de runtime — hay que rebuildear/redeployar el frontend si cambia la URL del backend).
- El backend tiene que aceptar el origen del frontend en `CORS_ORIGIN` (ver [Variables de entorno](#variables-de-entorno)) — acepta una lista separada por comas, así conviven el dominio de producción y `http://localhost:5173` de desarrollo.

## Deploy en producción

El sistema corre 24/7 en la nube, no depende de que una PC esté prendida:

- **Backend + Postgres**: [Railway](https://railway.app/). El backend se despliega con un `Dockerfile` propio (no con el builder automático de Railway — Railpack no incluía el build compilado en la imagen final, ver comentario en el `Dockerfile`). El comando de arranque (`railway:start` en `package.json`) corre `prisma migrate deploy` antes de levantar el server, así cada deploy aplica migraciones pendientes solo.
- **Frontend**: [Vercel](https://vercel.com/), deploy está atado a `VITE_API_URL` seteada como variable de entorno de build en el proyecto de Vercel.
- **Bot de WhatsApp**: mismo backend de Railway, expuesto vía Twilio (webhook apuntando a `<url-de-railway>/whatsapp/webhook`).

Correr el seed o cualquier script puntual contra la base de producción **no funciona desde la máquina local** — `DATABASE_URL` en Railway usa el hostname interno `postgres.railway.internal`, que solo resuelve dentro de la red privada de Railway. Para eso: `railway ssh -- <comando>` (ejecuta el comando dentro del contenedor del backend, que sí tiene acceso a esa red). Necesita una clave SSH registrada una vez (`railway ssh keys add`).

## Guía de uso para el dueño del negocio

[`docs/guia-de-uso.md`](docs/guia-de-uso.md) — instructivo en español, sin jerga técnica, pensado para la persona que usa el sistema día a día (no para quien lo desarrolla): cómo cargar movimientos por WhatsApp, qué muestra cada sección del panel web, dudas frecuentes.

No incluye credenciales de acceso a propósito — cada negocio tiene su propio usuario/contraseña (ver [Alta de negocios](#alta-de-negocios)), y ese dato no se versiona en el repositorio.

## Puesta en marcha (proyecto ya clonado)

Prerrequisitos: Node.js 20+, Docker Desktop con el motor corriendo (ver [Troubleshooting](#troubleshooting) si `docker info` falla).

```bash
npm install

# copiar y completar: contraseña del dueño, JWT_SECRET, etc.
cp .env.example .env

# levantar Postgres en Docker
docker compose up -d

# aplicar el schema
npx prisma migrate dev

# crea el primer Negocio + su User dueño (esSuperAdmin: true, ver OWNER_* en .env)
# + carga el catálogo real del negocio
npm run db:seed

# levantar la API en modo watch
npm run start:dev
```

La API queda en `http://localhost:3000`. Documentación interactiva (Swagger UI) en `http://localhost:3000/docs`, y el spec OpenAPI crudo en `http://localhost:3000/docs-json`.

## Variables de entorno

| variable | ejemplo | uso |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/fauna_de_tela?schema=public` | leída por Prisma y por `docker-compose.yml` (usuario/clave/DB deben coincidir con los `environment:` del servicio `postgres`) |
| `PORT` | `3000` | opcional, puerto HTTP (`src/main.ts`) |
| `JWT_SECRET` | string aleatorio largo | firma los tokens (`src/auth`). Generar uno propio, nunca reusar el de ejemplo |
| `JWT_EXPIRES_IN` | `7d` | opcional, vencimiento del token |
| `OWNER_NEGOCIO_NOMBRE` / `OWNER_EMAIL` / `OWNER_PASSWORD` / `OWNER_NOMBRE` | — | solo usados por `prisma/seed.ts` para crear el primer `Negocio` y su `User` (con `esSuperAdmin: true`); no se leen en runtime |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | — | credenciales de la [consola de Twilio](https://console.twilio.com/) |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` | número de origen; el del sandbox por default |
| `OWNER_WHATSAPP_NUMBER` | `whatsapp:+549...` | opcional; si se informa, `prisma/seed.ts` lo guarda como `User.whatsappNumber` del primer negocio. El bot resuelve el negocio de cada mensaje contra esta columna en runtime, no contra la variable de entorno (ver [Bot de WhatsApp](#bot-de-whatsapp)) |
| `PUBLIC_APP_URL` | `https://backend-production-xxxx.up.railway.app` | URL pública del backend, **sin barra final** — Twilio la necesita para validar la firma del webhook (ver [Seguridad](#seguridad)). En local, la URL de ngrok si estás probando con Twilio real |

`.env` está en `.gitignore`; `.env.example` es la plantilla versionada.

## Scripts disponibles

| script | qué hace |
|---|---|
| `npm run start:dev` | API en modo watch |
| `npm run build` | compila a `dist/` |
| `npm run start:prod` | corre el build compilado |
| `npm run lint` | ESLint + Prettier con `--fix` |
| `npm test` | tests unitarios (Jest) |
| `npm run test:cov` | tests unitarios con reporte de cobertura |
| `npm run test:e2e` | tests end-to-end (requiere Postgres levantado) |
| `npm run db:seed` / `npx prisma db seed` | corre `prisma/seed.ts` |
| `npx prisma migrate dev --name <nombre>` | crea y aplica una migración |
| `npx prisma studio` | UI para explorar la base |

## API — endpoints

> Documentación interactiva completa (probar requests, ver schemas) en `/docs` una vez levantada la API. Lo que sigue es un resumen de referencia rápida. Todas las rutas salvo `POST /auth/login`, `POST /negocios/registro` y el webhook de WhatsApp requieren header `Authorization: Bearer <token>`. Todos los endpoints de negocio (items, operarios, movimientos, órdenes, stock) están scopeados automáticamente al `negocioId` del token — nunca hace falta, ni se acepta, pasarlo a mano. `/auth/login` y `/negocios/registro` están limitados a 5 requests/minuto por IP (ver [Seguridad](#seguridad)).

**Auth** (`/auth`)
- `POST /auth/login` — público. `{ email, password }` → `{ accessToken }` (payload incluye `negocioId`)
- `GET /auth/me` — usuario autenticado actual

**Negocios** (`/negocios`) — público, sin autenticación
- `POST /negocios/registro` — alta self-service: crea un `Negocio` + su `User` dueño (`CreateNegocioDto`: `nombreNegocio`, `ownerEmail`, `ownerPassword`, `ownerNombre`, `ownerWhatsappNumber?`). Ver [Alta de negocios](#alta-de-negocios)

**Admin** (`/admin`) — requiere `esSuperAdmin: true` en el token, si no `403`
- `POST /admin/negocios` — mismo `CreateNegocioDto` que `/negocios/registro`; es el alta manual de respaldo. Ver [Alta de negocios](#alta-de-negocios)

**Items** (`/items`)
- `POST /items` — crear (`CreateItemDto`)
- `GET /items?activo=true|false` — listar, filtro opcional
- `GET /items/:id`
- `PATCH /items/:id` — actualización parcial (`UpdateItemDto`)

**Operarios** (`/operarios`)
- `POST /operarios`
- `GET /operarios?activo=true|false`
- `GET /operarios/:id`
- `PATCH /operarios/:id`

**Órdenes de producción** (`/ordenes-produccion`) — trazabilidad tela entregada → producto terminado
- `POST /ordenes-produccion` — abre una orden para un `operarioId`
- `GET /ordenes-produccion?operarioId=<uuid>`
- `GET /ordenes-produccion/:id` — con sus movimientos
- `GET /ordenes-produccion/:id/resumen` — totales por item

**Movimientos** (`/movimientos`) — el único punto de entrada que afecta el stock
- `POST /movimientos` — crea un movimiento (`CreateMovimientoDto`: `itemId`, `operarioId?`, `ordenProduccionId?`, `tipo`, `cantidad`, `fecha?`, `observaciones?`). Valida que el item (y el operario u orden, si se informan) existan, que la cantidad tenga signo correcto según el tipo, y que no deje stock negativo en `CONSUMO`/`VENTA`.
- `GET /movimientos?itemId=<uuid>` — listar, filtro opcional por item
- `GET /movimientos/:id`

**Stock** (`/stock`)
- `GET /stock?categoria=MATERIAL|PRODUCTO` — resumen de stock de todos los items activos, incluye `codigo`, `stockMinimo` y `bajoMinimo` por item (ver [Motor de stock](#motor-de-stock))
- `GET /stock/:itemId` — `{ itemId, stock }` calculado en el momento

**WhatsApp** (`/whatsapp`) — no aparece en Swagger (`@ApiExcludeController`), no usa JWT
- `POST /whatsapp/webhook` — público, pensado para que lo llame Twilio. Ver [Bot de WhatsApp](#bot-de-whatsapp)

Todos los endpoints (salvo el webhook de WhatsApp, que no pasa por el `ValidationPipe`) validan el body con `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` (`src/main.ts`): cualquier campo no declarado en el DTO se rechaza con `400`.

## Testing

Tests unitarios de los `Service` (la capa con la lógica de negocio), con el `Repository`/servicios colaboradores mockeados a mano — no se levanta Nest ni la base de datos:

- `stock/stock.service.spec.ts` — suma/resta por tipo, signo de `AJUSTE`, validación de stock insuficiente
- `movimientos/movimientos.service.spec.ts` — validación de item/operario, signo de cantidad por tipo, cuándo se llama a `validarStockSuficiente`
- `items/items.service.spec.ts`, `operarios/operarios.service.spec.ts` — CRUD básico y manejo de `NotFoundException`
- `auth/auth.service.spec.ts` — credenciales inválidas, usuario inactivo, y que `login` firme el payload correcto
- `whatsapp/conversation/conversation.service.spec.ts` — el menú principal, el flujo completo de compra, entrega→recepción vinculadas a la misma orden, propagación de errores (ej. stock insuficiente) y selección inválida

```bash
npm test
```

**Pegarle directo al webhook con `curl` ya no alcanza**: desde que se valida la firma de Twilio (ver [Seguridad](#seguridad)), un `POST` sin el header `X-Twilio-Signature` correcto se rechaza con `403` — es la protección funcionando como debe. Para probar el flujo del bot de punta a punta, usá el Sandbox real de Twilio + ngrok (pasos en [Bot de WhatsApp](#bot-de-whatsapp)); es la única forma soportada de generar requests con firma válida.

Para ver qué contestó el bot en una prueba real, además de leer la respuesta en WhatsApp, se puede revisar los logs del servidor o directamente la tabla `movimientos`/`ordenes_produccion` después de completar un flujo.

## Troubleshooting

**`docker info` responde `Docker Desktop is unable to start`** (típico en la primera instalación en Windows): falta el kernel de WSL2. Solución:

```powershell
wsl --update
# reiniciar Docker Desktop (o la PC si sigue fallando)
```

**`prisma migrate dev` da `P1001: Can't reach database server`**: Postgres no está corriendo. Confirmá con `docker compose ps` y, si no aparece, `docker compose up -d`.

## Cómo se construyó desde cero (guía de replicación)

Pasos reales, en orden, para levantar un proyecto de este tipo desde una carpeta vacía. Sirve como receta para clonar el patrón en otro negocio.

### 1. Scaffold de NestJS

```bash
npx @nestjs/cli new . --package-manager npm --skip-git --language ts
```

### 2. Prisma + PostgreSQL

```bash
npm install prisma --save-dev
npm install @prisma/client class-validator class-transformer @nestjs/config @nestjs/swagger
npx prisma init --datasource-provider postgresql
```

> Nota de versión: al momento de armar este proyecto, `prisma init` instaló por defecto **Prisma 7**, que cambió su arquitectura (ya no acepta `url` dentro de `datasource` en el schema; exige un `prisma.config.ts` y un *driver adapter*). Para un proyecto de este tamaño se optó por fijar la serie estable **Prisma 6** (`npm install prisma@^6 @prisma/client@^6`), borrar `prisma.config.ts` y usar el patrón clásico `datasource { url = env("DATABASE_URL") }` con generador `prisma-client-js`. Si en el futuro se quiere migrar a Prisma 7, hay que sumar `@prisma/adapter-pg` y reescribir `PrismaService` para inyectar el adapter.

Editar `prisma/schema.prisma` con los enums y modelos (ver [Modelo de datos](#modelo-de-datos)), y `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/<nombre_db>?schema=public"
```

### 3. Levantar Postgres con Docker

`docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: <nombre>_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: <nombre_db>
    ports:
      - '5432:5432'
    volumes:
      - <nombre>_pgdata:/var/lib/postgresql/data

volumes:
  <nombre>_pgdata:
```

```bash
docker compose up -d
npx prisma migrate dev --name init
```

### 4. Estructura de cada módulo de dominio

Por cada entidad (`items`, `operarios`, ...): `dto/create-*.dto.ts`, `dto/update-*.dto.ts` (con `PartialType` de `@nestjs/swagger`, no de `@nestjs/mapped-types` — ver paso 9), `entities/*.entity.ts` (forma de la respuesta para Swagger), `*.repository.ts` (única capa que importa `PrismaService`), `*.service.ts` (reglas de negocio, `NotFoundException` si no existe), `*.controller.ts` (HTTP puro), `*.module.ts` (wiring + `exports` del `Service` si otro módulo lo necesita).

### 5. El motor de stock como módulo aparte

`stock` no depende de `movimientos`: tiene su propio `StockRepository` que hace `prisma.movimiento.groupBy({ by: ['tipo'], where: { itemId }, _sum: { cantidad: true } })`, y `StockService` interpreta esos totales según la lista de tipos "entrada" / "salida" (ver [Motor de stock](#motor-de-stock)). `movimientos` importa `StockModule` para validar antes de escribir.

### 6. `ValidationPipe` global

En `src/main.ts`:

```ts
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
);
```

### 7. Seed idempotente

`prisma/seed.ts` con un `upsertItem`/`upsertOperario` manual (`findFirst` + `create` si no existe) en vez de `upsert()` de Prisma: la unique compuesta `(nombre, colorNombre)` no protege bien contra duplicados cuando `colorNombre` es `null`, porque PostgreSQL trata cada `NULL` como distinto dentro de un índice único. `findFirst({ where: { nombre, colorNombre } })` sí compara `NULL = NULL` correctamente vía `IS NULL`.

Configuración en `package.json`:

```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

```bash
npm run db:seed
```

### 8. Regla "nunca `any`"

`eslint.config.mjs` trae por defecto `@typescript-eslint/no-explicit-any: 'off'` (así viene el starter de NestJS). Se lo cambió a `'error'` para que el lint la haga cumplir en todo el proyecto, tests incluidos.

### 9. Swagger / OpenAPI

```bash
npm install @nestjs/swagger
```

En `src/main.ts`, después del `ValidationPipe`:

```ts
const swaggerConfig = new DocumentBuilder()
  .setTitle('<Nombre> API')
  .setDescription('...')
  .setVersion('1.0')
  .build();
const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('docs', app, swaggerDocument);
```

Tres cosas para que el schema generado sea útil y no solo `{}`:

- **DTOs**: decorar cada campo con `@ApiProperty()` / `@ApiPropertyOptional()` (enums con `{ enum: MiEnum }`). Sin esto, el body del request se documenta como un objeto vacío.
- **`PartialType` de `@nestjs/swagger`, no de `@nestjs/mapped-types`**: el de `mapped-types` solo replica la metadata de `class-validator`; el de `@nestjs/swagger` replica *además* la metadata de OpenAPI (y de paso la de `class-validator`), así que reemplaza al otro paquete por completo. Por eso se desinstaló `@nestjs/mapped-types`.
- **Entities de respuesta**: los `Controller` devuelven directamente los tipos de Prisma (`Item`, `Movimiento`, ...), que no tienen decoradores. Se crea una clase `entities/*.entity.ts` por modelo con `@ApiProperty()` en cada campo (mismo shape que el modelo Prisma) y se referencia con `@ApiResponse({ status, type: MiEntity })` en cada endpoint — el tipo de retorno real del método (`Promise<Item>`) no cambia, la entity es solo metadata para Swagger.

### 10. Tests unitarios de los `Service`

Sin levantar Nest ni la base: se instancia el `Service` a mano pasándole un objeto mock tipado como `{ metodo: jest.Mock }`, casteado con `as unknown as <Repository>` (necesario porque las clases de Nest tienen parámetros de constructor `private`, lo que las vuelve nominales para TypeScript). Ver cualquier `*.service.spec.ts` como referencia.

### 11. Autenticación JWT

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

Piezas del módulo `auth` (ver [Autenticación](#autenticación) para el comportamiento):

- Modelo `User` en `schema.prisma` (`email` unique, `passwordHash`, nunca la contraseña en texto plano).
- `src/users`: `UsersRepository`/`UsersService` internos, **sin** `Controller` — no hace falta un CRUD público de usuarios para una sola cuenta dueño.
- `src/auth/auth.service.ts`: `validateUser` compara con `bcrypt.compare`; `login` firma un JWT con `{ sub: user.id, email, negocioId }` vía `JwtService`.
- `src/auth/strategies/jwt.strategy.ts`: valida el token entrante y carga el usuario real (rechaza si está inactivo).
- `src/auth/guards/jwt-auth.guard.ts` registrado como `APP_GUARD` global en `app.module.ts` — **toda ruta nueva queda protegida por default**. Para una ruta pública, decorarla con `@Public()` (el guard usa `Reflector` para detectar la metadata).
- El seed (`prisma/seed.ts`) crea el negocio y la cuenta inicial leyendo `OWNER_NEGOCIO_NOMBRE`/`OWNER_EMAIL`/`OWNER_PASSWORD`/`OWNER_NOMBRE` de `.env` — nunca hardcodear credenciales reales en un archivo versionado.
- `DocumentBuilder().addBearerAuth()` en `main.ts` + `@ApiBearerAuth()` en cada controller protegido para que el botón "Authorize" de Swagger UI funcione.

### 12. Multi-tenancy

Para escalar de "un negocio" a "muchos negocios" (SaaS), sin cambiar de base de datos ni de infraestructura:

- Modelo `Negocio` en `schema.prisma`, y una columna `negocioId String` + relación en cada tabla de negocio (`Item`, `Operario`, `Movimiento`, `OrdenProduccion`, `User`) + `@@index([negocioId])`. Los unique compuestos que antes eran `(nombre, colorNombre)` pasan a `(negocioId, nombre, colorNombre)`.
- **Regla de diseño clave**: todo método de `Repository`/`Service` recibe `negocioId` como primer parámetro obligatorio — así TypeScript impide compilar una query que se olvide de filtrar por tenant (ver [Multi-tenancy](#multi-tenancy)).
- `JwtPayload` y `AuthenticatedUser` suman `negocioId` (y `esSuperAdmin` si se quiere un rol de plataforma); `login()` lo incluye en el JWT firmado.
- Migrar datos existentes de un proyecto de un solo negocio: no usar `prisma migrate dev` para el paso que agrega `negocioId NOT NULL` a una tabla con filas — falla de forma no interactiva porque no sabe qué valor default poner. Escribir la migración a mano: agregar la columna como nullable, hacer `UPDATE` con el id del negocio "legacy", después `ALTER COLUMN ... SET NOT NULL`. Aplicar con `npx prisma migrate resolve --rolled-back <nombre>` (si `migrate dev` ya la había marcado como fallida) seguido de `npx prisma migrate deploy`.
- Módulo `admin` nuevo, con un `SuperAdminGuard` propio (chequea `request.user.esSuperAdmin`) y `AdminService.crearNegocio()` para dar de alta un tenant + su primer usuario en una transacción. `POST /admin/negocios` (super-admin) y `POST /negocios/registro` (público, módulo `negocios` aparte) llaman al mismo service — ver [Alta de negocios](#alta-de-negocios).
- El bot de WhatsApp deja de comparar contra un número fijo en `.env` y pasa a resolver el `negocioId` buscando el `From` entrante contra `User.whatsappNumber` — así el mismo webhook atiende a todos los tenants.

### 13. Bot de WhatsApp

```bash
npm install twilio
```

Piezas de `src/whatsapp` (ver [Bot de WhatsApp](#bot-de-whatsapp) para el detalle):

- `@Body() body: Record<string, string>` en vez de un DTO en el controller del webhook — Twilio manda ~20 campos que no controlamos, y un DTO con `forbidNonWhitelisted: true` rechazaría el request entero.
- Autorización y resolución de tenant por número de teléfono (`User.whatsappNumber`), no por JWT — el `@Public()` del guard global se usa para exceptuar esta ruta, igual que `/auth/login`.
- Máquina de estados en memoria (`SessionStoreService`) para trackear en qué paso de la conversación está cada número — WhatsApp no tiene sesión, cada mensaje es un webhook independiente.
- `ConversationService` llama directo a los `Service` de negocio ya existentes (`MovimientosService`, `OrdenesProduccionService`, `StockService`, ...) — la capa conversacional no reimplementa ninguna regla, solo la envuelve en preguntas/respuestas de texto.
- El envío de la respuesta es una llamada aparte a la API REST de Twilio (`client.messages.create`), envuelta en `try/catch` para que un fallo de Twilio no tire un 500 al webhook.

## Cómo adaptar esta base a otro negocio

Este proyecto está armado para ser un punto de partida reusable. Para clonarlo a otro rubro (por ejemplo, otro tipo de manufactura o un comercio con insumos/productos):

1. **Renombrar el dominio de "persona que mueve stock"** si `Operario` no encaja (ej. `Vendedor`, `Encargado`): renombrar modelo en `schema.prisma`, correr `prisma migrate dev`, y renombrar el módulo (`grep -rl "Operario\|operario" src` para ubicar todos los puntos).
2. **Ajustar `Categoria`, `Unidad` y `MovimientoTipo`** en el enum de `schema.prisma` según el negocio — son la única parte realmente específica de "muñecos de tela". El resto (Controller/Service/Repository, motor de stock, validaciones) es genérico.
3. **Revisar la lista `TIPOS_SALIDA`** en `src/stock/stock.service.ts` y `src/movimientos/movimientos.service.ts` si se agregan o quitan tipos de movimiento — es la fuente de verdad sobre qué tipo resta (todo lo que no es `TIPOS_SALIDA` ni `AJUSTE` suma).
4. **Reemplazar `prisma/seed.ts`** por el catálogo real del nuevo negocio — pasarle el `negocioId` que devuelve `upsertNegocioYOwner()`, manteniendo el patrón `upsertItem`/`upsert<Entidad>` idempotente.
5. **Multi-tenant**: ya no es trabajo pendiente — el sistema nació pensado para vender a múltiples emprendedores (ver [Multi-tenancy](#multi-tenancy)). Sumar un cliente nuevo no requiere tocar código: se autogestiona en `POST /negocios/registro`, o se lo das de alta vos con `POST /admin/negocios` (ver [Alta de negocios](#alta-de-negocios)).
6. **`docker-compose.yml` y `.env`**: cambiar `POSTGRES_DB`, nombre del contenedor y del volumen para que convivan varios proyectos de este tipo en la misma máquina sin pisarse.
