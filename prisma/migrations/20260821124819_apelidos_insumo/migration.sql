-- CreateTable
CREATE TABLE "apelidos_insumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "textoOriginal" TEXT NOT NULL,
    "vezesUsado" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apelidos_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apelidos_insumo_texto_key" ON "apelidos_insumo"("texto");

-- CreateIndex
CREATE INDEX "apelidos_insumo_insumoId_idx" ON "apelidos_insumo"("insumoId");

-- AddForeignKey
ALTER TABLE "apelidos_insumo" ADD CONSTRAINT "apelidos_insumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
