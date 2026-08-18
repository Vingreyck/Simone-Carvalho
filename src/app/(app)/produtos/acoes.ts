"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";

export type Resultado = { ok: boolean; erro?: string; id?: string };

const esquema = z.object({
  id: z.string().nullish(),
  nome: z.string().trim().min(2, "Dê um nome ao produto.").max(90),
  descricao: z.string().trim().max(300).nullish(),
  categoria: z.string().trim().max(60).nullish(),
  receitaId: z.string().nullish(),
  consumoDaReceita: z.coerce
    .number()
    .positive("Quanto da receita esse produto usa? Precisa ser maior que zero.")
    .default(1),
  custoEmbalagem: z.coerce.number().min(0, "Não pode ser negativo.").default(0),
  tempoExtraMin: z.coerce.number().int().min(0).max(10_000).default(0),
  precoVenda: z.coerce.number().min(0, "Não pode ser negativo.").default(0),
  margemAlvo: z.coerce.number().min(0).max(99).nullish(),
});

export async function salvarProduto(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  let bruto: unknown;
  try {
    bruto = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, erro: "Não consegui ler os dados do formulário." };
  }

  const dados = esquema.safeParse(bruto);
  if (!dados.success) {
    return {
      ok: false,
      erro: dados.error.issues[0]?.message ?? "Confira os dados do produto.",
    };
  }

  const { id, margemAlvo, receitaId, ...resto } = dados.data;

  const dadosGravar = {
    ...resto,
    receitaId: receitaId || null,
    // null = "usar a margem padrão dos Ajustes"
    margemAlvo: margemAlvo ?? null,
  };

  try {
    if (id) {
      await prisma.produto.update({ where: { id }, data: dadosGravar });
      revalidarTudo(id);
      return { ok: true, id };
    }

    const criado = await prisma.produto.create({
      data: dadosGravar,
      select: { id: true },
    });

    revalidarTudo(criado.id);
    return { ok: true, id: criado.id };
  } catch (erro) {
    if (
      typeof erro === "object" &&
      erro !== null &&
      "code" in erro &&
      (erro as { code?: string }).code === "P2002"
    ) {
      return { ok: false, erro: `Já existe um produto chamado "${resto.nome}".` };
    }
    throw erro;
  }
}

/** Grava o preço direto da tela de precificação, sem abrir o formulário todo. */
export async function definirPrecoVenda(
  id: string,
  precoVenda: number,
): Promise<Resultado> {
  await exigirSessao();

  if (!Number.isFinite(precoVenda) || precoVenda < 0) {
    return { ok: false, erro: "Preço inválido." };
  }

  await prisma.produto.update({
    where: { id },
    data: { precoVenda },
  });

  revalidarTudo(id);
  return { ok: true };
}

export async function alternarAtivoProduto(
  id: string,
  ativo: boolean,
): Promise<Resultado> {
  await exigirSessao();
  await prisma.produto.update({ where: { id }, data: { ativo } });
  revalidarTudo(id);
  return { ok: true };
}

export async function excluirProduto(id: string): Promise<Resultado> {
  await exigirSessao();

  const vendido = await prisma.pedidoItem.count({ where: { produtoId: id } });

  if (vendido > 0) {
    return {
      ok: false,
      erro:
        "Este produto já foi vendido, então não dá pra apagar sem perder o " +
        "histórico. Use Arquivar pra tirar da lista.",
    };
  }

  await prisma.produto.delete({ where: { id } });
  revalidatePath("/produtos");
  return { ok: true };
}

function revalidarTudo(id: string) {
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  revalidatePath("/");
}
