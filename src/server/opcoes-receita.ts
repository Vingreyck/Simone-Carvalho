import { prisma } from "@/lib/db";
import { carregarBaseDeCusto, custoSeguro } from "@/server/custos";
import { insumosMaisUsados } from "@/server/frequentes";

import type {
  InsumoOpcao,
  ReceitaOpcao,
} from "@/app/(app)/receitas/editor-receita";

/**
 * O que o editor de ficha técnica precisa pra calcular custo enquanto ela digita:
 * os insumos com preço e as receitas já existentes com o custo por unidade.
 */
export async function carregarOpcoesDoEditor(excluirReceitaId?: string): Promise<{
  insumos: InsumoOpcao[];
  receitas: ReceitaOpcao[];
  frequentes: string[];
}> {
  const [insumos, receitas, base, frequentes] = await Promise.all([
    prisma.insumo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        unidadeBase: true,
        custoMedio: true,
        equivalencias: {
          select: { nome: true, quantidadeBase: true },
          orderBy: { nome: "asc" },
        },
      },
    }),
    prisma.receita.findMany({
      where: { ativo: true, ...(excluirReceitaId ? { id: { not: excluirReceitaId } } : {}) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, rendimentoUnidade: true },
    }),
    carregarBaseDeCusto(),
    insumosMaisUsados(),
  ]);

  return {
    frequentes,
    insumos: insumos.map((i) => ({
      id: i.id,
      nome: i.nome,
      categoria: i.categoria,
      unidadeBase: i.unidadeBase,
      custoMedio: Number(i.custoMedio),
      equivalencias: i.equivalencias.map((e) => ({
        nome: e.nome,
        quantidadeBase: Number(e.quantidadeBase),
      })),
    })),
    receitas: receitas.map((r) => ({
      id: r.id,
      nome: r.nome,
      rendimentoUnidade: r.rendimentoUnidade,
      custoPorUnidade: custoSeguro(r.id, base).custoPorUnidade.toNumber(),
    })),
  };
}
