import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import {
  calcularCustoReceita,
  ReceitaCiclicaError,
  type CustoDaReceita,
  type InsumoParaCusto,
  type ReceitaParaCusto,
} from "@/lib/custo";

/**
 * Carrega tudo que o cálculo de custo precisa, de uma vez só.
 *
 * O custo de uma receita depende das sub-receitas dela, que dependem das delas.
 * Buscar sob demanda geraria uma cascata de consultas; como o volume é pequeno
 * (dezenas de receitas), vale trazer tudo e resolver em memória.
 */
export type BaseDeCusto = {
  receitas: Map<string, ReceitaParaCusto>;
  insumos: Map<string, InsumoParaCusto>;
};

export async function carregarBaseDeCusto(): Promise<BaseDeCusto> {
  const [receitas, insumos] = await Promise.all([
    prisma.receita.findMany({
      select: {
        id: true,
        nome: true,
        rendimentoQuantidade: true,
        rendimentoUnidade: true,
        tempoPreparoMin: true,
        itens: {
          select: {
            insumoId: true,
            subReceitaId: true,
            quantidadeBase: true,
          },
        },
      },
    }),
    prisma.insumo.findMany({
      select: { id: true, nome: true, custoMedio: true, unidadeBase: true },
    }),
  ]);

  return {
    receitas: new Map(
      receitas.map((r) => [
        r.id,
        {
          id: r.id,
          nome: r.nome,
          rendimentoQuantidade: r.rendimentoQuantidade.toString(),
          rendimentoUnidade: r.rendimentoUnidade,
          tempoPreparoMin: r.tempoPreparoMin,
          itens: r.itens.map((i) => ({
            insumoId: i.insumoId,
            subReceitaId: i.subReceitaId,
            quantidadeBase: i.quantidadeBase.toString(),
          })),
        },
      ]),
    ),
    insumos: new Map(
      insumos.map((i) => [
        i.id,
        {
          id: i.id,
          nome: i.nome,
          custoMedio: i.custoMedio.toString(),
          unidadeBase: i.unidadeBase,
        },
      ]),
    ),
  };
}

export type CustoDeProduto = {
  custoIngredientes: Decimal;
  /** Minutos de trabalho atribuídos a UMA unidade do produto */
  tempoTotalMin: number;
  insumosSemPreco: string[];
  erro: string | null;
};

/**
 * Traduz a ficha técnica pro que interessa a UM produto vendido.
 *
 * Exemplo: a receita rende 30 brigadeiros em 40 min. O produto "Caixa com 12"
 * consome 12 desses — leva 12/30 dos ingredientes e 12/30 do tempo (16 min),
 * mais o tempo extra de montar e embalar a caixa.
 */
export function custoDeProduto(
  produto: {
    receitaId: string | null;
    consumoDaReceita: Decimal | number | string;
    tempoExtraMin: number;
  },
  base: BaseDeCusto,
): CustoDeProduto {
  const tempoExtra = produto.tempoExtraMin ?? 0;

  if (!produto.receitaId) {
    return {
      custoIngredientes: new Decimal(0),
      tempoTotalMin: tempoExtra,
      insumosSemPreco: [],
      erro: null,
    };
  }

  const receita = base.receitas.get(produto.receitaId);
  if (!receita) {
    return {
      custoIngredientes: new Decimal(0),
      tempoTotalMin: tempoExtra,
      insumosSemPreco: [],
      erro: "A ficha técnica deste produto não existe mais.",
    };
  }

  const custo = custoSeguro(produto.receitaId, base);
  const consumo = new Decimal(produto.consumoDaReceita);

  const rendimento = new Decimal(receita.rendimentoQuantidade);

  const tempoProporcional = rendimento.greaterThan(0)
    ? new Decimal(receita.tempoPreparoMin ?? 0)
        .times(consumo)
        .dividedBy(rendimento)
    : new Decimal(0);

  return {
    custoIngredientes: custo.custoPorUnidade.times(consumo),
    tempoTotalMin: tempoProporcional.plus(tempoExtra).toNumber(),
    insumosSemPreco: custo.insumosSemPreco,
    erro: custo.erro,
  };
}

/**
 * Custo de uma receita, sem derrubar a tela se houver ciclo.
 * Um dado ruim no banco não pode impedir ela de abrir a lista e consertar.
 */
export function custoSeguro(
  receitaId: string,
  base: BaseDeCusto,
): CustoDaReceita & { erro: string | null } {
  try {
    return { ...calcularCustoReceita(receitaId, base.receitas, base.insumos), erro: null };
  } catch (erro) {
    const mensagem =
      erro instanceof ReceitaCiclicaError
        ? erro.message
        : "Não consegui calcular o custo desta receita.";

    return {
      custoTotal: new Decimal(0),
      custoPorUnidade: new Decimal(0),
      linhas: [],
      insumosSemPreco: [],
      erro: mensagem,
    };
  }
}
