import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

import {
  EstoqueInsuficienteError,
  calcularCustoMedio,
  calcularEntradaDeCompra,
  ordenarLotesFifo,
  planejarBaixa,
  prazoDeValidade,
  situacaoEstoque,
  situacaoValidade,
  somarSaldo,
  variacaoPercentual,
} from "@/lib/estoque";

const dia = (iso: string) => new Date(`${iso}T12:00:00`);

describe("calcularEntradaDeCompra", () => {
  it("resolve o caso do plano: 5 kg por R$ 28", () => {
    const r = calcularEntradaDeCompra({
      quantidadeEmbalagens: 1,
      tamanhoEmbalagemBase: 5000, // 5 kg em gramas
      valorTotal: 28,
    });

    expect(r.quantidadeBase.toNumber()).toBe(5000);
    expect(r.custoUnitarioBase.toNumber()).toBeCloseTo(0.0056, 10);
  });

  it("multiplica quando são várias embalagens", () => {
    const r = calcularEntradaDeCompra({
      quantidadeEmbalagens: 2,
      tamanhoEmbalagemBase: 5000,
      valorTotal: 56,
    });

    expect(r.quantidadeBase.toNumber()).toBe(10000);
    expect(r.custoUnitarioBase.toNumber()).toBeCloseTo(0.0056, 10);
  });

  it("embute o frete rateado no custo unitário", () => {
    const r = calcularEntradaDeCompra({
      quantidadeEmbalagens: 1,
      tamanhoEmbalagemBase: 1000,
      valorTotal: 10,
      freteRateado: 2,
    });

    expect(r.custoUnitarioBase.toNumber()).toBeCloseTo(0.012, 10);
  });

  it("recusa quantidade zero em vez de dividir por zero", () => {
    expect(() =>
      calcularEntradaDeCompra({
        quantidadeEmbalagens: 0,
        tamanhoEmbalagemBase: 1000,
        valorTotal: 10,
      }),
    ).toThrow(/maior que zero/);
  });
});

