import { describe, expect, it } from "vitest";

import {
  ReceitaCiclicaError,
  calcularCustoReceita,
  expandirEmInsumos,
  receitasAfetadasPor,
  type InsumoParaCusto,
  type ReceitaParaCusto,
} from "@/lib/custo";

/**
 * Cenário de referência (o mesmo do plano):
 * farinha comprada a 5 kg por R$ 28 → R$ 0,0056/g.
 * Uma receita com 500 g de farinha tem que custar R$ 2,80.
 */

const insumos = new Map<string, InsumoParaCusto>([
  ["farinha", { id: "farinha", nome: "Farinha", custoMedio: "0.0056", unidadeBase: "G" }],
  ["acucar", { id: "acucar", nome: "Açúcar", custoMedio: "0.005", unidadeBase: "G" }],
  ["choco", { id: "choco", nome: "Chocolate", custoMedio: "0.04", unidadeBase: "G" }],
  ["leitecond", { id: "leitecond", nome: "Leite condensado", custoMedio: "0.018", unidadeBase: "G" }],
  ["semPreco", { id: "semPreco", nome: "Corante", custoMedio: 0, unidadeBase: "G" }],
]);

function mapa(...receitas: ReceitaParaCusto[]) {
  return new Map(receitas.map((r) => [r.id, r]));
}

describe("calcularCustoReceita — receita simples", () => {
  const massa: ReceitaParaCusto = {
    id: "massa",
    nome: "Massa de bolo",
    rendimentoQuantidade: 1,
    rendimentoUnidade: "bolo",
    itens: [
      { insumoId: "farinha", quantidadeBase: 500 },
      { insumoId: "acucar", quantidadeBase: 300 },
    ],
  };

  it("500 g de farinha a R$ 0,0056/g custa R$ 2,80", () => {
    const r = calcularCustoReceita("massa", mapa(massa), insumos);
    const farinha = r.linhas.find((l) => l.id === "farinha")!;

    expect(farinha.custo.toNumber()).toBeCloseTo(2.8, 10);
  });

  it("soma o custo de todos os itens", () => {
    // 500 × 0,0056 = 2,80  +  300 × 0,005 = 1,50  →  4,30
    const r = calcularCustoReceita("massa", mapa(massa), insumos);
    expect(r.custoTotal.toNumber()).toBeCloseTo(4.3, 10);
  });

  it("divide pelo rendimento pra achar o custo unitário", () => {
    const trintaBrigadeiros: ReceitaParaCusto = {
      id: "brig",
      nome: "Brigadeiro",
      rendimentoQuantidade: 30,
      rendimentoUnidade: "brigadeiros",
      itens: [{ insumoId: "leitecond", quantidadeBase: 395 }],
    };

    const r = calcularCustoReceita("brig", mapa(trintaBrigadeiros), insumos);

    expect(r.custoTotal.toNumber()).toBeCloseTo(7.11, 10);
    expect(r.custoPorUnidade.toNumber()).toBeCloseTo(0.237, 10);
  });

  it("ordena as linhas do mais caro pro mais barato", () => {
    const r = calcularCustoReceita("massa", mapa(massa), insumos);
    expect(r.linhas.map((l) => l.id)).toEqual(["farinha", "acucar"]);
  });

  it("calcula quanto cada item pesa no custo", () => {
    const r = calcularCustoReceita("massa", mapa(massa), insumos);
    const farinha = r.linhas.find((l) => l.id === "farinha")!;

    // 2,80 de 4,30 = 65,1%
    expect(farinha.participacao.toNumber()).toBeCloseTo(65.116, 2);
  });
});

