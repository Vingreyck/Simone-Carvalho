import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

import {
  COBERTURA_MAXIMA_DIAS,
  COBERTURA_MINIMA_DIAS,
  arredondarParaCima,
  intervaloEntreCompras,
  sugerirEstoqueMinimo,
} from "@/lib/estoque-minimo";

describe("sugerirEstoqueMinimo", () => {
  it("cobre o intervalo entre as compras dela", () => {
    // 9.000 g em 90 dias = 100 g/dia; ela compra a cada 20 dias → 2.000 g
    const minimo = sugerirEstoqueMinimo({
      consumoTotal: 9000,
      diasObservados: 90,
      diasEntreCompras: 20,
      unidadeBase: "G",
    });

    expect(minimo?.toString()).toBe("2000");
  });

  /*
    Insumo novo tem consumo que parece enorme só porque o período observado é
    curto. Melhor não sugerir nada do que sugerir um mínimo absurdo que vai
    deixar o painel em alerta permanente.
  */
  it("não sugere nada sem histórico suficiente", () => {
    expect(
      sugerirEstoqueMinimo({
        consumoTotal: 5000,
        diasObservados: 10,
        diasEntreCompras: 14,
        unidadeBase: "G",
      }),
    ).toBeNull();
  });

  it("não sugere nada pra insumo que nunca foi usado", () => {
    expect(
      sugerirEstoqueMinimo({
        consumoTotal: 0,
        diasObservados: 90,
        diasEntreCompras: 14,
        unidadeBase: "G",
      }),
    ).toBeNull();
  });

  /*
    Corante e essência são comprados uma vez por semestre. Sem o teto, o mínimo
    pediria meio ano de estoque e o insumo viveria marcado como "acabando".
  */
  it("limita a cobertura pelo teto", () => {
    const minimo = sugerirEstoqueMinimo({
      consumoTotal: 900,
      diasObservados: 90,
      diasEntreCompras: 200,
      unidadeBase: "ML",
    });

    // 10 ml/dia × 45 dias (teto) = 450, arredondado pra cima de 50 em 50
    expect(minimo?.toString()).toBe("450");
    expect(COBERTURA_MAXIMA_DIAS).toBe(45);
  });

  it("respeita o piso quando ela compra quase todo dia", () => {
    const minimo = sugerirEstoqueMinimo({
      consumoTotal: 900,
      diasObservados: 90,
      diasEntreCompras: 2,
      unidadeBase: "UN",
    });

    // 10 un/dia × 7 dias (piso) = 70
    expect(minimo?.toString()).toBe("70");
    expect(COBERTURA_MINIMA_DIAS).toBe(7);
  });

  it("usa a cobertura padrão quando não dá pra saber o intervalo", () => {
    const minimo = sugerirEstoqueMinimo({
      consumoTotal: 900,
      diasObservados: 90,
      diasEntreCompras: null,
      unidadeBase: "UN",
    });

    // 10 un/dia × 14 dias
    expect(minimo?.toString()).toBe("140");
  });

  it("aceita consumo gravado como negativo (saída de estoque)", () => {
    const minimo = sugerirEstoqueMinimo({
      consumoTotal: "-9000",
      diasObservados: 90,
      diasEntreCompras: 20,
      unidadeBase: "G",
    });

    expect(minimo?.toString()).toBe("2000");
  });
});

describe("arredondarParaCima", () => {
  /*
    O mínimo aparece na tela dela ("me avise quando sobrar menos que"). 1.847 g
    não é um número que alguém escreveria. E arredondar pra CIMA erra pro lado
    certo: avisa um pouco antes, nunca depois.
  */
  it("sobe pro próximo número de cabeça", () => {
    expect(arredondarParaCima(new Decimal(1847), "G").toString()).toBe("1900");
    expect(arredondarParaCima(new Decimal(312), "G").toString()).toBe("350");
    expect(arredondarParaCima(new Decimal(7200), "G").toString()).toBe("7500");
  });

  it("nunca arredonda pra baixo", () => {
    expect(arredondarParaCima(new Decimal(1900), "G").toString()).toBe("1900");
    expect(arredondarParaCima(new Decimal(1901), "G").toString()).toBe("2000");
  });

  it("unidade contada vira número inteiro, no mínimo 1", () => {
    expect(arredondarParaCima(new Decimal("3.2"), "UN").toString()).toBe("4");
    expect(arredondarParaCima(new Decimal("0.3"), "UN").toString()).toBe("1");
  });
});

describe("intervaloEntreCompras", () => {
  it("mede o intervalo entre compras seguidas", () => {
    const datas = [
      new Date(2026, 5, 1),
      new Date(2026, 5, 21),
      new Date(2026, 6, 11),
    ];

    expect(intervaloEntreCompras(datas)).toBe(20);
  });

  it("ordena antes de medir", () => {
    const datas = [new Date(2026, 6, 11), new Date(2026, 5, 1)];
    expect(intervaloEntreCompras(datas)).toBe(40);
  });

  /*
    O caso que quebrava: ela comprou uma vez lá atrás e depois passou a comprar
    toda semana. O período inteiro dividido pelo número de compras dava ~48
    dias — que, com o teto de 45, faria o mínimo sair seis vezes maior e o
    insumo viver marcado como "acabando".
  */
  it("uma compra antiga e isolada não estica o intervalo", () => {
    const datas = [
      new Date(2025, 8, 1), // há um ano
      new Date(2026, 5, 1),
      new Date(2026, 5, 8),
      new Date(2026, 5, 15),
      new Date(2026, 5, 22),
      new Date(2026, 5, 29),
    ];

    expect(intervaloEntreCompras(datas)).toBe(7);
  });

  it("ignora compras no mesmo dia, mas aproveita o resto", () => {
    const datas = [
      new Date(2026, 5, 1),
      new Date(2026, 5, 1), // nota dividida em duas
      new Date(2026, 5, 11),
      new Date(2026, 5, 21),
    ];

    expect(intervaloEntreCompras(datas)).toBe(10);
  });

  it("com uma compra só não existe intervalo", () => {
    expect(intervaloEntreCompras([new Date(2026, 5, 1)])).toBeNull();
    expect(intervaloEntreCompras([])).toBeNull();
  });

  it("duas compras no mesmo dia não viram intervalo zero", () => {
    const dia = new Date(2026, 5, 1);
    expect(intervaloEntreCompras([dia, new Date(2026, 5, 1)])).toBeNull();
  });
});
