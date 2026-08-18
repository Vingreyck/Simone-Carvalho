import { prisma } from "@/lib/db";
import { carregarBaseDeCusto, custoSeguro } from "@/server/custos";

import type { ReceitaOpcaoProduto } from "@/app/(app)/produtos/editor-produto";

/** Receitas com o custo por unidade, pro editor de produto mostrar a prévia. */
export async function carregarReceitasParaProduto(): Promise<
  ReceitaOpcaoProduto[]
> {
  const [receitas, base] = await Promise.all([
    prisma.receita.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        rendimentoQuantidade: true,
        rendimentoUnidade: true,
      },
    }),
    carregarBaseDeCusto(),
  ]);

  return receitas.map((r) => ({
    id: r.id,
    nome: r.nome,
    rendimentoQuantidade: Number(r.rendimentoQuantidade),
    rendimentoUnidade: r.rendimentoUnidade,
    custoPorUnidade: custoSeguro(r.id, base).custoPorUnidade.toNumber(),
  }));
}
