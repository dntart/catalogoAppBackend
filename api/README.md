# Textil Stock API

Backend de Textil Stock (antes "StockAsist") como funciones serverless de Next.js (App Router, solo `app/api/**/route.ts`, sin páginas), desplegado en Vercel. Reemplaza al backend original en NestJS/Railway — mismo comportamiento, misma base de datos (Supabase, schema `stockasist` — el nombre del schema no se renombró para no tocar la conexión en producción, es solo un identificador interno).

## Por qué este cambio

El backend original (NestJS) corría en Railway, un tercer proveedor además de Vercel (frontend) y Supabase (base). Para poder reusar la misma infraestructura entre varios SaaS del mismo dueño sin pagar un hosting de backend por cada uno, el backend se reescribió como funciones dentro del mismo proyecto de Vercel — así todo el stack queda en dos proveedores: Vercel + Supabase.

## Estructura

```
api/
  app/api/**/route.ts     Los endpoints — un archivo por ruta (equivalente a los *.controller.ts de NestJS)
  lib/
    prisma.ts             PrismaClient singleton (importante en serverless: evita agotar conexiones)
    auth.ts               JWT (requireUser/requireSuperAdmin, reemplaza JwtAuthGuard/@CurrentUser), errores HTTP tipados
    validate.ts           Corre los DTOs de class-validator a mano (reemplaza el ValidationPipe global)
    rate-limit.ts         Rate limiting persistido en Postgres (ver más abajo)
    container.ts          Instancia cada Service/Repository una vez, ya conectados entre sí (reemplaza los *.module.ts)
    modules/<dominio>/    Repository + Service + DTOs, casi sin cambios respecto a la versión NestJS
  prisma/schema.prisma    Mismo schema que la raíz del repo, misma base de Supabase
```

## Lo único que cambió de verdad: sin memoria compartida entre requests

Vercel Functions son *stateless* — cada invocación puede correr en una instancia distinta. Dos piezas que en NestJS vivían en un `Map` en memoria del proceso **se movieron a Postgres**:

- **Sesión de conversación de WhatsApp** (`sesiones_whatsapp`, ver `lib/modules/whatsapp/conversation/session-store.service.ts`) — en qué paso del flujo está cada número. `ConversationService` la carga una vez al principio de `manejarMensaje()`, la muta en memoria durante el procesamiento (igual que antes), y la guarda **una sola vez al final**, sin importar qué rama del flujo se ejecutó.
- **Rate limiting** (`intentos_rate_limit`, ver `lib/rate-limit.ts`) — cuántos intentos lleva una IP en la ventana actual, para `/api/auth/login` y `/api/negocios/registro`.

Ambas se resolvieron con una tabla en la misma base de Supabase, no con un proveedor nuevo (ej. Upstash Redis) — mantiene todo en dos proveedores.

## Patrón de cada endpoint

Cada `route.ts` sigue el mismo esqueleto:

```ts
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);          // JWT -> negocioId (o 401)
  const dto = await validateBody(CreateXDto, await request.json());
  const resultado = await xService.create(user.negocioId, dto);
  return NextResponse.json(resultado, { status: 201 });
});
```

`withErrorHandling` (en `lib/auth.ts`) convierte los errores tipados (`NotFoundError`, `BadRequestError`, `ConflictError`, `ForbiddenError`, `AuthError`) en la respuesta JSON + status code correspondiente — mismo rol que los `HttpException` de NestJS.

## CORS

`middleware.ts` en la raíz reemplaza `app.enableCors()` — lee `CORS_ORIGIN` (lista separada por comas, mismo formato que antes) y solo agrega el header `Access-Control-Allow-Origin` cuando el origen de la request está en esa lista.

## Variables de entorno

Mismas que tenía Railway: `DATABASE_URL` (Supabase, con `?schema=stockasist`), `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `PUBLIC_APP_URL` (para validar la firma del webhook de Twilio — tiene que ser la URL pública exacta de este proyecto).

## Desarrollo local

```bash
npm install
cp .env.example .env   # completar con los valores reales
npm run dev             # levanta en :3000 (o el puerto que uses)
npm test                # 52 tests — misma cobertura que tenía la version NestJS
```

No hace falta Docker ni Postgres local — `DATABASE_URL` apunta directo a Supabase (schema `stockasist`), igual que producción.

## Deploy

```bash
vercel --prod
```

Mismo proyecto de Vercel siempre — nunca crear uno nuevo por deploy. Las migraciones de Prisma se aplican a mano contra Supabase (`npx prisma migrate deploy` con el `DATABASE_URL` correspondiente) — a diferencia de Railway, acá no hay un paso de arranque que las corra automáticamente en cada deploy.
