import { Decimal } from "decimal.js";

import {
  expandirEmInsumos,
  ReceitaCiclicaError,
  ReceitaNaoEncontradaError,
  type InsumoParaCusto,
  type ReceitaParaCusto,
} from "./custo";

/**
 * O que ela precisa fazer, e o que precisa comprar pra dar conta.
 *
 * As duas perguntas que ela faz toda manhã. O sistema já tem tudo pra
 * responder — encomendas, fichas técnicas, estoque — mas até agora não juntava,
 * e ela fazia de cabeça.
 *
 * Como ela produz "quando tem tempo", o corte não é por dia fechado: é por
 * urgência. O que está atrasado precisa aparecer primeiro, sempre.
 */

export type Urgencia = "atrasado" | "hoje" | "amanha" | "esta-semana" | "depois" | "sem-data";

export const ORDEM_URGENCIA: Urgencia[] = [
  "atrasado",
  "hoje",
  "amanha",
  "esta-semana",
  "depois",
  "sem-data",
];

export const ROTULO_URGENCIA: Record<Urgencia, string> = {
  atrasado: "Atrasado",
  hoje: "Hoje",
  amanha: "Amanhã",
  "esta-semana": "Esta semana",
  depois: "Mais pra frente",
  "sem-data": "Sem data marcada",
};

export type ItemPendente = {
  pedidoId: string;
  pedidoNumero: number;
  cliente: string | null;
  dataEntrega: Date | null;
  produtoId: string;
  produtoNome: string;
  quantidade: Decimal | number | string;
};

export type ProdutoParaPlano = {
  id: string;
  receitaId: string | null;
  consumoDaReceita: Decimal | number | string;
};

export type AFazer = {
  produtoId: string;
  produtoNome: string;
  quantidade: Decimal;
  urgencia: Urgencia;
  /** Pra ela saber pra quem é, sem abrir o pedido */
  pedidos: { numero: number; cliente: string | null; quantidade: Decimal }[];
  /** Sem ficha técnica não dá pra saber o que gasta */
  semReceita: boolean;
};

export type FaltaComprar = {
  insumoId: string;
  nome: string;
  unidadeBase: string;
  precisa: Decimal;
  tem: Decimal;
  falta: Decimal;
};

export type Plano = {
  aFazer: AFazer[];
  faltaComprar: FaltaComprar[];
  temAtrasado: boolean;
  /** Quantos produtos DIFERENTES ela tem pra fazer */
  totalDeItens: number;
  /**
   * Quantas unidades no total.
   *
   * Separado do de cima porque é o número que ela sente: "6 bolos" é trabalho
   * de manhã inteira, "1 tipo de bolo" não diz nada.
   */
  totalDeUnidades: number;
};

/**
 * Quão urgente é uma entrega.
 *
 * Compara só a data, ignorando a hora: uma entrega marcada pra hoje de manhã
 * continua sendo "hoje" às 15h, não "atrasado". Ela produz quando dá.
 */
export function urgenciaDe(dataEntrega: Date | null, hoje: Date): Urgencia {
  if (!dataEntrega) return "sem-data";

  const dia = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

  const diff = dia(dataEntrega) - dia(hoje);

  if (diff < 0) return "atrasado";
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanha";
  if (diff <= 7) return "esta-semana";
  return "depois";
}

export function montarPlano({
  itens,
  produtos,
  receitas,
  insumos,
  saldos,
  hoje,
}: {
  itens: ItemPendente[];
  produtos: Map<string, ProdutoParaPlano>;
  receitas: Map<string, ReceitaParaCusto>;
  insumos: Map<string, InsumoParaCusto>;
  /** Saldo em estoque por insumo, na unidade base */
  saldos: Map<string, Decimal>;
  hoje: Date;
}): Plano {
  // ------------------------------------------------------- o que assar ----
  const porProduto = new Map<string, AFazer>();

  for (const item of itens) {
    const quantidade = new Decimal(item.quantidade);
    const urgencia = urgenciaDe(item.dataEntrega, hoje);
    const atual = porProduto.get(item.produtoId);

    if (atual) {
      atual.quantidade = atual.quantidade.plus(quantidade);
      atual.pedidos.push({
        numero: item.pedidoNumero,
        cliente: item.cliente,
        quantidade,
      });

      // Vale sempre a urgência mais apertada do grupo
      if (
        ORDEM_URGENCIA.indexOf(urgencia) < ORDEM_URGENCIA.indexOf(atual.urgencia)
      ) {
        atual.urgencia = urgencia;
      }
      continue;
    }

    porProduto.set(item.produtoId, {
      produtoId: item.produtoId,
      produtoNome: item.produtoNome,
      quantidade,
      urgencia,
      pedidos: [{ numero: item.pedidoNumero, cliente: item.cliente, quantidade }],
      semReceita: !produtos.get(item.produtoId)?.receitaId,
    });
  }

  const aFazer = [...porProduto.values()].sort((a, b) => {
    const ua = ORDEM_URGENCIA.indexOf(a.urgencia);
    const ub = ORDEM_URGENCIA.indexOf(b.urgencia);
    return ua !== ub ? ua - ub : a.produtoNome.localeCompare(b.produtoNome, "pt-BR");
  });

  // --------------------------------------------------- o que comprar ------
  const precisaPorInsumo = new Map<string, { nome: string; unidadeBase: string; total: Decimal }>();

  for (const linha of aFazer) {
    const produto = produtos.get(linha.produtoId);
    if (!produto?.receitaId) continue;

    const receita = receitas.get(produto.receitaId);
    if (!receita) continue;

    const rendimento = new Decimal(receita.rendimentoQuantidade);
    if (rendimento.lessThanOrEqualTo(0)) continue;

    // Quantas receitas cheias saem essas unidades vendidas
    const vezes = linha.quantidade
      .times(new Decimal(produto.consumoDaReceita))
      .dividedBy(rendimento);

    let necessidades;
    try {
      necessidades = expandirEmInsumos(produto.receitaId, vezes, receitas, insumos);
    } catch (erro) {
      // Ficha quebrada não pode derrubar a lista inteira — as outras encomendas
      // continuam valendo, e a tela do produto já avisa do problema.
      if (erro instanceof ReceitaCiclicaError || erro instanceof ReceitaNaoEncontradaError) {
        continue;
      }
      throw erro;
    }

    for (const n of necessidades) {
      const atual = precisaPorInsumo.get(n.insumoId);
      if (atual) {
        atual.total = atual.total.plus(n.quantidadeBase);
      } else {
        precisaPorInsumo.set(n.insumoId, {
          nome: n.nome,
          unidadeBase: n.unidadeBase,
          total: n.quantidadeBase,
        });
      }
    }
  }

  const faltaComprar: FaltaComprar[] = [];

  for (const [insumoId, dados] of precisaPorInsumo) {
    const tem = saldos.get(insumoId) ?? new Decimal(0);
    const falta = dados.total.minus(tem);

    // Só entra na lista o que realmente falta
    if (falta.lessThanOrEqualTo(0)) continue;

    faltaComprar.push({
      insumoId,
      nome: dados.nome,
      unidadeBase: dados.unidadeBase,
      precisa: dados.total,
      tem,
      falta,
    });
  }

  faltaComprar.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    aFazer,
    faltaComprar,
    temAtrasado: aFazer.some((f) => f.urgencia === "atrasado"),
    totalDeItens: aFazer.length,
    totalDeUnidades: aFazer
      .reduce((soma, f) => soma.plus(f.quantidade), new Decimal(0))
      .toNumber(),
  };
}
