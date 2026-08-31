-- CreateTable
CREATE TABLE "manutencao_automatica" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "ultimaExecucao" TIMESTAMP(3),

    CONSTRAINT "manutencao_automatica_pkey" PRIMARY KEY ("id")
);
