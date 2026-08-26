import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { carregarBaseDeCusto } from "@/server/custos";
import { montarPlano, type ItemPendente, type Plano } from "@/lib/plano";

/**
 * Monta a lista do dia a partir das encomendas que ainda não saíram.
 *
 * Orçamento fica de fora de propósito: a cliente ainda não confirmou, e assar
 * o que talvez não seja vendido é desperdício de insumo e de tempo dela.
 */
export async function carregarPlano(): Promise<Plano> {
  const [pedidos, base, produtos, saldos] = await Promise.all([
    prisma.pedido.findMany({
      where: { status: { in: ["CONFIRMADO", "EM_PRODUCAO", "PRONTO"] } },
      select: {
        id: true,
        numero: true,
        dataEntrega: true,
        cliente: { select: { nome: true } },
        itens: {
          select: {
            produtoId: true,
            quantidade: true,
            produto: { select: { nome: true } },
          },
        },
      },
    }),
    carregarBaseDeCusto(),
    prisma.produto.findMany({
      select: { id: true, receitaId: true, consumoDaReceita: true },
    }),
    prisma.insumoLote.groupBy({
      by: ["insumoId"],
      _sum: { quantidadeRestante: true },
    }),
  ]);

  const itens: ItemPendente[] = pedidos.flatMap((pedido) =>
    pedido.itens.map((item) => ({
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero,
      cliente: pedido.cliente?.nome ?? null,
      dataEntrega: pedido.dataEntrega,
      produtoId: item.produtoId,
      produtoNome: item.produto?.nome ?? "Produto apagado",
      quantidade: item.quantidade.toString(),
    })),
  );

  return montarPlano({
    itens,
    produtos: new Map(
      produtos.map((p) => [
        p.id,
        {
          id: p.id,
          receitaId: p.receitaId,
          consumoDaReceita: p.consumoDaReceita.toString(),
        },
      ]),
    ),
    receitas: base.receitas,
    insumos: base.insumos,
    saldos: new Map(
      saldos.map((s) => [
        s.insumoId,
        new Decimal(s._sum.quantidadeRestante?.toString() ?? 0),
      ]),
    ),
    hoje: new Date(),
  });
}
