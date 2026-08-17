-- CreateEnum
CREATE TYPE "unidade_base" AS ENUM ('G', 'ML', 'UN');

-- CreateEnum
CREATE TYPE "categoria_insumo" AS ENUM ('FARINHAS_E_SECOS', 'ACUCARES', 'LATICINIOS', 'OVOS', 'CHOCOLATES_E_CACAU', 'FRUTAS', 'GORDURAS', 'FERMENTOS_E_ADITIVOS', 'ESSENCIAS_E_CORANTES', 'CONFEITOS_E_DECORACAO', 'EMBALAGENS', 'DESCARTAVEIS', 'OUTROS');

-- CreateEnum
CREATE TYPE "tipo_movimento" AS ENUM ('ENTRADA_COMPRA', 'SAIDA_PRODUCAO', 'PERDA', 'AJUSTE_INVENTARIO', 'DEVOLUCAO');

-- CreateEnum
CREATE TYPE "status_producao" AS ENUM ('PLANEJADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "status_pedido" AS ENUM ('ORCAMENTO', 'CONFIRMADO', 'EM_PRODUCAO', 'PRONTO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "canal_venda" AS ENUM ('LOJA', 'WHATSAPP', 'INSTAGRAM', 'INDICACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "tipo_lancamento" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "status_lancamento" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "tipo_camera" AS ENUM ('GO2RTC', 'HLS', 'MJPEG', 'IFRAME');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLogin" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "categoria_insumo" NOT NULL DEFAULT 'OUTROS',
    "unidadeBase" "unidade_base" NOT NULL,
    "estoqueMinimo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "custoMedio" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "custoUltimaCompra" DECIMAL(14,6),
    "dataUltimaCompra" TIMESTAMP(3),
    "perecivel" BOOLEAN NOT NULL DEFAULT false,
    "marcaPreferida" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumo_equivalencias" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidadeBase" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "insumo_equivalencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_preco_insumos" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "custoUnitario" DECIMAL(14,6) NOT NULL,
    "origem" TEXT NOT NULL,
    "compraId" TEXT,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_preco_insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "endereco" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fornecedorId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorFrete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notaFiscal" TEXT,
    "anexoUrl" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra_itens" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidadeEmbalagens" DECIMAL(14,4) NOT NULL,
    "tamanhoEmbalagem" DECIMAL(14,4) NOT NULL,
    "unidadeEmbalagem" TEXT NOT NULL,
    "quantidadeBase" DECIMAL(14,4) NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "custoUnitarioBase" DECIMAL(14,6) NOT NULL,
    "validade" TIMESTAMP(3),

    CONSTRAINT "compra_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumo_lotes" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "compraId" TEXT,
    "compraItemId" TEXT,
    "quantidadeInicial" DECIMAL(14,4) NOT NULL,
    "quantidadeRestante" DECIMAL(14,4) NOT NULL,
    "custoUnitario" DECIMAL(14,6) NOT NULL,
    "validade" TIMESTAMP(3),
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insumo_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_estoque" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "loteId" TEXT,
    "tipo" "tipo_movimento" NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "custoUnitario" DECIMAL(14,6) NOT NULL,
    "saldoApos" DECIMAL(14,4) NOT NULL,
    "producaoId" TEXT,
    "motivo" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receitas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "rendimentoQuantidade" DECIMAL(14,4) NOT NULL,
    "rendimentoUnidade" TEXT NOT NULL,
    "tempoPreparoMin" INTEGER NOT NULL DEFAULT 0,
    "modoPreparo" TEXT,
    "fotoUrl" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "custoCalculado" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "custoCalculadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receita_itens" (
    "id" TEXT NOT NULL,
    "receitaId" TEXT NOT NULL,
    "insumoId" TEXT,
    "subReceitaId" TEXT,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidadeBase" DECIMAL(14,4) NOT NULL,
    "observacao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receita_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "receitaId" TEXT,
    "consumoDaReceita" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "custoEmbalagem" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tempoExtraMin" INTEGER NOT NULL DEFAULT 0,
    "precoVenda" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "margemAlvo" DECIMAL(5,2),
    "fotoUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_precificacao" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "valorHoraMaoDeObra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "percentualCustosFixos" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "percentualImpostos" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "percentualTaxaCartao" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "margemLucroPadrao" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "faturamentoMedioMensal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "alertaVariacaoPreco" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "diasAlertaValidade" INTEGER NOT NULL DEFAULT 7,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_precificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_negocio" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "nomeFantasia" TEXT NOT NULL DEFAULT 'Simone Carvalho Doceria',
    "telefone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "endereco" TEXT,
    "cnpj" TEXT,
    "logoUrl" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producoes" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "receitaId" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "status_producao" NOT NULL DEFAULT 'CONCLUIDA',
    "custoTotal" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "aniversario" TIMESTAMP(3),
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "clienteId" TEXT,
    "dataPedido" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataEntrega" TIMESTAMP(3),
    "status" "status_pedido" NOT NULL DEFAULT 'ORCAMENTO',
    "canal" "canal_venda" NOT NULL DEFAULT 'WHATSAPP',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxaEntrega" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sinalPago" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "formaPagamento" TEXT,
    "enderecoEntrega" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_itens" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "precoUnitario" DECIMAL(12,2) NOT NULL,
    "custoUnitarioSnapshot" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "observacao" TEXT,

    CONSTRAINT "pedido_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_financeiras" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "tipo_lancamento" NOT NULL,
    "cor" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos" (
    "id" TEXT NOT NULL,
    "tipo" "tipo_lancamento" NOT NULL,
    "categoriaId" TEXT,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "status" "status_lancamento" NOT NULL DEFAULT 'PENDENTE',
    "formaPagamento" TEXT,
    "observacao" TEXT,
    "compraId" TEXT,
    "pedidoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custos_fixos_mensais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "diaVencimento" INTEGER,
    "categoriaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custos_fixos_mensais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cameras" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "local" TEXT,
    "tipo" "tipo_camera" NOT NULL DEFAULT 'GO2RTC',
    "url" TEXT NOT NULL,
    "streamId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "insumos_nome_key" ON "insumos"("nome");

-- CreateIndex
CREATE INDEX "insumos_categoria_idx" ON "insumos"("categoria");

-- CreateIndex
CREATE INDEX "insumos_ativo_idx" ON "insumos"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "insumo_equivalencias_insumoId_nome_key" ON "insumo_equivalencias"("insumoId", "nome");

-- CreateIndex
CREATE INDEX "historico_preco_insumos_insumoId_registradoEm_idx" ON "historico_preco_insumos"("insumoId", "registradoEm");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_nome_key" ON "fornecedores"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "compras_numero_key" ON "compras"("numero");

-- CreateIndex
CREATE INDEX "compras_data_idx" ON "compras"("data");

-- CreateIndex
CREATE INDEX "compra_itens_insumoId_idx" ON "compra_itens"("insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "insumo_lotes_compraItemId_key" ON "insumo_lotes"("compraItemId");

-- CreateIndex
CREATE INDEX "insumo_lotes_insumoId_quantidadeRestante_idx" ON "insumo_lotes"("insumoId", "quantidadeRestante");

-- CreateIndex
CREATE INDEX "insumo_lotes_validade_idx" ON "insumo_lotes"("validade");

-- CreateIndex
CREATE INDEX "movimentos_estoque_insumoId_data_idx" ON "movimentos_estoque"("insumoId", "data");

-- CreateIndex
CREATE INDEX "movimentos_estoque_tipo_idx" ON "movimentos_estoque"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "receitas_nome_key" ON "receitas"("nome");

-- CreateIndex
CREATE INDEX "receitas_ativo_idx" ON "receitas"("ativo");

-- CreateIndex
CREATE INDEX "receita_itens_receitaId_ordem_idx" ON "receita_itens"("receitaId", "ordem");

-- CreateIndex
CREATE INDEX "receita_itens_insumoId_idx" ON "receita_itens"("insumoId");

-- CreateIndex
CREATE INDEX "receita_itens_subReceitaId_idx" ON "receita_itens"("subReceitaId");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_nome_key" ON "produtos"("nome");

-- CreateIndex
CREATE INDEX "produtos_ativo_idx" ON "produtos"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "producoes_numero_key" ON "producoes"("numero");

-- CreateIndex
CREATE INDEX "producoes_data_idx" ON "producoes"("data");

-- CreateIndex
CREATE INDEX "clientes_nome_idx" ON "clientes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");

-- CreateIndex
CREATE INDEX "pedidos_dataEntrega_idx" ON "pedidos"("dataEntrega");

-- CreateIndex
CREATE INDEX "pedidos_status_idx" ON "pedidos"("status");

-- CreateIndex
CREATE INDEX "pedido_itens_pedidoId_idx" ON "pedido_itens"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_financeiras_nome_tipo_key" ON "categorias_financeiras"("nome", "tipo");

-- CreateIndex
CREATE INDEX "lancamentos_dataVencimento_idx" ON "lancamentos"("dataVencimento");

-- CreateIndex
CREATE INDEX "lancamentos_status_tipo_idx" ON "lancamentos"("status", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "custos_fixos_mensais_nome_key" ON "custos_fixos_mensais"("nome");

-- AddForeignKey
ALTER TABLE "insumo_equivalencias" ADD CONSTRAINT "insumo_equivalencias_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_preco_insumos" ADD CONSTRAINT "historico_preco_insumos_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_itens" ADD CONSTRAINT "compra_itens_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_itens" ADD CONSTRAINT "compra_itens_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_lotes" ADD CONSTRAINT "insumo_lotes_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_lotes" ADD CONSTRAINT "insumo_lotes_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_lotes" ADD CONSTRAINT "insumo_lotes_compraItemId_fkey" FOREIGN KEY ("compraItemId") REFERENCES "compra_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "insumo_lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_producaoId_fkey" FOREIGN KEY ("producaoId") REFERENCES "producoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_itens" ADD CONSTRAINT "receita_itens_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "receitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_itens" ADD CONSTRAINT "receita_itens_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_itens" ADD CONSTRAINT "receita_itens_subReceitaId_fkey" FOREIGN KEY ("subReceitaId") REFERENCES "receitas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "receitas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes" ADD CONSTRAINT "producoes_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "receitas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Regras que o Prisma não expressa no schema, mas que o banco precisa garantir.
-- Sem isso, um bug na aplicação conseguiria gravar dado que quebra os cálculos.
-- ---------------------------------------------------------------------------

-- Um item da ficha técnica é OU um insumo OU uma sub-receita — nunca os dois,
-- nunca nenhum. Se os dois ficassem vazios, o custo da receita sairia errado.
ALTER TABLE "receita_itens"
  ADD CONSTRAINT "receita_item_insumo_ou_subreceita"
  CHECK (("insumoId" IS NOT NULL) <> ("subReceitaId" IS NOT NULL));

-- Receita não pode ser sub-receita dela mesma (laço infinito no cálculo de custo).
-- Ciclos mais longos (A→B→A) são barrados na aplicação, que percorre a árvore.
ALTER TABLE "receita_itens"
  ADD CONSTRAINT "receita_item_sem_autorreferencia"
  CHECK ("subReceitaId" IS NULL OR "subReceitaId" <> "receitaId");

-- Quantidade de item de ficha técnica tem que ser positiva.
ALTER TABLE "receita_itens"
  ADD CONSTRAINT "receita_item_quantidade_positiva"
  CHECK ("quantidade" > 0 AND "quantidadeBase" > 0);

-- Rendimento zero faria divisão por zero no custo por porção.
ALTER TABLE "receitas"
  ADD CONSTRAINT "receita_rendimento_positivo"
  CHECK ("rendimentoQuantidade" > 0);

-- Estoque de um lote nunca fica negativo nem passa do que entrou.
ALTER TABLE "insumo_lotes"
  ADD CONSTRAINT "lote_saldo_valido"
  CHECK ("quantidadeRestante" >= 0 AND "quantidadeRestante" <= "quantidadeInicial");

-- Compra sempre gera quantidade e valor positivos.
ALTER TABLE "compra_itens"
  ADD CONSTRAINT "compra_item_valores_positivos"
  CHECK ("quantidadeBase" > 0 AND "valorTotal" >= 0);

-- Produção de "zero receitas" não faz sentido e zeraria a baixa de estoque.
ALTER TABLE "producoes"
  ADD CONSTRAINT "producao_quantidade_positiva"
  CHECK ("quantidade" > 0);