describe("calcularCustoReceita — sub-receitas", () => {
  // Recheio rende 800 g e custa R$ 14,22 → R$ 0,0177/g
  const recheio: ReceitaParaCusto = {
    id: "recheio",
    nome: "Recheio de brigadeiro",
    rendimentoQuantidade: 800,
    rendimentoUnidade: "g",
    itens: [
      { insumoId: "leitecond", quantidadeBase: 790 },
      { insumoId: "choco", quantidadeBase: 10 },
    ],
  };

  const bolo: ReceitaParaCusto = {
    id: "bolo",
    nome: "Bolo de brigadeiro",
    rendimentoQuantidade: 1,
    rendimentoUnidade: "bolo",
    itens: [
      { insumoId: "farinha", quantidadeBase: 500 },
      { subReceitaId: "recheio", quantidadeBase: 400 }, // usa metade do recheio
    ],
  };

  it("cobra da sub-receita só a fração usada", () => {
    const r = calcularCustoReceita("bolo", mapa(recheio, bolo), insumos);
    const linhaRecheio = r.linhas.find((l) => l.id === "recheio")!;

    // recheio: 790×0,018 + 10×0,04 = 14,22 + 0,40 = 14,62 → 0,018275/g
    // 400 g usados = R$ 7,31
    expect(linhaRecheio.custo.toNumber()).toBeCloseTo(7.31, 10);
    expect(linhaRecheio.tipo).toBe("sub-receita");
  });

  it("soma insumo direto + sub-receita", () => {
    const r = calcularCustoReceita("bolo", mapa(recheio, bolo), insumos);
    // 2,80 (farinha) + 7,31 (recheio) = 10,11
    expect(r.custoTotal.toNumber()).toBeCloseTo(10.11, 10);
  });

  it("propaga a mudança de preço através da sub-receita", () => {
    const maisCaro = new Map(insumos);
    maisCaro.set("leitecond", {
      id: "leitecond",
      nome: "Leite condensado",
      custoMedio: "0.036", // dobrou
      unidadeBase: "G",
    });

    const antes = calcularCustoReceita("bolo", mapa(recheio, bolo), insumos);
    const depois = calcularCustoReceita("bolo", mapa(recheio, bolo), maisCaro);

    expect(depois.custoTotal.greaterThan(antes.custoTotal)).toBe(true);
  });

  it("aninha em três níveis sem se perder", () => {
    const cobertura: ReceitaParaCusto = {
      id: "cobertura",
      nome: "Cobertura",
      rendimentoQuantidade: 200,
      rendimentoUnidade: "g",
      itens: [{ subReceitaId: "recheio", quantidadeBase: 200 }],
    };

    const boloCompleto: ReceitaParaCusto = {
      id: "completo",
      nome: "Bolo completo",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "bolo",
      itens: [{ subReceitaId: "cobertura", quantidadeBase: 200 }],
    };

    const r = calcularCustoReceita(
      "completo",
      mapa(recheio, cobertura, boloCompleto),
      insumos,
    );

    // 200 g de recheio = 200 × 0,018275 = 3,655
    expect(r.custoTotal.toNumber()).toBeCloseTo(3.655, 6);
  });
});

describe("calcularCustoReceita — proteções", () => {
  it("barra ciclo direto (A usa A)", () => {
    const a: ReceitaParaCusto = {
      id: "a",
      nome: "A",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "un",
      itens: [{ subReceitaId: "a", quantidadeBase: 1 }],
    };

    expect(() => calcularCustoReceita("a", mapa(a), insumos)).toThrow(
      ReceitaCiclicaError,
    );
  });

  it("barra ciclo indireto (A usa B, B usa A)", () => {
    const a: ReceitaParaCusto = {
      id: "a",
      nome: "A",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "un",
      itens: [{ subReceitaId: "b", quantidadeBase: 1 }],
    };
    const b: ReceitaParaCusto = {
      id: "b",
      nome: "B",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "un",
      itens: [{ subReceitaId: "a", quantidadeBase: 1 }],
    };

    expect(() => calcularCustoReceita("a", mapa(a, b), insumos)).toThrow(
      /looping/,
    );
  });

  it("avisa quais insumos ainda não têm preço", () => {
    const r = calcularCustoReceita(
      "x",
      mapa({
        id: "x",
        nome: "X",
        rendimentoQuantidade: 1,
        rendimentoUnidade: "un",
        itens: [
          { insumoId: "farinha", quantidadeBase: 100 },
          { insumoId: "semPreco", quantidadeBase: 5 },
        ],
      }),
      insumos,
    );

    expect(r.insumosSemPreco).toEqual(["Corante"]);
  });

  it("insumo sem preço dentro de sub-receita também é avisado", () => {
    const sub: ReceitaParaCusto = {
      id: "sub",
      nome: "Sub",
      rendimentoQuantidade: 100,
      rendimentoUnidade: "g",
      itens: [{ insumoId: "semPreco", quantidadeBase: 10 }],
    };
    const pai: ReceitaParaCusto = {
      id: "pai",
      nome: "Pai",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "un",
      itens: [{ subReceitaId: "sub", quantidadeBase: 50 }],
    };

    const r = calcularCustoReceita("pai", mapa(sub, pai), insumos);
    expect(r.insumosSemPreco).toContain("Corante");
  });

  it("rendimento zero não quebra com divisão por zero", () => {
    const r = calcularCustoReceita(
      "z",
      mapa({
        id: "z",
        nome: "Z",
        rendimentoQuantidade: 0,
        rendimentoUnidade: "un",
        itens: [{ insumoId: "farinha", quantidadeBase: 100 }],
      }),
      insumos,
    );

    expect(r.custoPorUnidade.toNumber()).toBe(0);
    expect(r.custoTotal.toNumber()).toBeCloseTo(0.56, 10);
  });
});

