# Fauna de Tela

Sistema de gestión de producción e inventario para un emprendimiento de muñecos de tela. Lleva el catálogo de productos y materiales, registra quién hizo qué movimiento (compra, consumo, producción, venta, ajuste) y calcula el stock siempre a partir de ese historial — nunca se edita un número de stock a mano.

Este documento cubre dos cosas: cómo funciona el sistema tal como está hoy, y cómo replicar el proceso completo de armado desde cero (útil si querés adaptar esta misma base a otro rubro/negocio).

---

## Índice

1. [Stack](#stack)
2. [Arquitectura](#arquitectura)
3. [Modelo de datos](#modelo-de-datos)
4. [Motor de stock](#motor-de-stock)
5. [Trazabilidad: entrega de material → producto terminado](#trazabilidad-entrega-de-material--producto-terminado)
6. [Autenticación](#autenticación)
7. [Bot de WhatsApp](#bot-de-whatsapp)
8. [Puesta en marcha (proyecto ya clonado)](#puesta-en-marcha-proyecto-ya-clonado)
9. [Variables de entorno](#variables-de-entorno)
10. [Scripts disponibles](#scripts-disponibles)
11. [API — endpoints](#api--endpoints)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Cómo se construyó desde cero (guía de replicación)](#cómo-se-construyó-desde-cero-guía-de-replicación)
15. [Cómo adaptar esta base a otro negocio](#cómo-adaptar-esta-base-a-otro-negocio)

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

## Modelo de datos

`prisma/schema.prisma` define:

**Enums**
- `Categoria`: `MATERIAL` | `PRODUCTO`
- `Unidad`: `METRO` | `KG` | `CONO` | `UNIDAD`
- `MovimientoTipo`: `COMPRA` | `CONSUMO` | `PRODUCCION` | `VENTA` | `AJUSTE`

**User** — el dueño del emprendimiento (o cualquier otra persona con acceso a la app; no confundir con `Operario`, ver [Autenticación](#autenticación))
| campo | tipo |
|---|---|
| id | String (uuid) |
| email | String (unique) |
| passwordHash | String |
| nombre | String |
| activo | Boolean |
| createdAt | DateTime |

**Item** — catálogo de materiales y productos
| campo | tipo | notas |
|---|---|---|
| id | String (uuid) | |
| nombre | String | ej. "Gabardina", "Zorro" |
| categoria | Categoria | |
| unidad | Unidad | |
| tieneColor | Boolean | si es `false`, `colorNombre` siempre es `null` |
| colorNombre | String? | solo relevante si `tieneColor` |
| imagenUrl | String? | |
| activo | Boolean | soft-flag, no hay borrado físico |
| createdAt | DateTime | |

Unique compuesto `(nombre, colorNombre)`.

**Operario** — quién hace el movimiento
| campo | tipo |
|---|---|
| id | String (uuid) |
| nombre | String |
| activo | Boolean |
| createdAt | DateTime |

**Movimiento** — el ledger. Es append-only: no tiene endpoint de edición ni de borrado.
| campo | tipo | notas |
|---|---|---|
| id | String (uuid) | |
| itemId | String | FK a Item |
| operarioId | String? | FK a Operario, opcional (una `COMPRA` a proveedor no siempre tiene un operario asociado). Si el movimiento pertenece a una `OrdenProduccion`, se autocompleta con el operario de esa orden |
| ordenProduccionId | String? | FK a `OrdenProduccion`, opcional — agrupa la tela entregada (`CONSUMO`) y el producto devuelto (`PRODUCCION`) de una misma entrega |
| tipo | MovimientoTipo | |
| cantidad | Decimal(10,2) | positiva salvo en `AJUSTE` (ver más abajo) |
| fecha | DateTime | default `now()`, puede informarse explícitamente |
| observaciones | String? | |
| createdAt | DateTime | |

## Motor de stock

El stock de un `Item` **nunca se persiste como columna**. Se calcula on-the-fly sumando y restando todos sus `Movimiento` (`src/stock/stock.service.ts`):

- **Entradas (suman):** `COMPRA`, `PRODUCCION`
- **Salidas (restan):** `CONSUMO`, `VENTA`
- **AJUSTE:** la `cantidad` viaja con signo — positiva suma, negativa resta. Es el único tipo donde `cantidad` puede ser negativa; para el resto, el `Service` rechaza `cantidad <= 0` antes de llegar a la base.

Antes de crear un movimiento de `CONSUMO` o `VENTA`, `MovimientosService.create()` llama a `StockService.validarStockSuficiente(itemId, cantidad)`, que recalcula el stock actual y lanza `BadRequestException` si la operación lo dejaría negativo. No hay ningún endpoint `PATCH /stock` — la única forma de modificar stock es insertar un `Movimiento`.

Los cálculos usan `Prisma.Decimal` en vez de `number` en los pasos intermedios para evitar errores de redondeo de punto flotante al sumar/restar cantidades.

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
- **Todas las demás rutas están protegidas por default** vía un `JwtAuthGuard` global (`APP_GUARD` en `app.module.ts`). Para marcar una ruta como pública se usa el decorator `@Public()` (ver `src/auth/decorators/public.decorator.ts`), que el guard chequea con `Reflector` antes de exigir el token.
- El token se manda como header `Authorization: Bearer <token>`. En Swagger UI (`/docs`), el botón **Authorize** permite pegar el token una vez y que se use en todos los requests de prueba.
- Las contraseñas se guardan hasheadas con `bcrypt` (`passwordHash`, nunca en texto plano). El primer usuario (el dueño) se crea vía seed, no vía un endpoint de registro — no existe `POST /users` público, a propósito: no hay un flujo de alta de usuarios auto-servicio en esta v1.

## Bot de WhatsApp

Pensado para que el dueño registre todo (compra de tela, entrega a una operaria, recepción de producto terminado, venta, ajuste, consulta de stock) charlando con un bot de WhatsApp, sin tocar la API ni el frontend. Es una interfaz conversacional sobre la misma lógica de negocio ya existente — no duplica reglas, llama a los mismos `Service` que usan el resto de los módulos.

**Cómo está armado** (`src/whatsapp`):

- `WhatsappController` (`POST /whatsapp/webhook`, `@Public()`) — recibe los mensajes entrantes que manda Twilio. Como el payload de Twilio trae ~20 campos que no controlamos, el body se lee como `Record<string, string>` en vez de un DTO con `class-validator`, para no chocar con `forbidNonWhitelisted` del `ValidationPipe` global.
- **Autorización**: no usa JWT. Compara el campo `From` del mensaje contra `OWNER_WHATSAPP_NUMBER` del `.env` — cualquier otro número se ignora y se loguea como advertencia. Es el único mecanismo de acceso para esta v1 de un solo usuario; una versión multi-tenant necesitaría mapear cada número a una cuenta en vez de un único número fijo.
- `ConversationService` (`src/whatsapp/conversation`) — el motor de la conversación: una máquina de estados simple (`FlowStep`) por número de teléfono. Cada paso muestra una lista numerada (materiales, operarios, órdenes abiertas, etc.), guarda en la sesión qué eligió el usuario, y en el último paso de cada flujo llama a `MovimientosService.create()`, `OrdenesProduccionService.create()` o `StockService.getResumen()` — los mismos services que usan el resto de los módulos.
- `SessionStoreService` — guarda el estado de cada conversación en memoria (`Map<telefono, sesion>`). **Se pierde si el proceso se reinicia** (aceptable para esta v1; para producción real conviene pasar esto a Redis o una tabla). Escribir "menu" o "cancelar" en cualquier momento reinicia la conversación.
- `WhatsappService` — wrapper fino sobre el SDK de Twilio para mandar la respuesta por la API REST (no se usa TwiML: el webhook siempre responde `200` vacío, y el mensaje se manda aparte).

**Flujos disponibles**: Compra (item + cantidad → `COMPRA`), Entrega a operaria (operario + material + cantidad → abre una `OrdenProduccion` y crea el `CONSUMO` ya vinculado), Recepción de producto (operario + entrega abierta opcional + producto + cantidad → `PRODUCCION`, vinculada a la misma orden si corresponde), Venta (→ `VENTA`), Ajuste (→ `AJUSTE`, acepta cantidad negativa), Ver stock (→ `StockService.getResumen`, filtrable por categoría), Agregar operaria nueva (→ `OperariosService.create`), Agregar material/producto nuevo (categoría, unidad, nombre y color opcional → `ItemsService.create`) — estos dos últimos son altas de catálogo, no movimientos.

### Probarlo con Twilio Sandbox (gratis, sin verificación de negocio)

1. Entrá a la [consola de Twilio](https://console.twilio.com/) → **Messaging → Try it out → Send a WhatsApp message**, y desde tu WhatsApp real mandale al número del sandbox el código que te indican (algo como `join palabra-clave`). Quedás vinculado al sandbox.
2. Copiá `Account SID` y `Auth Token` del dashboard de Twilio a tu `.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`). `TWILIO_WHATSAPP_FROM` normalmente es `whatsapp:+14155238886` (el número compartido del sandbox).
3. Poné tu propio número en `OWNER_WHATSAPP_NUMBER`, formato `whatsapp:+549...` (con `whatsapp:` adelante).
4. Twilio necesita una URL pública para mandarte los mensajes — tu `localhost:3000` no le sirve. Exponelo con [ngrok](https://ngrok.com/) (o similar):
   ```bash
   ngrok http 3000
   ```
5. En la consola de Twilio, en la config del sandbox ("Sandbox settings"), pegá `https://<tu-url-de-ngrok>/whatsapp/webhook` como **"WHEN A MESSAGE COMES IN"** (método `POST`).
6. Levantá el backend (`npm run start:dev`) y escribile "hola" al número del sandbox desde tu WhatsApp. Debería responderte el menú.

> Nota: cada vez que reiniciás ngrok (versión gratuita) la URL cambia, así que hay que volver a pegarla en la consola de Twilio. Para no depender de esto en desarrollo, también podés probar el flujo sin WhatsApp real pegándole directo al webhook con `curl` (ver ejemplo en [Testing](#testing)).

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

# crea la cuenta de login del dueño (OWNER_EMAIL/OWNER_PASSWORD del .env)
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
| `OWNER_EMAIL` / `OWNER_PASSWORD` / `OWNER_NOMBRE` | — | solo usados por `prisma/seed.ts` para crear la cuenta de login inicial del dueño; no se leen en runtime |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | — | credenciales de la [consola de Twilio](https://console.twilio.com/) |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` | número de origen; el del sandbox por default |
| `OWNER_WHATSAPP_NUMBER` | `whatsapp:+549...` | único número autorizado a usar el bot (ver [Bot de WhatsApp](#bot-de-whatsapp)) |

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

> Documentación interactiva completa (probar requests, ver schemas) en `/docs` una vez levantada la API. Lo que sigue es un resumen de referencia rápida. Todas las rutas salvo `POST /auth/login` requieren header `Authorization: Bearer <token>`.

**Auth** (`/auth`)
- `POST /auth/login` — público. `{ email, password }` → `{ accessToken }`
- `GET /auth/me` — usuario autenticado actual

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
- `GET /stock?categoria=MATERIAL|PRODUCTO` — resumen de stock de todos los items activos
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

Para probar el bot **sin** un WhatsApp real ni Twilio, se le puede pegar directo al webhook (mismo formato `x-www-form-urlencoded` que manda Twilio):

```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$OWNER_WHATSAPP_NUMBER" \
  --data-urlencode "Body=hola"
```

Como la respuesta se manda por la API de Twilio (no queda en el body del `curl`), para ver qué contestó el bot conviene revisar los logs del servidor, o directamente la tabla `movimientos`/`ordenes_produccion` después de completar un flujo.

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
- `src/auth/auth.service.ts`: `validateUser` compara con `bcrypt.compare`; `login` firma un JWT con `{ sub: user.id, email }` vía `JwtService`.
- `src/auth/strategies/jwt.strategy.ts`: valida el token entrante y carga el usuario real (rechaza si está inactivo).
- `src/auth/guards/jwt-auth.guard.ts` registrado como `APP_GUARD` global en `app.module.ts` — **toda ruta nueva queda protegida por default**. Para una ruta pública, decorarla con `@Public()` (el guard usa `Reflector` para detectar la metadata).
- El seed (`prisma/seed.ts`) crea la cuenta inicial leyendo `OWNER_EMAIL`/`OWNER_PASSWORD`/`OWNER_NOMBRE` de `.env` — nunca hardcodear credenciales reales en un archivo versionado.
- `DocumentBuilder().addBearerAuth()` en `main.ts` + `@ApiBearerAuth()` en cada controller protegido para que el botón "Authorize" de Swagger UI funcione.

### 12. Bot de WhatsApp

```bash
npm install twilio
```

Piezas de `src/whatsapp` (ver [Bot de WhatsApp](#bot-de-whatsapp) para el detalle):

- `@Body() body: Record<string, string>` en vez de un DTO en el controller del webhook — Twilio manda ~20 campos que no controlamos, y un DTO con `forbidNonWhitelisted: true` rechazaría el request entero.
- Autorización por número de teléfono (`OWNER_WHATSAPP_NUMBER`), no por JWT — el `@Public()` del guard global se usa para exceptuar esta ruta, igual que `/auth/login`.
- Máquina de estados en memoria (`SessionStoreService`) para trackear en qué paso de la conversación está cada número — WhatsApp no tiene sesión, cada mensaje es un webhook independiente.
- `ConversationService` llama directo a los `Service` de negocio ya existentes (`MovimientosService`, `OrdenesProduccionService`, `StockService`, ...) — la capa conversacional no reimplementa ninguna regla, solo la envuelve en preguntas/respuestas de texto.
- El envío de la respuesta es una llamada aparte a la API REST de Twilio (`client.messages.create`), envuelta en `try/catch` para que un fallo de Twilio no tire un 500 al webhook.

## Cómo adaptar esta base a otro negocio

Este proyecto está armado para ser un punto de partida reusable. Para clonarlo a otro rubro (por ejemplo, otro tipo de manufactura o un comercio con insumos/productos):

1. **Renombrar el dominio de "persona que mueve stock"** si `Operario` no encaja (ej. `Vendedor`, `Encargado`): renombrar modelo en `schema.prisma`, correr `prisma migrate dev`, y renombrar el módulo (`grep -rl "Operario\|operario" src` para ubicar todos los puntos).
2. **Ajustar `Categoria`, `Unidad` y `MovimientoTipo`** en el enum de `schema.prisma` según el negocio — son la única parte realmente específica de "muñecos de tela". El resto (Controller/Service/Repository, motor de stock, validaciones) es genérico.
3. **Revisar la lista `TIPOS_SALIDA`** en `src/stock/stock.service.ts` y `src/movimientos/movimientos.service.ts` si se agregan o quitan tipos de movimiento — es la fuente de verdad sobre qué tipo resta (todo lo que no es `TIPOS_SALIDA` ni `AJUSTE` suma).
4. **Reemplazar `prisma/seed.ts`** por el catálogo real del nuevo negocio, manteniendo el patrón `upsertItem`/`upsert<Entidad>` idempotente.
5. **Multi-tenant (vender esto a otros emprendedores)**: hoy todo el sistema asume un solo negocio — `OWNER_WHATSAPP_NUMBER` es un único número fijo en `.env`. Para SaaS real hace falta un modelo `Negocio`/`Cuenta` que scopee `Item`/`Operario`/`Movimiento`/`OrdenProduccion`, y reemplazar el check de número fijo por una tabla que mapee cada número de WhatsApp a su negocio. Es un cambio de fondo, no incremental — mejor encararlo como su propio sprint una vez validado el flujo de un solo negocio.
5. **`docker-compose.yml` y `.env`**: cambiar `POSTGRES_DB`, nombre del contenedor y del volumen para que convivan varios proyectos de este tipo en la misma máquina sin pisarse.
