"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { converterParaBase, UnidadeDesconhecidaError } from "@/lib/unidades";
import { calcularCustoReceita, ReceitaCiclicaError } from "@/lib/custo";
import { carregarBaseDeCusto } from "@/server/custos";

export type Resultado = { ok: boolean; erro?: string; id?: string };

const esquemaItem = z
  .object({
    insumoId: z.string().nullish(),
    subReceitaId: z.string().nullish(),
    quantidade: z.coerce.number().positive("A quantidade precisa ser maior que zero."),
    unidade: z.string().trim().min(1, "Escolha a unidade."),
    observacao: z.string().trim().max(200).nullish(),
  })
  .refine((i) => Boolean(i.insumoId) !== Boolean(i.subReceitaId), {
    message: "Cada linha precisa ser OU um ingrediente OU outra receita.",
  });

const esquemaReceita = z.object({
  id: z.string().nullish(),
  nome: z.string().trim().min(2, "Dê um nome à receita.").max(90),
  descricao: z.string().trim().max(300).nullish(),
  categoria: z.string().trim().max(60).nullish(),
  rendimentoQuantidade: z.coerce
    .number()
    .positive("Quanto essa receita rende? Precisa ser maior que zero."),
  rendimentoUnidade: z.string().trim().min(1, "Rende o quê? (bolo, brigadeiros, g...)").max(30),
  tempoPreparoMin: z.coerce.number().int().min(0).max(10_000).default(0),
  modoPreparo: z.string().trim().max(5000).nullish(),
  observacao: z.string().trim().max(500).nullish(),
  itens: z.array(esquemaItem).min(1, "Adicione pelo menos um ingrediente."),
});

/**
 * Cria ou edita uma ficha técnica.
 *
 * Duas validações que o banco sozinho não faz:
 *  - converte a quantidade digitada (xícara, colher) pra unidade base do insumo;
 *  - simula o cálculo de custo ANTES de gravar, pra barrar ciclo entre receitas
 *    (A usa B, B usa A) que travaria a tela de custo depois.
 */
export async function salvarReceita(
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

  const dados = esquemaReceita.safeParse(bruto);
  if (!dados.success) {
    return {
      ok: false,
      erro: dados.error.issues[0]?.message ?? "Confira os dados da receita.",
    };
  }

  const { id, itens, ...cabecalho } = dados.data;

  // ---------------------------------------------- converte as quantidades ----
  const insumosUsados = itens.map((i) => i.insumoId).filter(Boolean) as string[];
  const subReceitasUsadas = itens
    .map((i) => i.subReceitaId)
    .filter(Boolean) as string[];

  const [insumos, subReceitas] = await Promise.all([
    prisma.insumo.findMany({
      where: { id: { in: insumosUsados } },
      include: { equivalencias: true },
    }),
    prisma.receita.findMany({
      where: { id: { in: subReceitasUsadas } },
      select: { id: true, nome: true, rendimentoUnidade: true },
    }),
  ]);

  const porInsumo = new Map(insumos.map((i) => [i.id, i]));
  const porReceita = new Map(subReceitas.map((r) => [r.id, r]));

  type ItemPreparado = {
    insumoId: string | null;
    subReceitaId: string | null;
    quantidade: Decimal;
    unidade: string;
    quantidadeBase: Decimal;
    observacao: string | null;
    ordem: number;
  };

  const preparados: ItemPreparado[] = [];

  for (const [indice, item] of itens.entries()) {
    if (item.insumoId) {
      const insumo = porInsumo.get(item.insumoId);
      if (!insumo) return { ok: false, erro: "Um dos ingredientes não existe mais." };

      let quantidadeBase: Decimal;
      try {
        quantidadeBase = converterParaBase(
          item.quantidade,
          item.unidade,
          insumo.unidadeBase,
          insumo.equivalencias.map((e) => ({
            nome: e.nome,
            quantidadeBase: e.quantidadeBase.toString(),
          })),
        );
      } catch (erro) {
        if (erro instanceof UnidadeDesconhecidaError) {
          return { ok: false, erro: `${insumo.nome}: ${erro.message}` };
        }
        throw erro;
      }

      preparados.push({
        insumoId: insumo.id,
        subReceitaId: null,
        quantidade: new Decimal(item.quantidade),
        unidade: item.unidade,
        quantidadeBase,
        observacao: item.observacao || null,
        ordem: indice,
      });
      continue;
    }

    const sub = porReceita.get(item.subReceitaId!);
    if (!sub) return { ok: false, erro: "Uma das sub-receitas não existe mais." };

    if (id && sub.id === id) {
      return {
        ok: false,
        erro: "Uma receita não pode usar ela mesma como ingrediente.",
      };
    }

    // Sub-receita é medida na unidade de rendimento dela — não precisa converter
    preparados.push({
      insumoId: null,
      subReceitaId: sub.id,
      quantidade: new Decimal(item.quantidade),
      unidade: sub.rendimentoUnidade,
      quantidadeBase: new Decimal(item.quantidade),
      observacao: item.observacao || null,
      ordem: indice,
    });
  }

  // ------------------------------------ simula o custo pra detectar ciclo ----
  if (preparados.some((p) => p.subReceitaId)) {
    const base = await carregarBaseDeCusto();
    const idSimulado = id ?? "__nova__";

    base.receitas.set(idSimulado, {
      id: idSimulado,
      nome: cabecalho.nome,
      rendimentoQuantidade: cabecalho.rendimentoQuantidade,
      rendimentoUnidade: cabecalho.rendimentoUnidade,
      itens: preparados.map((p) => ({
        insumoId: p.insumoId,
        subReceitaId: p.subReceitaId,
        quantidadeBase: p.quantidadeBase.toString(),
      })),
    });

    try {
      calcularCustoReceita(idSimulado, base.receitas, base.insumos);
    } catch (erro) {
      if (erro instanceof ReceitaCiclicaError) {
        return { ok: false, erro: erro.message };
      }
      throw erro;
    }
  }

  // ------------------------------------------------------------- grava ------
  try {
    const receitaId = await prisma.$transaction(async (tx) => {
      if (id) {
        await tx.receita.update({ where: { id }, data: cabecalho });
        // Substitui os itens inteiros: mais simples e seguro que diferenciar
        await tx.receitaItem.deleteMany({ where: { receitaId: id } });
      }

      const receita = id
        ? { id }
        : await tx.receita.create({
            data: cabecalho,
            select: { id: true },
          });

      await tx.receitaItem.createMany({
        data: preparados.map((p) => ({
          receitaId: receita.id,
          insumoId: p.insumoId,
          subReceitaId: p.subReceitaId,
          quantidade: p.quantidade.toFixed(4),
          unidade: p.unidade,
          quantidadeBase: p.quantidadeBase.toFixed(4),
          observacao: p.observacao,
          ordem: p.ordem,
        })),
      });

      return receita.id;
    });

    await atualizarCustoGravado(receitaId);

    revalidatePath("/receitas");
    revalidatePath(`/receitas/${receitaId}`);
    revalidatePath("/produtos");
    revalidatePath("/");

    return { ok: true, id: receitaId };
  } catch (erro) {
    if (
      typeof erro === "object" &&
      erro !== null &&
      "code" in erro &&
      (erro as { code?: string }).code === "P2002"
    ) {
      return { ok: false, erro: `Já existe uma receita chamada "${cabecalho.nome}".` };
    }
    throw erro;
  }
}

