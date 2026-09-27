-- 1. Tabla de contadores para generar codigos secuenciales por negocio+categoria
CREATE TABLE "secuencias_codigo" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "ultimoValor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secuencias_codigo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "secuencias_codigo_negocioId_categoria_key" ON "secuencias_codigo"("negocioId", "categoria");

ALTER TABLE "secuencias_codigo" ADD CONSTRAINT "secuencias_codigo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Columna codigo en items, nullable por ahora para poder rellenarla antes de exigirla
ALTER TABLE "items" ADD COLUMN "codigo" TEXT;

-- 3. Backfill: numeramos los items existentes por negocio+categoria, en el orden en que se dieron de alta
WITH numerados AS (
  SELECT "id", "negocioId", "categoria",
    ROW_NUMBER() OVER (PARTITION BY "negocioId", "categoria" ORDER BY "createdAt") AS "rn"
  FROM "items"
)
UPDATE "items"
SET "codigo" = (CASE WHEN numerados."categoria" = 'MATERIAL' THEN 'MAT-' ELSE 'PROD-' END) || LPAD(numerados."rn"::text, 4, '0')
FROM numerados
WHERE "items"."id" = numerados."id";

-- 4. Sembramos el contador de cada negocio+categoria con lo ya usado, para que la proxima alta continue la numeracion
INSERT INTO "secuencias_codigo" ("id", "negocioId", "categoria", "ultimoValor")
SELECT gen_random_uuid()::text, "negocioId", "categoria", COUNT(*)
FROM "items"
GROUP BY "negocioId", "categoria";

-- 5. codigo pasa a ser obligatorio y unico por negocio
ALTER TABLE "items" ALTER COLUMN "codigo" SET NOT NULL;
CREATE UNIQUE INDEX "items_negocioId_codigo_key" ON "items"("negocioId", "codigo");
