-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('MATERIAL', 'PRODUCTO');

-- CreateEnum
CREATE TYPE "Unidad" AS ENUM ('METRO', 'KG', 'CONO', 'UNIDAD');

-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('COMPRA', 'CONSUMO', 'PRODUCCION', 'VENTA', 'AJUSTE');

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "unidad" "Unidad" NOT NULL,
    "tieneColor" BOOLEAN NOT NULL DEFAULT false,
    "colorNombre" TEXT,
    "imagenUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "operarioId" TEXT,
    "tipo" "MovimientoTipo" NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "items_nombre_colorNombre_key" ON "items"("nombre", "colorNombre");

-- CreateIndex
CREATE INDEX "movimientos_itemId_idx" ON "movimientos"("itemId");

-- CreateIndex
CREATE INDEX "movimientos_operarioId_idx" ON "movimientos"("operarioId");

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "operarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
