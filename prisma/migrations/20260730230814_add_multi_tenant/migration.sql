-- 1. Crear tabla negocios (tenants)
CREATE TABLE "negocios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negocios_pkey" PRIMARY KEY ("id")
);

-- 2. Crear el negocio existente (todo lo que ya habia en la base pasa a ser suyo)
INSERT INTO "negocios" ("id", "nombre", "activo", "createdAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Fauna de Tela', true, CURRENT_TIMESTAMP);

-- 3. Agregar negocioId nullable primero (para poder rellenar antes de exigirlo)
ALTER TABLE "users" ADD COLUMN "negocioId" TEXT;
ALTER TABLE "items" ADD COLUMN "negocioId" TEXT;
ALTER TABLE "operarios" ADD COLUMN "negocioId" TEXT;
ALTER TABLE "movimientos" ADD COLUMN "negocioId" TEXT;
ALTER TABLE "ordenes_produccion" ADD COLUMN "negocioId" TEXT;

-- 4. Backfill: todo lo existente pertenece al negocio recien creado
UPDATE "users" SET "negocioId" = '00000000-0000-4000-8000-000000000001';
UPDATE "items" SET "negocioId" = '00000000-0000-4000-8000-000000000001';
UPDATE "operarios" SET "negocioId" = '00000000-0000-4000-8000-000000000001';
UPDATE "movimientos" SET "negocioId" = '00000000-0000-4000-8000-000000000001';
UPDATE "ordenes_produccion" SET "negocioId" = '00000000-0000-4000-8000-000000000001';

-- 5. Ahora si, negocioId pasa a ser obligatorio
ALTER TABLE "users" ALTER COLUMN "negocioId" SET NOT NULL;
ALTER TABLE "items" ALTER COLUMN "negocioId" SET NOT NULL;
ALTER TABLE "operarios" ALTER COLUMN "negocioId" SET NOT NULL;
ALTER TABLE "movimientos" ALTER COLUMN "negocioId" SET NOT NULL;
ALTER TABLE "ordenes_produccion" ALTER COLUMN "negocioId" SET NOT NULL;

-- 6. Nuevas columnas en users: numero de WhatsApp del dueño + flag de super-admin
ALTER TABLE "users" ADD COLUMN "whatsappNumber" TEXT;
ALTER TABLE "users" ADD COLUMN "esSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- 7. Nueva columna en items: umbral de stock minimo para alertas
ALTER TABLE "items" ADD COLUMN "stockMinimo" DECIMAL(10,2);

-- 8. El unique de items era global (nombre, colorNombre); pasa a ser por negocio
DROP INDEX "items_nombre_colorNombre_key";
CREATE UNIQUE INDEX "items_negocioId_nombre_colorNombre_key" ON "items"("negocioId", "nombre", "colorNombre");

-- 9. Unique del numero de WhatsApp (un numero = un solo usuario)
CREATE UNIQUE INDEX "users_whatsappNumber_key" ON "users"("whatsappNumber");

-- 10. Foreign keys hacia negocios
ALTER TABLE "users" ADD CONSTRAINT "users_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operarios" ADD CONSTRAINT "operarios_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 11. Indices por negocio (todas las consultas van a filtrar por esto)
CREATE INDEX "items_negocioId_idx" ON "items"("negocioId");
CREATE INDEX "operarios_negocioId_idx" ON "operarios"("negocioId");
CREATE INDEX "movimientos_negocioId_idx" ON "movimientos"("negocioId");
CREATE INDEX "ordenes_produccion_negocioId_idx" ON "ordenes_produccion"("negocioId");
