import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

import {
  montarPlano,
  urgenciaDe,
  type ItemPendente,
  type ProdutoParaPlano,
} from "@/lib/plano";
import type { InsumoParaCusto, ReceitaParaCusto } from "@/lib/custo";

const HOJE = new Date(2026, 7, 26); // 26/ago/2026

const INSUMOS = new Map<string, InsumoParaCusto>([
  ["farinha", { id: "farinha", nome: "Farinha", custoMedio: 0.005, unidadeBase: "G" }],
  ["ovo", { id: "ovo", nome: "Ovo", custoMedio: 0.8, unidadeBase: "UN" }],
]);

const RECEITAS = new Map<string, ReceitaParaCusto>([
  [
    "massa",
    {
      id: "massa",
      nome: "Massa",
      rendimentoQuantidade: 1,
      rendimentoUnidade: "bolo",
      itens: [
        { insumoId: "farinha", quantidadeBase: 500 },
        { insumoId: "ovo", quantidadeBase: 3 },
      ],
    },
  ],
]);

const PRODUTOS = new Map<string, ProdutoParaPlano>([
  ["bolo", { id: "bolo", receitaId: "massa", consumoDaReceita: 1 }],
  ["avulso", { id: "avulso", receitaId: null, consumoDaReceita: 1 }],
]);

function item(over: Partial<ItemPendente> = {}): ItemPendente {
  return {
    pedidoId: "p1",
    pedidoNumero: 1,
    cliente: "Dona Maria",
    dataEntrega: HOJE,
    produtoId: "bolo",
    produtoNome: "Bolo",
    quantidade: 1,
    ...over,
  };
}

function plano(itens: ItemPendente[], saldos: Record<string, number> = {}) {
  return montarPlano({
    itens,
    produtos: PRODUTOS,
    receitas: RECEITAS,
    insumos: INSUMOS,
    saldos: new Map(Object.entries(saldos).map(([k, v]) => [k, new Decimal(v)])),
    hoje: HOJE,
  });
}

describe("urgência", () => {
  it("classifica pela data da entrega", () => {
    const dia = (n: number) => new Date(2026, 7, 26 + n);

    expect(urgenciaDe(dia(-1), HOJE)).toBe("atrasado");
    expect(urgenciaDe(dia(0), HOJE)).toBe("hoje");
    expect(urgenciaDe(dia(1), HOJE)).toBe("amanha");
    expect(urgenciaDe(dia(5), HOJE)).toBe("esta-semana");
    expect(urgenciaDe(dia(20), HOJE)).toBe("depois");
    expect(urgenciaDe(null, HOJE)).toBe("sem-data");
  });

  it("entrega de hoje continua sendo de hoje mesmo já tarde", () => {
    // Ela produz quando dá; marcar como atrasado às 15h seria alarme falso
    const hojeDeTarde = new Date(2026, 7, 26, 15, 30);
    const entregaDeManha = new Date(2026, 7, 26, 9, 0);

    expect(urgenciaDe(entregaDeManha, hojeDeTarde)).toBe("hoje");
  });
});

describe("o que assar", () => {
  it("junta o mesmo produto de pedidos diferentes", () => {
    const p = plano([
      item({ pedidoNumero: 1, quantidade: 2 }),
      item({ pedidoId: "p2", pedidoNumero: 2, cliente: "Ana", quantidade: 3 }),
    ]);

    expect(p.aFazer).toHaveLength(1);
    expect(p.aFazer[0].quantidade.toNumber()).toBe(5);
    // Mas ela ainda precisa saber pra quem é cada um
    expect(p.aFazer[0].pedidos.map((x) => x.cliente)).toEqual(["Dona Maria", "Ana"]);

    // 1 tipo de doce, 5 unidades — é o segundo número que diz o tamanho do dia
    expect(p.totalDeItens).toBe(1);
    expect(p.totalDeUnidades).toBe(5);
  });

  it("o agrupado herda a urgência mais apertada", () => {
    const p = plano([
      item({ dataEntrega: new Date(2026, 7, 30) }), // esta semana
      item({ pedidoId: "p2", pedidoNumero: 2, dataEntrega: new Date(2026, 7, 25) }), // atrasado
    ]);

    expect(p.aFazer[0].urgencia).toBe("atrasado");
    expect(p.temAtrasado).toBe(true);
  });

  it("atrasado vem primeiro na lista", () => {
    const p = plano([
      item({ produtoId: "avulso", produtoNome: "Avulso", dataEntrega: new Date(2026, 8, 20) }),
      item({ pedidoId: "p2", pedidoNumero: 2, dataEntrega: new Date(2026, 7, 20) }),
    ]);

    expect(p.aFazer[0].urgencia).toBe("atrasado");
    expect(p.aFazer[0].produtoNome).toBe("Bolo");
  });

  it("marca produto sem ficha técnica", () => {
    const p = plano([item({ produtoId: "avulso", produtoNome: "Avulso" })]);

    expect(p.aFazer[0].semReceita).toBe(true);
    // Sem ficha não dá pra saber o que gasta — não some da lista de compras à toa
    expect(p.faltaComprar).toEqual([]);
  });
});

describe("o que falta comprar", () => {
  it("soma o que as encomendas gastam e desconta o estoque", () => {
    // 2 bolos = 1000 g de farinha e 6 ovos. Tem 400 g e 2 ovos.
    const p = plano([item({ quantidade: 2 })], { farinha: 400, ovo: 2 });

    const farinha = p.faltaComprar.find((f) => f.nome === "Farinha")!;
    expect(farinha.precisa.toNumber()).toBe(1000);
    expect(farinha.tem.toNumber()).toBe(400);
    expect(farinha.falta.toNumber()).toBe(600);

    const ovo = p.faltaComprar.find((f) => f.nome === "Ovo")!;
    expect(ovo.falta.toNumber()).toBe(4);
  });

  it("não lista o que já tem de sobra", () => {
    const p = plano([item({ quantidade: 1 })], { farinha: 5000, ovo: 30 });

    expect(p.faltaComprar).toEqual([]);
  });

  it("estoque exato não vira lista de compra", () => {
    // 1 bolo = 500 g e 3 ovos, e é exatamente o que tem
    const p = plano([item({ quantidade: 1 })], { farinha: 500, ovo: 3 });

    expect(p.faltaComprar).toEqual([]);
  });

  it("insumo sem estoque nenhum aparece inteiro", () => {
    const p = plano([item({ quantidade: 1 })]);

    expect(p.faltaComprar.find((f) => f.nome === "Farinha")!.falta.toNumber()).toBe(500);
  });

  it("soma insumo usado por encomendas diferentes", () => {
    const p = plano(
      [
        item({ quantidade: 1 }),
        item({ pedidoId: "p2", pedidoNumero: 2, quantidade: 1 }),
      ],
      { farinha: 200 },
    );

    // 2 bolos no total = 1000 g, tem 200 → falta 800
    expect(p.faltaComprar.find((f) => f.nome === "Farinha")!.falta.toNumber()).toBe(800);
  });
});

describe("plano vazio", () => {
  it("sem encomendas, nada a fazer nem a comprar", () => {
    const p = plano([]);

    expect(p.aFazer).toEqual([]);
    expect(p.faltaComprar).toEqual([]);
    expect(p.temAtrasado).toBe(false);
    expect(p.totalDeItens).toBe(0);
  });
});
