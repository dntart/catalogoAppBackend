-- AlterTable
ALTER TABLE "movimientos" ADD COLUMN     "ordenProduccionId" TEXT;

-- CreateTable
CREATE TABLE "ordenes_produccion" (
    "id" TEXT NOT NULL,
    "operarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_produccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordenes_produccion_operarioId_idx" ON "ordenes_produccion"("operarioId");

-- CreateIndex
CREATE INDEX "movimientos_ordenProduccionId_idx" ON "movimientos"("ordenProduccionId");

-- AddForeignKey
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "operarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_ordenProduccionId_fkey" FOREIGN KEY ("ordenProduccionId") REFERENCES "ordenes_produccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
