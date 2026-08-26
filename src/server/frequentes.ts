import { prisma } from "@/lib/db";

/**
 * Os insumos que ela mais usa, pra subirem no topo dos seletores.
 *
 * Conta o uso real (compras e receitas) em vez de deixar tudo em ordem
 * alfabética: são 65 insumos cadastrados, mas o dia a dia gira em torno de uns
 * dez. Rolar a lista inteira toda vez é justamente o tipo de atrito que faz o
 * sistema parecer lento.
 */
export async function insumosMaisUsados(limite = 8): Promise<string[]> {
  const [emCompras, emReceitas] = await Promise.all([
    prisma.compraItem.groupBy({
      by: ["insumoId"],
      _count: { insumoId: true },
    }),
    prisma.receitaItem.groupBy({
      by: ["insumoId"],
      where: { insumoId: { not: null } },
      _count: { insumoId: true },
    }),
  ]);

  const pontos = new Map<string, number>();

  for (const linha of emCompras) {
    pontos.set(linha.insumoId, (pontos.get(linha.insumoId) ?? 0) + linha._count.insumoId);
  }

  // Uso em receita pesa mais: indica o que ela realmente produz, não só o que
  // apareceu uma vez num cupom grande.
  for (const linha of emReceitas) {
    if (!linha.insumoId) continue;
    pontos.set(
      linha.insumoId,
      (pontos.get(linha.insumoId) ?? 0) + linha._count.insumoId * 2,
    );
  }

  return [...pontos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([id]) => id);
}

/**
 * Os produtos que mais saem, pra ficarem à mão na venda de balcão.
 *
 * Conta quantas VEZES o produto apareceu numa venda, não quantas unidades:
 * quem vende brigadeiro de cento em cento ficaria eternamente no topo, mesmo
 * vendendo uma vez por mês.
 */
export async function produtosMaisVendidos(limite = 6): Promise<string[]> {
  const vendas = await prisma.pedidoItem.groupBy({
    by: ["produtoId"],
    where: { pedido: { status: { not: "CANCELADO" } } },
    _count: { produtoId: true },
  });

  return vendas
    .sort((a, b) => b._count.produtoId - a._count.produtoId)
    .slice(0, limite)
    .map((v) => v.produtoId);
}
