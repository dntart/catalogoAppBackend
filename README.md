# Fauna de Tela

Sistema de gestión de producción e inventario para un emprendimiento de muñecos de tela. Lleva el catálogo de productos y materiales, registra quién hizo qué movimiento (compra, consumo, producción, venta, ajuste) y calcula el stock siempre a partir de ese historial — nunca se edita un número de stock a mano.

Este documento cubre dos cosas: cómo funciona el sistema tal como está hoy, y cómo replicar el proceso completo de armado desde cero (útil si querés adaptar esta misma base a otro rubro/negocio).

---

## Índice

1. [Stack](#stack)
2. [Arquitectura](#arquitectura)
3. [Modelo de datos](#modelo-de-datos)
4. [Motor de stock](#motor-de-stock)
5. [Puesta en marcha (proyecto ya clonado)](#puesta-en-marcha-proyecto-ya-clonado)
6. [Variables de entorno](#variables-de-entorno)
7. [Scripts disponibles](#scripts-disponibles)
8. [API — endpoints](#api--endpoints)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Cómo se construyó desde cero (guía de replicación)](#cómo-se-construyó-desde-cero-guía-de-replicación)
12. [Cómo adaptar esta base a otro negocio](#cómo-adaptar-esta-base-a-otro-negocio)

---

## Stack

- **NestJS** + **TypeScript** (modo `strict`, prohibido `any` — ver `eslint.config.mjs`)
- **Prisma 6** como ORM, generador clásico `prisma-client-js`
- **PostgreSQL 16**, corriendo en Docker vía `docker-compose.yml`
- **class-validator** / **class-transformer** para DTOs
- **@nestjs/swagger** para documentación OpenAPI interactiva (`/docs`)
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
| operarioId | String? | FK a Operario, opcional (una `COMPRA` a proveedor no siempre tiene un operario asociado) |
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

## Puesta en marcha (proyecto ya clonado)

Prerrequisitos: Node.js 20+, Docker Desktop con el motor corriendo (ver [Troubleshooting](#troubleshooting) si `docker info` falla).

```bash
npm install

# copiar y ajustar si hace falta
cp .env.example .env

# levantar Postgres en Docker
docker compose up -d

# aplicar el schema
npx prisma migrate dev

# cargar el catálogo real del negocio
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

> Documentación interactiva completa (probar requests, ver schemas) en `/docs` una vez levantada la API. Lo que sigue es un resumen de referencia rápida.

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

**Movimientos** (`/movimientos`) — el único punto de entrada que afecta el stock
- `POST /movimientos` — crea un movimiento (`CreateMovimientoDto`: `itemId`, `operarioId?`, `tipo`, `cantidad`, `fecha?`, `observaciones?`). Valida que el item (y el operario, si se informa) existan, que la cantidad tenga signo correcto según el tipo, y que no deje stock negativo en `CONSUMO`/`VENTA`.
- `GET /movimientos?itemId=<uuid>` — listar, filtro opcional por item
- `GET /movimientos/:id`

**Stock** (`/stock`)
- `GET /stock/:itemId` — `{ itemId, stock }` calculado en el momento

Todos los endpoints validan el body con `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` (`src/main.ts`): cualquier campo no declarado en el DTO se rechaza con `400`.

## Testing

Tests unitarios de los `Service` (la capa con la lógica de negocio), con el `Repository`/servicios colaboradores mockeados a mano — no se levanta Nest ni la base de datos:

- `stock/stock.service.spec.ts` — suma/resta por tipo, signo de `AJUSTE`, validación de stock insuficiente
- `movimientos/movimientos.service.spec.ts` — validación de item/operario, signo de cantidad por tipo, cuándo se llama a `validarStockSuficiente`
- `items/items.service.spec.ts`, `operarios/operarios.service.spec.ts` — CRUD básico y manejo de `NotFoundException`

```bash
npm test
```

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

### 9. Tests unitarios de los `Service`

Sin levantar Nest ni la base: se instancia el `Service` a mano pasándole un objeto mock tipado como `{ metodo: jest.Mock }`, casteado con `as unknown as <Repository>` (necesario porque las clases de Nest tienen parámetros de constructor `private`, lo que las vuelve nominales para TypeScript). Ver cualquier `*.service.spec.ts` como referencia.

## Cómo adaptar esta base a otro negocio

Este proyecto está armado para ser un punto de partida reusable. Para clonarlo a otro rubro (por ejemplo, otro tipo de manufactura o un comercio con insumos/productos):

1. **Renombrar el dominio de "persona que mueve stock"** si `Operario` no encaja (ej. `Vendedor`, `Encargado`): renombrar modelo en `schema.prisma`, correr `prisma migrate dev`, y renombrar el módulo (`grep -rl "Operario\|operario" src` para ubicar todos los puntos).
2. **Ajustar `Categoria`, `Unidad` y `MovimientoTipo`** en el enum de `schema.prisma` según el negocio — son la única parte realmente específica de "muñecos de tela". El resto (Controller/Service/Repository, motor de stock, validaciones) es genérico.
3. **Revisar las listas `TIPOS_ENTRADA` / `TIPOS_SALIDA`** en `src/stock/stock.service.ts` y `TIPOS_SALIDA` en `src/movimientos/movimientos.service.ts` si se agregan o quitan tipos de movimiento — son la única fuente de verdad sobre qué tipo suma y qué tipo resta.
4. **Reemplazar `prisma/seed.ts`** por el catálogo real del nuevo negocio, manteniendo el patrón `upsertItem`/`upsert<Entidad>` idempotente.
5. **`docker-compose.yml` y `.env`**: cambiar `POSTGRES_DB`, nombre del contenedor y del volumen para que convivan varios proyectos de este tipo en la misma máquina sin pisarse.
