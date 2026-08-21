import { prisma } from "@/lib/db";

import type {
  ClienteOpcao,
  ProdutoOpcao,
} from "@/app/(app)/vendas/editor-pedido";

/** Produtos e clientes que o editor de pedido oferece. */
export async function carregarOpcoesDoPedido(): Promise<{
  produtos: ProdutoOpcao[];
  clientes: ClienteOpcao[];
}> {
  const [produtos, clientes] = await Promise.all([
    prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, precoVenda: true },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, telefone: true },
    }),
  ]);

  return {
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      precoVenda: Number(p.precoVenda),
    })),
    clientes,
  };
}