describe("receitasAfetadasPor", () => {
  const recheio: ReceitaParaCusto = {
    id: "recheio",
    nome: "Recheio",
    rendimentoQuantidade: 100,
    rendimentoUnidade: "g",
    itens: [{ insumoId: "choco", quantidadeBase: 50 }],
  };
  const bolo: ReceitaParaCusto = {
    id: "bolo",
    nome: "Bolo",
    rendimentoQuantidade: 1,
    rendimentoUnidade: "un",
    itens: [{ subReceitaId: "recheio", quantidadeBase: 100 }],
  };
  const torta: ReceitaParaCusto = {
    id: "torta",
    nome: "Torta",
    rendimentoQuantidade: 1,
    rendimentoUnidade: "un",
    itens: [{ insumoId: "farinha", quantidadeBase: 200 }],
  };

  it("encontra quem usa direto e quem usa via sub-receita", () => {
    const afetadas = receitasAfetadasPor(
      "choco",
      mapa(recheio, bolo, torta),
    );

    expect(afetadas.sort()).toEqual(["bolo", "recheio"]);
  });

  it("não marca receita que não usa o insumo", () => {
    const afetadas = receitasAfetadasPor("choco", mapa(recheio, bolo, torta));
    expect(afetadas).not.toContain("torta");
  });
});

describe("expandirEmInsumos", () => {
  const recheio: ReceitaParaCusto = {
    id: "recheio",
    nome: "Recheio",
    rendimentoQuantidade: 800,
    rendimentoUnidade: "g",
    itens: [
      { insumoId: "leitecond", quantidadeBase: 790 },
      { insumoId: "choco", quantidadeBase: 10 },
    ],
  };

  const bolo: ReceitaParaCusto = {
    id: "bolo",
    nome: "Bolo",
    rendimentoQuantidade: 1,
    rendimentoUnidade: "bolo",
    itens: [
      { insumoId: "farinha", quantidadeBase: 500 },
      { subReceitaId: "recheio", quantidadeBase: 400 }, // metade do recheio
    ],
  };

  function mapa2(...rs: ReceitaParaCusto[]) {
    return new Map(rs.map((r) => [r.id, r]));
  }

  it("achata a sub-receita na fração usada", () => {
    const n = expandirEmInsumos("bolo", 1, mapa2(recheio, bolo), insumos);
    const leite = n.find((x) => x.insumoId === "leitecond")!;

    // usou 400 de 800 = metade → 790 ÷ 2 = 395
    expect(leite.quantidadeBase.toNumber()).toBeCloseTo(395, 10);
  });

  it("multiplica tudo pela quantidade de receitas produzidas", () => {
    const n = expandirEmInsumos("bolo", 3, mapa2(recheio, bolo), insumos);
    const farinha = n.find((x) => x.insumoId === "farinha")!;

    expect(farinha.quantidadeBase.toNumber()).toBeCloseTo(1500, 10);
  });

  it("aceita meia receita", () => {
    const n = expandirEmInsumos("bolo", "0.5", mapa2(recheio, bolo), insumos);
    const farinha = n.find((x) => x.insumoId === "farinha")!;

    expect(farinha.quantidadeBase.toNumber()).toBeCloseTo(250, 10);
  });

  it("soma o mesmo insumo vindo de caminhos diferentes", () => {
    // A farinha aparece direto no bolo E dentro da cobertura
    const cobertura: ReceitaParaCusto = {
      id: "cobertura",
      nome: "Cobertura",
      rendimentoQuantidade: 100,
      rendimentoUnidade: "g",
      itens: [{ insumoId: "farinha", quantidadeBase: 100 }],
    };
    const boloDuplo: ReceitaParaCusto = {
      id: "duplo",
      nome: "Bolo duplo",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "bolo",
      itens: [
        { insumoId: "farinha", quantidadeBase: 500 },
        { subReceitaId: "cobertura", quantidadeBase: 100 },
      ],
    };

    const n = expandirEmInsumos("duplo", 1, mapa2(cobertura, boloDuplo), insumos);

    expect(n.filter((x) => x.insumoId === "farinha")).toHaveLength(1);
    expect(n[0]!.quantidadeBase.toNumber()).toBeCloseTo(600, 10);
  });

  it("barra ciclo também na expansão", () => {
    const a: ReceitaParaCusto = {
      id: "a", nome: "A", rendimentoQuantidade: 1, rendimentoUnidade: "un",
      itens: [{ subReceitaId: "b", quantidadeBase: 1 }],
    };
    const b: ReceitaParaCusto = {
      id: "b", nome: "B", rendimentoQuantidade: 1, rendimentoUnidade: "un",
      itens: [{ subReceitaId: "a", quantidadeBase: 1 }],
    };

    expect(() => expandirEmInsumos("a", 1, mapa2(a, b), insumos)).toThrow(
      ReceitaCiclicaError,
    );
  });
});
