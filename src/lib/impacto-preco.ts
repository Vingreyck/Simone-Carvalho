import { Decimal } from "decimal.js";

import { calcularCustoReceita, type InsumoParaCusto, type ReceitaParaCusto } from "./custo";
import {
  analisarPreco,
  calcularPrecoSugerido,
  type ConfigPrecificacao,
  type SituacaoPreco,
} from "./precificacao";

/**
 * O que uma compra fez com os preços de venda.
 *
 * Esta é a razão de o sistema existir. A dor central da Simone não é não saber
 * o custo — é o custo mudar **sem ela perceber**: a farinha sobe, o preço de
 * venda continua igual, e ela vende no prejuízo por meses sem entender por quê.
 *
 * O momento de avisar é agora, quando ela acaba de lançar a compra — é o
 * instante em que o sistema descobre. Esperar que ela vá procurar na tela de
 * produtos é esperar que ela desconfie de algo que não tem como perceber.
 */

export type MudancaDeCusto = {
  insumoId: string;
  nome: string;
  /** null quando é a primeira compra — não há com o que comparar */
  custoAnterior: Decimal | null;
  custoNovo: Decimal;
};

export type InsumoQueSubiu = {
  insumoId: string;
  nome: string;
  variacao: Decimal;
  custoAnterior: Decimal;
  custoNovo: Decimal;
};

export type ProdutoAfetado = {
  produtoId: string;
  nome: string;
  precoVenda: Decimal;
  custoAntes: Decimal;
  custoDepois: Decimal;
  situacaoAntes: SituacaoPreco;
  situacaoDepois: SituacaoPreco;
  precoSugerido: Decimal;
  /** Estava dando lucro e passou a dar prejuízo — o caso mais grave */
  virouPrejuizo: boolean;
};

export type ImpactoDaCompra = {
  subiram: InsumoQueSubiu[];
  produtos: ProdutoAfetado[];
  /** Quantos passaram a ser vendidos abaixo do custo por causa desta compra */
  quantosViraramPrejuizo: number;
  temAlgoPraMostrar: boolean;
};

export type ProdutoParaImpacto = {
  id: string;
  nome: string;
  receitaId: string | null;
  consumoDaReceita: Decimal | number | string;
  custoEmbalagem: Decimal | number | string;
  tempoExtraMin: number;
  margemAlvo: Decimal | number | string | null;
  precoVenda: Decimal | number | string;
};

/**
 * Só avisa a partir deste tamanho de alta.
 *
 * Preço de insumo oscila centavo pra cima e pra baixo o tempo todo. Avisar de
 * 0,4% treinaria ela a fechar o aviso sem ler — e aí o dia que o chocolate
 * subir 20% passa batido junto.
 */
export const ALTA_MINIMA_PARA_AVISAR = new Decimal(5);

