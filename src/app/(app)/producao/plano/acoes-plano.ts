"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { registrarProducao, type Resultado } from "../acoes";

/**
 * "Já fiz" direto da lista.
 *
 * Antes disso o ciclo ficava aberto: a tela mandava fazer 6 bolos, ela fazia,
 * marcava o pedido como pronto — e o estoque não baixava. Ela teria que ir em
 * Produção e digitar tudo de novo.
 *
 * O problema não é só o trabalho dobrado: quando ela esquece (e vai esquecer),
 * o saldo vira ficção, e aí a própria lista de "o que falta comprar" passa a
 * mentir. Um botão que fecha o ciclo vale mais que a tela toda.
 */
export async function registrarDoPlano(
  receitaId: string,
  vezes: number,
  produtoId: string,
): Promise<Resultado> {
  await exigirSessao();

  // Monta o mesmo FormData que o formulário de produção monta, pra reusar a
  // ação de verdade — com baixa FIFO, custo real e recálculo do custo médio.
  const dados = new FormData();
  dados.set("receitaId", receitaId);
  dados.set("quantidade", String(vezes));
  dados.set("data", new Date().toISOString().slice(0, 10));
  dados.set("observacao", "Registrado pela lista do dia");

  const resultado = await registrarProducao({ ok: false }, dados);
  if (!resultado.ok) return resultado;

  await marcarPedidosProntos(produtoId);

  revalidatePath("/producao/plano");
  revalidatePath("/vendas");
  revalidatePath("/");

  return resultado;
}

/**
 * Tira da lista o que acabou de ser feito.
 *
 * Só marca PRONTO o pedido em que **todos** os itens são o produto produzido.
 * Pedido com dois produtos fica como está: dizer que está pronto quando só
 * metade foi feita sumiria com a outra metade da lista dela, e o doce que
 * faltava seria esquecido.
 */
async function marcarPedidosProntos(produtoId: string): Promise<void> {
  const pedidos = await prisma.pedido.findMany({
    where: {
      status: { in: ["CONFIRMADO", "EM_PRODUCAO"] },
      itens: { some: { produtoId } },
    },
    select: { id: true, itens: { select: { produtoId: true } } },
  });

  const soDesteProduto = pedidos
    .filter((p) => p.itens.every((i) => i.produtoId === produtoId))
    .map((p) => p.id);

  if (soDesteProduto.length === 0) return;

  await prisma.pedido.updateMany({
    where: { id: { in: soDesteProduto } },
    data: { status: "PRONTO" },
  });
}
