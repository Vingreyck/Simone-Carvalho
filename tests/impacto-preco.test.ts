import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

import {
  ALTA_MINIMA_PARA_AVISAR,
  analisarImpactoDaCompra,
  type MudancaDeCusto,
  type ProdutoParaImpacto,
} from "@/lib/impacto-preco";
import type { InsumoParaCusto, ReceitaParaCusto } from "@/lib/custo";

/**
 * O aviso que sustenta o sistema: a farinha subiu, e o preço dela não.
 *
 * O que se testa aqui é a diferença entre "antes" e "depois" — se ela estiver
 * errada, o aviso ou não aparece quando devia, ou aparece toda hora e ela
 * aprende a ignorar. Os dois destroem a utilidade.
 */

const CONFIG = {
  valorHoraMaoDeObra: 20,
  percentualCustosFixos: 10,
  percentualImpostos: 0,
  percentualTaxaCartao: 0,
  margemLucroPadrao: 30,
};

function insumos(precos: Record<string, number>): Map<string, InsumoParaCusto> {
  return new Map(
    Object.entries(precos).map(([id, custoMedio]) => [
      id,
      { id, nome: id, custoMedio, unidadeBase: "G" },
    ]),
  );
}

const RECEITAS = new Map<string, ReceitaParaCusto>([
  [
    "bolo",
    {
      id: "bolo",
      nome: "Bolo",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "bolo",
      tempoPreparoMin: 0,
      itens: [{ insumoId: "farinha", quantidadeBase: 1000 }],
    },
  ],
  [
    "torta",
    {
      id: "torta",
      nome: "Torta",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "torta",
      tempoPreparoMin: 0,
      itens: [{ insumoId: "acucar", quantidadeBase: 500 }],
    },
  ],
]);

function produto(
  id: string,
  receitaId: string | null,
  precoVenda: number,
): ProdutoParaImpacto {
  return {
    id,
    nome: id,
    receitaId,
    consumoDaReceita: 1,
    custoEmbalagem: 0,
    tempoExtraMin: 0,
    margemAlvo: null,
    precoVenda,
  };
}

/** Farinha de R$ 0,005/g pra R$ 0,010/g — dobrou */
const FARINHA_DOBROU: MudancaDeCusto[] = [
  {
    insumoId: "farinha",
    nome: "Farinha de trigo",
    custoAnterior: new Decimal("0.005"),
    custoNovo: new Decimal("0.010"),
  },
];

describe("quando avisar", () => {
  it("não avisa por oscilação pequena", () => {
    // 2% é ruído de mercado. Avisar disso treina ela a ignorar o aviso.
    const impacto = analisarImpactoDaCompra({
      mudancas: [
        {
          insumoId: "farinha",
          nome: "Farinha",
          custoAnterior: new Decimal("0.005"),
          custoNovo: new Decimal("0.0051"),
        },
      ],
      receitas: RECEITAS,
      insumos: insumos({ farinha: 0.0051, acucar: 0.004 }),
      produtos: [produto("Bolo", "bolo", 30)],
      config: CONFIG,
    });

    expect(impacto.temAlgoPraMostrar).toBe(false);
    expect(impacto.subiram).toEqual([]);
  });

  it("avisa a partir do limite", () => {
    const anterior = new Decimal("0.005");
    const novo = anterior.times(
      ALTA_MINIMA_PARA_AVISAR.dividedBy(100).plus(1),
    );

    const impacto = analisarImpactoDaCompra({
      mudancas: [
        { insumoId: "farinha", nome: "Farinha", custoAnterior: anterior, custoNovo: novo },
      ],
      receitas: RECEITAS,
      insumos: insumos({ farinha: novo.toNumber(), acucar: 0.004 }),
      produtos: [produto("Bolo", "bolo", 30)],
      config: CONFIG,
    });

    expect(impacto.subiram).toHaveLength(1);
  });

  it("não avisa quando o preço cai", () => {
    const impacto = analisarImpactoDaCompra({
      mudancas: [
        {
          insumoId: "farinha",
          nome: "Farinha",
          custoAnterior: new Decimal("0.010"),
          custoNovo: new Decimal("0.005"),
        },
      ],
      receitas: RECEITAS,
      insumos: insumos({ farinha: 0.005, acucar: 0.004 }),
      produtos: [produto("Bolo", "bolo", 30)],
      config: CONFIG,
    });

    expect(impacto.temAlgoPraMostrar).toBe(false);
  });

  it("primeira compra do insumo não vira aviso", () => {
    // Sem preço anterior não há alta — é só o primeiro preço que ela cadastra
    const impacto = analisarImpactoDaCompra({
      mudancas: [
        {
          insumoId: "farinha",
          nome: "Farinha",
          custoAnterior: null,
          custoNovo: new Decimal("0.010"),
        },
      ],
      receitas: RECEITAS,
      insumos: insumos({ farinha: 0.01, acucar: 0.004 }),
      produtos: [produto("Bolo", "bolo", 30)],
      config: CONFIG,
    });

    expect(impacto.temAlgoPraMostrar).toBe(false);
  });
});

