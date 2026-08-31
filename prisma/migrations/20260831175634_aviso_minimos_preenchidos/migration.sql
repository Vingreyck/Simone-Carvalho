-- AlterTable
ALTER TABLE "manutencao_automatica" ADD COLUMN     "minimosPreenchidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minimosPreenchidosEm" TIMESTAMP(3);