export function analisarImpactoDaCompra({
  mudancas,
  receitas,
  insumos,
  produtos,
  config,
}: {
  mudancas: MudancaDeCusto[];
  receitas: Map<string, ReceitaParaCusto>;
  /** Já com os custos NOVOS — é o estado do banco depois da compra */
  insumos: Map<string, InsumoParaCusto>;
  produtos: ProdutoParaImpacto[];
  config: ConfigPrecificacao;
}): ImpactoDaCompra {
  const subiram = mudancas
    .filter((m) => m.custoAnterior !== null && m.custoAnterior.greaterThan(0))
    .map((m) => {
      const anterior = m.custoAnterior!;
      return {
        insumoId: m.insumoId,
        nome: m.nome,
        custoAnterior: anterior,
        custoNovo: m.custoNovo,
        variacao: m.custoNovo.minus(anterior).dividedBy(anterior).times(100),
      };
    })
    .filter((m) => m.variacao.greaterThanOrEqualTo(ALTA_MINIMA_PARA_AVISAR))
    .sort((a, b) => b.variacao.comparedTo(a.variacao));

  if (subiram.length === 0) {
    return { subiram: [], produtos: [], quantosViraramPrejuizo: 0, temAlgoPraMostrar: false };
  }

  // Reconstrói o "antes": mesmos insumos, com o custo que valia até ontem
  const insumosAntes = new Map(insumos);
  for (const m of mudancas) {
    const atual = insumos.get(m.insumoId);
    if (!atual || m.custoAnterior === null) continue;
    insumosAntes.set(m.insumoId, { ...atual, custoMedio: m.custoAnterior });
  }

  const afetados: ProdutoAfetado[] = [];

  for (const produto of produtos) {
    const precoVenda = new Decimal(produto.precoVenda);

    const antes = custoDireto(produto, receitas, insumosAntes, config);
    const depois = custoDireto(produto, receitas, insumos, config);

    // Produto que não usa nada do que subiu não interessa
    if (antes.custo.equals(depois.custo)) continue;

    const analiseAntes = analisarPreco(precoVenda, antes.custo, config, produto.margemAlvo);
    const analiseDepois = analisarPreco(precoVenda, depois.custo, config, produto.margemAlvo);

    afetados.push({
      produtoId: produto.id,
      nome: produto.nome,
      precoVenda,
      custoAntes: antes.custo,
      custoDepois: depois.custo,
      situacaoAntes: analiseAntes.situacao,
      situacaoDepois: analiseDepois.situacao,
      precoSugerido: depois.sugerido,
      virouPrejuizo:
        analiseDepois.situacao === "prejuizo" && analiseAntes.situacao !== "prejuizo",
    });
  }

  /**
   * Prejuízo primeiro, depois quem subiu mais.
   *
   * Se ela só ler a primeira linha, que seja a que dói.
   */
  afetados.sort((a, b) => {
    if (a.virouPrejuizo !== b.virouPrejuizo) return a.virouPrejuizo ? -1 : 1;

    const altaA = a.custoDepois.minus(a.custoAntes);
    const altaB = b.custoDepois.minus(b.custoAntes);
    return altaB.comparedTo(altaA);
  });

  return {
    subiram,
    produtos: afetados,
    quantosViraramPrejuizo: afetados.filter((p) => p.virouPrejuizo).length,
    temAlgoPraMostrar: afetados.length > 0,
  };
}

/** Custo direto e preço sugerido de um produto, com o mapa de insumos dado. */
function custoDireto(
  produto: ProdutoParaImpacto,
  receitas: Map<string, ReceitaParaCusto>,
  insumos: Map<string, InsumoParaCusto>,
  config: ConfigPrecificacao,
): { custo: Decimal; sugerido: Decimal } {
  let custoIngredientes = new Decimal(0);
  let tempoTotal = produto.tempoExtraMin ?? 0;

  const receita = produto.receitaId ? receitas.get(produto.receitaId) : null;

  if (produto.receitaId && receita) {
    try {
      const daReceita = calcularCustoReceita(produto.receitaId, receitas, insumos);
      const consumo = new Decimal(produto.consumoDaReceita);

      custoIngredientes = daReceita.custoPorUnidade.times(consumo);

      // O tempo é da receita inteira; o produto usa só um pedaço dela.
      // Uma receita que rende 30 brigadeiros em 20 min não gasta 20 min por caixa.
      const rendimento = new Decimal(receita.rendimentoQuantidade);
      if (rendimento.greaterThan(0)) {
        tempoTotal += new Decimal(receita.tempoPreparoMin ?? 0)
          .times(consumo)
          .dividedBy(rendimento)
          .toNumber();
      }
    } catch {
      // Receita cíclica ou apagada: o aviso de preço não é o lugar de tratar
      // isso — a tela do produto já reclama. Aqui só não conta.
      return { custo: new Decimal(0), sugerido: new Decimal(0) };
    }
  }

  const preco = calcularPrecoSugerido(
    {
      custoIngredientes,
      custoEmbalagem: produto.custoEmbalagem,
      tempoPreparoMin: tempoTotal,
      margemAlvo: produto.margemAlvo,
    },
    config,
  );

  return { custo: preco.custoDireto, sugerido: preco.precoSugerido };
}
