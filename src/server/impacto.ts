import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { carregarBaseDeCusto } from "@/server/custos";
import {
  analisarImpactoDaCompra,
  type MudancaDeCusto,
} from "@/lib/impacto-preco";

/**
 * O que mostrar pra ela depois de salvar uma compra.
 *
 * Devolve uma versão "achatada" (números viram string) porque isso atravessa a
 * fronteira servidor → cliente: Decimal não sobrevive à serialização.
 */
export type AvisoDeAlta = {
  subiram: {
    nome: string;
    variacao: number;
    custoAnterior: number;
    custoNovo: number;
  }[];
  produtos: {
    id: string;
    nome: string;
    precoVenda: number;
    custoAntes: number;
    custoDepois: number;
    precoSugerido: number;
    virouPrejuizo: boolean;
    jaEstavaNoPrejuizo: boolean;
  }[];
  quantosViraramPrejuizo: number;
};

export async function montarAvisoDeAlta(
  custoAntes: Map<string, Decimal>,
  custoDepois: Map<string, Decimal>,
): Promise<AvisoDeAlta | null> {
  const mudancas: MudancaDeCusto[] = [];

  for (const [insumoId, depois] of custoDepois) {
    const antes = custoAntes.get(insumoId) ?? null;
    if (antes && antes.equals(depois)) continue;
    mudancas.push({ insumoId, nome: "", custoAnterior: antes, custoNovo: depois });
  }

  if (mudancas.length === 0) return null;

  const [base, config, produtos, nomes] = await Promise.all([
    carregarBaseDeCusto(),
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
    prisma.produto.findMany({
      // Produto sem preço de venda não tem como estar no prejuízo ainda
      where: { ativo: true, precoVenda: { gt: 0 } },
      select: {
        id: true,
        nome: true,
        receitaId: true,
        consumoDaReceita: true,
        custoEmbalagem: true,
        tempoExtraMin: true,
        margemAlvo: true,
        precoVenda: true,
      },
    }),
    prisma.insumo.findMany({
      where: { id: { in: mudancas.map((m) => m.insumoId) } },
      select: { id: true, nome: true },
    }),
  ]);

  const nomePorId = new Map(nomes.map((n) => [n.id, n.nome]));
  for (const m of mudancas) m.nome = nomePorId.get(m.insumoId) ?? "insumo";

  const impacto = analisarImpactoDaCompra({
    mudancas,
    receitas: base.receitas,
    insumos: base.insumos,
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      receitaId: p.receitaId,
      consumoDaReceita: p.consumoDaReceita.toString(),
      custoEmbalagem: p.custoEmbalagem.toString(),
      tempoExtraMin: p.tempoExtraMin,
      margemAlvo: p.margemAlvo?.toString() ?? null,
      precoVenda: p.precoVenda.toString(),
    })),
    config: {
      valorHoraMaoDeObra: config?.valorHoraMaoDeObra?.toString() ?? "0",
      percentualCustosFixos: config?.percentualCustosFixos?.toString() ?? "0",
      percentualImpostos: config?.percentualImpostos?.toString() ?? "0",
      percentualTaxaCartao: config?.percentualTaxaCartao?.toString() ?? "0",
      margemLucroPadrao: config?.margemLucroPadrao?.toString() ?? "30",
    },
  });

  if (!impacto.temAlgoPraMostrar) return null;

  return {
    quantosViraramPrejuizo: impacto.quantosViraramPrejuizo,
    subiram: impacto.subiram.map((s) => ({
      nome: s.nome,
      variacao: s.variacao.toNumber(),
      custoAnterior: s.custoAnterior.toNumber(),
      custoNovo: s.custoNovo.toNumber(),
    })),
    produtos: impacto.produtos.map((p) => ({
      id: p.produtoId,
      nome: p.nome,
      precoVenda: p.precoVenda.toNumber(),
      custoAntes: p.custoAntes.toNumber(),
      custoDepois: p.custoDepois.toNumber(),
      precoSugerido: p.precoSugerido.toNumber(),
      virouPrejuizo: p.virouPrejuizo,
      jaEstavaNoPrejuizo: p.situacaoAntes === "prejuizo",
    })),
  };
}