/**
 * Grava o custo calculado na receita.
 *
 * É denormalização: o custo real é sempre recalculado das partes, mas guardar
 * o último valor deixa a listagem e o painel rápidos sem percorrer a árvore
 * de sub-receitas de cada uma.
 */
export async function atualizarCustoGravado(receitaId: string) {
  const base = await carregarBaseDeCusto();

  try {
    const custo = calcularCustoReceita(receitaId, base.receitas, base.insumos);

    await prisma.receita.update({
      where: { id: receitaId },
      data: {
        custoCalculado: custo.custoTotal.toFixed(4),
        custoCalculadoEm: new Date(),
      },
    });
  } catch {
    // Ciclo ou receita apagada: deixa o custo antigo e segue. A tela mostra o aviso.
  }
}

export async function alternarAtivoReceita(
  id: string,
  ativo: boolean,
): Promise<Resultado> {
  await exigirSessao();

  await prisma.receita.update({ where: { id }, data: { ativo } });

  revalidatePath("/receitas");
  revalidatePath(`/receitas/${id}`);
  return { ok: true };
}

export async function excluirReceita(id: string): Promise<Resultado> {
  await exigirSessao();

  const [usadaEm, produtos] = await Promise.all([
    prisma.receitaItem.findMany({
      where: { subReceitaId: id },
      select: { receita: { select: { nome: true } } },
      take: 5,
    }),
    prisma.produto.findMany({
      where: { receitaId: id },
      select: { nome: true },
      take: 5,
    }),
  ]);

  if (usadaEm.length > 0) {
    const nomes = [...new Set(usadaEm.map((u) => u.receita.nome))].join(", ");
    return {
      ok: false,
      erro: `Não dá pra apagar: esta receita é usada em ${nomes}. Remova de lá primeiro, ou arquive esta receita.`,
    };
  }

  if (produtos.length > 0) {
    const nomes = produtos.map((p) => p.nome).join(", ");
    return {
      ok: false,
      erro: `Não dá pra apagar: esta receita está ligada aos produtos ${nomes}.`,
    };
  }

  await prisma.receita.delete({ where: { id } });

  revalidatePath("/receitas");
  return { ok: true };
}
