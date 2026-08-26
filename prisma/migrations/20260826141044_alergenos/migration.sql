-- CreateEnum
CREATE TYPE "alergeno" AS ENUM ('GLUTEN', 'CRUSTACEOS', 'OVOS', 'PEIXES', 'AMENDOIM', 'SOJA', 'LEITE', 'AMENDOA', 'AVELA', 'CASTANHA_DE_CAJU', 'CASTANHA_DO_PARA', 'MACADAMIA', 'NOZES', 'PECA', 'PISTACHE', 'PINOLI', 'CASTANHA', 'LATEX');

-- AlterTable
ALTER TABLE "insumos" ADD COLUMN     "alergenos" "alergeno"[],
ADD COLUMN     "alergenosRevisados" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alergenosTraco" "alergeno"[];
