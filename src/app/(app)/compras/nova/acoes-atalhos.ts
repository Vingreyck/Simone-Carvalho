"use server";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { casarInsumo } from "@/lib/correspondencia";

import type { ItemLido } from "./acoes-ia";

export type AtalhoCarregado = {
  ok: boolean;
  erro?: string;
  fornecedor?: string | null;
  itens?: ItemLido[];
};

/**
 * Traz a última compra pra ela só ajustar os preços.
 *
 * Compra de doceria é quase sempre a mesma lista: farinha, açúcar, leite
 * condensado, ovos. O que muda é o preço. Repetir a última e corrigir dois
 * valores é muito mais rápido que montar tudo de novo.
 */
export async function carregarUltimaCompra(): Promise<AtalhoCarregado> {
  await exigirSessao();

  const compra = await prisma.compra.findFirst({
    orderBy: { data: "desc" },
    include: {
      fornecedor: { select: { nome: true } },
      itens: {
        include: { insumo: { select: { id: true, nome: true, ativo: true } } },
      },
    },
  });

  if (!compra) {
    return { ok: false, erro: "Você ainda não lançou nenhuma compra." };
  }

  const itens: ItemLido[] = compra.itens
    .filter((i) => i.insumo.ativo)
    .map((i) => ({
      descricao: i.insumo.nome,
      insumoId: i.insumo.id,
      insumoNome: i.insumo.nome,
      confiante: true,
      quantidade: Number(i.quantidadeEmbalagens),
      tamanhoEmbalagem: Number(i.tamanhoEmbalagem),
      unidade: i.unidadeEmbalagem,
      // Preço em branco de propósito: repetir o valor antigo faria o custo
      // médio parecer certo estando errado. Ela preenche olhando o cupom.
      valorTotal: 0,
    }));

  if (itens.length === 0) {
    return {
      ok: false,
      erro: "Os insumos daquela compra foram arquivados.",
    };
  }

  return { ok: true, fornecedor: compra.fornecedor?.nome ?? null, itens };
}

/**
 * Interpreta uma lista digitada em texto corrido.
 *
 * Formato: um item por linha, `nome quantidade valor` — por exemplo
 * `farinha 5kg 28`. É pra quando ela prefere digitar de uma vez, sem cupom
 * na mão e sem passar por seletor nenhum.
 *
 * Sem IA: é uma expressão regular. Determinístico, instantâneo e de graça.
 */
export async function interpretarLista(texto: string): Promise<AtalhoCarregado> {
  await exigirSessao();

  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (linhas.length === 0) {
    return { ok: false, erro: "Escreva pelo menos uma linha." };
  }

  const insumos = await prisma.insumo.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
  });

  const itens: ItemLido[] = linhas.map((linha) => {
    /**
     * Quebra "2 sacos de farinha 5kg 28,00" em partes.
     *  - quantidade: número solto no começo (opcional, padrão 1)
     *  - medida: número colado numa unidade em qualquer lugar (5kg, 395g, 1l)
     *  - valor: último número da linha
     */
    const medida = linha.match(/(\d+[.,]?\d*)\s*(kg|g|ml|l|un)\b/i);
    const valor = linha.match(/(\d+[.,]\d{2}|\d+)\s*$/);
    const quantidadeInicial = linha.match(/^(\d+)\s+(?!\s*$)/);

    // O nome é o que sobra depois de tirar números e unidades
    const nome = linha
      .replace(/(\d+[.,]?\d*)\s*(kg|g|ml|l|un)\b/gi, " ")
      .replace(/(\d+[.,]\d{2}|\d+)\s*$/, " ")
      .replace(/^\d+\s+/, " ")
      .trim();

    const casado = casarInsumo(nome || linha, insumos);

    return {
      descricao: nome || linha,
      insumoId: casado?.id ?? null,
      insumoNome: casado?.nome ?? null,
      confiante: false,
      quantidade: quantidadeInicial ? Number(quantidadeInicial[1]) : 1,
      tamanhoEmbalagem: medida ? Number(medida[1]!.replace(",", ".")) : 1,
      unidade: medida ? medida[2]!.toLowerCase() : "",
      valorTotal: valor ? Number(valor[1]!.replace(",", ".")) : 0,
    };
  });

  return { ok: true, itens };
}