describe("quem foi atingido", () => {
  it("mostra só os produtos que usam o insumo que subiu", () => {
    const impacto = analisarImpactoDaCompra({
      mudancas: FARINHA_DOBROU,
      receitas: RECEITAS,
      insumos: insumos({ farinha: 0.01, acucar: 0.004 }),
      produtos: [produto("Bolo", "bolo", 30), produto("Torta", "torta", 40)],
      config: CONFIG,
    });

    // A torta é de açúcar; não tem por que aparecer
    expect(impacto.produtos.map((p) => p.nome)).toEqual(["Bolo"]);
  });

  it("calcula o custo de antes e o de depois", () => {
    const impacto = analisarImpactoDaCompra({
      mudancas: FARINHA_DOBROU,
      receitas: RECEITAS,
      insumos: insumos({ farinha: 0.01, acucar: 0.004 }),
      produtos: [produto("Bolo", "bolo", 30)],
      config: CONFIG,
    });

    const bolo = impacto.produtos[0];
    expect(bolo.custoAntes.toNumber()).toBe(5); // 1000 g × 0,005
    expect(bolo.custoDepois.toNumber()).toBe(10); // 1000 g × 0,010
  });

  it("marca o que ERA lucro e virou prejuízo", () => {
    // Preço de venda 8: cobria o custo de 5, não cobre o de 10
    const impacto = analisarImpactoDaCompra({
      mudancas: FARINHA_DOBROU,
      receitas: RECEITAS,
      insumos: insumos({ farinha: 0.01, acucar: 0.004 }),
      produtos: [produto("Bolo", "bolo", 8)],
      config: CONFIG,
    });

    const bolo = impacto.produtos[0];
    expect(bolo.situacaoAntes).not.toBe("prejuizo");
    expect(bolo.situacaoDepois).toBe("prejuizo");
    expect(bolo.virouPrejuizo).toBe(true);
    expect(impacto.quantosViraramPrejuizo).toBe(1);
  });

  it("quem já estava no prejuízo antes não conta como novidade", () => {
    // Vendido a 2 com custo 5: já era prejuízo. A alta piorou, mas não é notícia.
    const impacto = analisarImpactoDaCompra({
      mudancas: FARINHA_DOBROU,
      receitas: RECEITAS,
      insumos: insumos({ farinha: 0.01, acucar: 0.004 }),
      produtos: [produto("Bolo", "bolo", 2)],
      config: CONFIG,
    });

    expect(impacto.produtos[0].virouPrejuizo).toBe(false);
    expect(impacto.quantosViraramPrejuizo).toBe(0);
  });

  it("põe o prejuízo na frente, mesmo com alta menor", () => {
    const receitas = new Map(RECEITAS);
    receitas.set("pao", {
      id: "pao",
      nome: "Pão",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "pão",
      tempoPreparoMin: 0,
      // usa 10x mais farinha: a alta em reais é bem maior
      itens: [{ insumoId: "farinha", quantidadeBase: 10000 }],
    });

    const impacto = analisarImpactoDaCompra({
      mudancas: FARINHA_DOBROU,
      receitas,
      insumos: insumos({ farinha: 0.01, acucar: 0.004 }),
      produtos: [
        produto("Pao", "pao", 500), // sobe muito, mas continua lucrando
        produto("Bolo", "bolo", 8), // sobe pouco, mas virou prejuízo
      ],
      config: CONFIG,
    });

    // Se ela ler só a primeira linha, que seja a que dói
    expect(impacto.produtos[0].nome).toBe("Bolo");
    expect(impacto.produtos[0].virouPrejuizo).toBe(true);
  });

  it("acha o produto mesmo quando o insumo está numa sub-receita", () => {
    const receitas = new Map<string, ReceitaParaCusto>([
      [
        "massa",
        {
          id: "massa",
          nome: "Massa",
          rendimentoQuantidade: 1,
          rendimentoUnidade: "massa",
          tempoPreparoMin: 0,
          itens: [{ insumoId: "farinha", quantidadeBase: 1000 }],
        },
      ],
      [
        "boloRecheado",
        {
          id: "boloRecheado",
          nome: "Bolo recheado",
          rendimentoQuantidade: 1,
          rendimentoUnidade: "bolo",
          tempoPreparoMin: 0,
          itens: [{ subReceitaId: "massa", quantidadeBase: 1 }],
        },
      ],
    ]);

    const impacto = analisarImpactoDaCompra({
      mudancas: FARINHA_DOBROU,
      receitas,
      insumos: insumos({ farinha: 0.01 }),
      produtos: [produto("Bolo recheado", "boloRecheado", 30)],
      config: CONFIG,
    });

    expect(impacto.produtos).toHaveLength(1);
    expect(impacto.produtos[0].custoDepois.toNumber()).toBe(10);
  });
});