describe("ordenarLotesFifo", () => {
  it("quem vence antes sai antes, mesmo tendo chegado depois", () => {
    const lotes = [
      {
        id: "antigo-sem-pressa",
        quantidadeRestante: 100,
        custoUnitario: 1,
        validade: dia("2027-01-01"),
        dataEntrada: dia("2026-01-01"),
      },
      {
        id: "novo-vencendo",
        quantidadeRestante: 100,
        custoUnitario: 1,
        validade: dia("2026-08-20"),
        dataEntrada: dia("2026-08-15"),
      },
    ];

    expect(ordenarLotesFifo(lotes).map((l) => l.id)).toEqual([
      "novo-vencendo",
      "antigo-sem-pressa",
    ]);
  });

  it("lote sem validade fica pra depois dos que têm", () => {
    const lotes = [
      {
        id: "sem-validade",
        quantidadeRestante: 10,
        custoUnitario: 1,
        validade: null,
        dataEntrada: dia("2020-01-01"),
      },
      {
        id: "com-validade",
        quantidadeRestante: 10,
        custoUnitario: 1,
        validade: dia("2030-01-01"),
        dataEntrada: dia("2026-08-01"),
      },
    ];

    expect(ordenarLotesFifo(lotes).map((l) => l.id)).toEqual([
      "com-validade",
      "sem-validade",
    ]);
  });

  it("sem validade nenhuma, desempata pela data de entrada", () => {
    const lotes = [
      { id: "b", quantidadeRestante: 1, custoUnitario: 1, dataEntrada: dia("2026-05-01") },
      { id: "a", quantidadeRestante: 1, custoUnitario: 1, dataEntrada: dia("2026-01-01") },
    ];

    expect(ordenarLotesFifo(lotes).map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("planejarBaixa", () => {
  const lotes = [
    {
      id: "lote-caro",
      quantidadeRestante: 300,
      custoUnitario: "0.010",
      validade: dia("2026-09-01"),
      dataEntrada: dia("2026-08-10"),
    },
    {
      id: "lote-barato",
      quantidadeRestante: 700,
      custoUnitario: "0.005",
      validade: dia("2026-12-01"),
      dataEntrada: dia("2026-08-01"),
    },
  ];

  it("consome só o primeiro lote quando ele dá conta", () => {
    const plano = planejarBaixa(lotes, 200);

    expect(plano.baixas).toHaveLength(1);
    expect(plano.baixas[0]!.loteId).toBe("lote-caro");
    expect(plano.custoTotal.toNumber()).toBeCloseTo(2, 10);
  });

  it("atravessa para o próximo lote e soma o custo real de cada um", () => {
    // 300 do lote caro (R$ 3,00) + 200 do barato (R$ 1,00)
    const plano = planejarBaixa(lotes, 500);

    expect(plano.baixas.map((b) => b.loteId)).toEqual([
      "lote-caro",
      "lote-barato",
    ]);
    expect(plano.baixas[0]!.quantidade.toNumber()).toBe(300);
    expect(plano.baixas[1]!.quantidade.toNumber()).toBe(200);
    expect(plano.custoTotal.toNumber()).toBeCloseTo(4, 10);
  });

  it("as baixas somam exatamente o que foi pedido", () => {
    const plano = planejarBaixa(lotes, 850);
    const somado = plano.baixas.reduce(
      (t, b) => t.plus(b.quantidade),
      new Decimal(0),
    );

    expect(somado.toNumber()).toBe(850);
  });

  it("recusa quando falta estoque, dizendo quanto tem", () => {
    expect(() => planejarBaixa(lotes, 1500, "farinha")).toThrow(
      EstoqueInsuficienteError,
    );
    expect(() => planejarBaixa(lotes, 1500, "farinha")).toThrow(/farinha/);
  });

  it("ignora lote zerado sem quebrar", () => {
    const comZerado = [
      { id: "zerado", quantidadeRestante: 0, custoUnitario: 99, dataEntrada: dia("2026-01-01") },
      ...lotes,
    ];

    const plano = planejarBaixa(comZerado, 100);
    expect(plano.baixas.map((b) => b.loteId)).toEqual(["lote-caro"]);
  });

  it("recusa quantidade zero ou negativa", () => {
    expect(() => planejarBaixa(lotes, 0)).toThrow(/maior que zero/);
    expect(() => planejarBaixa(lotes, -5)).toThrow(/maior que zero/);
  });
});

describe("calcularCustoMedio", () => {
  it("pondera pela quantidade, não pela média simples", () => {
    // 900 g a R$ 0,005 + 100 g a R$ 0,015 → média simples daria 0,010 (errado)
    const media = calcularCustoMedio([
      { id: "a", quantidadeRestante: 900, custoUnitario: "0.005", dataEntrada: dia("2026-01-01") },
      { id: "b", quantidadeRestante: 100, custoUnitario: "0.015", dataEntrada: dia("2026-02-01") },
    ]);

    expect(media.toNumber()).toBeCloseTo(0.006, 10);
  });

  it("com estoque zerado, mantém o último custo conhecido", () => {
    // Se virasse 0, toda receita com esse insumo mostraria custo zero.
    const media = calcularCustoMedio(
      [{ id: "a", quantidadeRestante: 0, custoUnitario: "0.005", dataEntrada: dia("2026-01-01") }],
      "0.0056",
    );

    expect(media.toNumber()).toBeCloseTo(0.0056, 10);
  });

  it("sem lote nenhum, também mantém o custo anterior", () => {
    expect(calcularCustoMedio([], "0.0042").toNumber()).toBeCloseTo(0.0042, 10);
  });
});

describe("somarSaldo", () => {
  it("soma sem erro de ponto flutuante", () => {
    const total = somarSaldo([
      { id: "a", quantidadeRestante: "0.1", custoUnitario: 1, dataEntrada: dia("2026-01-01") },
      { id: "b", quantidadeRestante: "0.2", custoUnitario: 1, dataEntrada: dia("2026-01-01") },
    ]);

    expect(total.toString()).toBe("0.3");
  });
});

describe("situacaoEstoque", () => {
  it("classifica os quatro estados", () => {
    expect(situacaoEstoque(0, 500)).toBe("sem-estoque");
    expect(situacaoEstoque(200, 500)).toBe("critico"); // abaixo da metade
    expect(situacaoEstoque(400, 500)).toBe("baixo");
    expect(situacaoEstoque(600, 500)).toBe("ok");
  });

  it("sem mínimo definido, nunca alarma — nem com saldo zero", () => {
    // Os 65 insumos do seed nascem zerados e sem mínimo. Se alarmassem, a tela
    // abriria com 65 avisos vermelhos e ela pararia de olhar pros avisos.
    expect(situacaoEstoque(1, 0)).toBe("ok");
    expect(situacaoEstoque(0, 0)).toBe("ok");
  });
});

describe("situacaoValidade", () => {
  const hoje = dia("2026-08-17");

  it("marca vencido, vencendo e ok", () => {
    expect(situacaoValidade(dia("2026-08-15"), 7, hoje)).toBe("vencido");
    expect(situacaoValidade(dia("2026-08-20"), 7, hoje)).toBe("vencendo");
    expect(situacaoValidade(dia("2026-10-01"), 7, hoje)).toBe("ok");
  });

  it("vencer hoje conta como vencendo, não como vencido", () => {
    expect(situacaoValidade(dia("2026-08-17"), 7, hoje)).toBe("vencendo");
  });

  it("insumo sem validade nunca alarma", () => {
    expect(situacaoValidade(null, 7, hoje)).toBe("ok");
  });
});

describe("variacaoPercentual", () => {
  it("calcula a alta que dispara o alerta", () => {
    expect(variacaoPercentual("0.005", "0.0059")!.toNumber()).toBeCloseTo(18, 6);
  });

  it("aceita queda de preço", () => {
    expect(variacaoPercentual(10, 8)!.toNumber()).toBeCloseTo(-20, 10);
  });

  it("sem preço anterior, não inventa variação", () => {
    expect(variacaoPercentual(0, 5)).toBeNull();
  });
});

describe("prazoDeValidade", () => {
  function lote(entrada: string, validade: string | null) {
    return {
      dataEntrada: new Date(entrada),
      validade: validade ? new Date(validade) : null,
    };
  }

  it("mede quantos dias o insumo costuma durar", () => {
    const dias = prazoDeValidade([
      lote("2026-01-01", "2026-04-01"), // 90
      lote("2026-03-01", "2026-05-30"), // 90
    ]);

    expect(dias).toBe(90);
  });

  /*
    Um lote comprado em promoção perto do vencimento puxaria a MÉDIA pra baixo
    e faria o sistema sugerir validade curta demais em todas as compras
    seguintes. A mediana aguenta o ponto fora da curva.
  */
  it("usa a mediana, então um lote perto do vencimento não estraga o resto", () => {
    const dias = prazoDeValidade([
      lote("2026-01-01", "2026-01-06"), // 5 — promoção
      lote("2026-02-01", "2026-05-02"), // 90
      lote("2026-03-01", "2026-05-30"), // 90
    ]);

    expect(dias).toBe(90);
  });

  it("sem nenhum lote com validade, não inventa data", () => {
    expect(prazoDeValidade([])).toBeNull();
    expect(prazoDeValidade([lote("2026-01-01", null)])).toBeNull();
  });

  it("descarta prazo negativo e prazo absurdo", () => {
    // Validade anterior à entrada é erro de digitação, não prazo
    expect(prazoDeValidade([lote("2026-05-01", "2026-01-01")])).toBeNull();
    expect(prazoDeValidade([lote("2026-01-01", "2050-01-01")])).toBeNull();
  });
});
