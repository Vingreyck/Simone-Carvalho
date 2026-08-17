import { describe, expect, it } from "vitest";

import {
  analisarPreco,
  arredondarPrecoComercial,
  calcularPrecoSugerido,
  percentualDeCustosFixos,
} from "@/lib/precificacao";

const config = {
  valorHoraMaoDeObra: 25,
  percentualCustosFixos: 15,
  percentualImpostos: 0, // MEI
  percentualTaxaCartao: 4,
  margemLucroPadrao: 30,
};

describe("calcularPrecoSugerido", () => {
  it("usa markup divisor, não multiplicação do custo", () => {
    // CustoDireto = 20; divisor = 1 − 0,49 = 0,51; preço = 39,22
    const r = calcularPrecoSugerido(
      { custoIngredientes: 20, tempoPreparoMin: 0 },
      config,
    );

    expect(r.custoDireto.toNumber()).toBe(20);
    expect(r.divisor.toNumber()).toBeCloseTo(0.51, 10);
    expect(r.precoSugerido.toNumber()).toBeCloseTo(39.2157, 3);
  });

  it("converte o tempo de preparo em dinheiro pela hora dela", () => {
    // 90 min a R$ 25/h = R$ 37,50
    const r = calcularPrecoSugerido(
      { custoIngredientes: 10, tempoPreparoMin: 90 },
      config,
    );

    expect(r.custoMaoDeObra.toNumber()).toBeCloseTo(37.5, 10);
    expect(r.custoDireto.toNumber()).toBeCloseTo(47.5, 10);
  });

  it("soma a embalagem ao custo direto", () => {
    const r = calcularPrecoSugerido(
      { custoIngredientes: 10, custoEmbalagem: 3.5 },
      config,
    );

    expect(r.custoDireto.toNumber()).toBeCloseTo(13.5, 10);
  });

  it("margem específica do produto vence a padrão", () => {
    const r = calcularPrecoSugerido(
      { custoIngredientes: 20, margemAlvo: 50 },
      config,
    );

    expect(r.margemUsada.toNumber()).toBe(50);
    // divisor = 1 − (0,15+0+0,04+0,50) = 0,31
    expect(r.precoSugerido.toNumber()).toBeCloseTo(64.5161, 3);
  });

  it("o preço sugerido devolve exatamente a margem pedida", () => {
    // Fecha o ciclo: precificar pelo sugerido e analisar tem que dar a mesma margem
    const sugerido = calcularPrecoSugerido({ custoIngredientes: 20 }, config);
    const analise = analisarPreco(
      sugerido.precoSugerido,
      sugerido.custoDireto,
      config,
    );

    expect(analise.margemReal.toNumber()).toBeCloseTo(30, 6);
  });

  it("avisa quando os percentuais somam 100% ou mais", () => {
    const impossivel = calcularPrecoSugerido(
      { custoIngredientes: 20 },
      { ...config, margemLucroPadrao: 85 }, // 15+0+4+85 = 104%
    );

    expect(impossivel.impossivel).toBe(true);
    expect(impossivel.precoSugerido.toNumber()).toBe(0);
  });
});

describe("analisarPreco", () => {
  it("detecta prejuízo escondido atrás de um lucro aparente", () => {
    // Custo 38, vende a 40: parece lucro de R$ 2. Mas 4% de cartão (1,60)
    // + 15% de custos fixos (6,00) transformam em prejuízo de R$ 5,60.
    const r = analisarPreco(40, 38, config);

    expect(r.lucro.toNumber()).toBeCloseTo(-5.6, 10);
    expect(r.situacao).toBe("prejuizo");
  });

  it("marca abaixo da meta quando dá lucro mas menos que o desejado", () => {
    const r = analisarPreco(35, 20, config);

    expect(r.lucro.greaterThan(0)).toBe(true);
    expect(r.margemReal.lessThan(30)).toBe(true);
    expect(r.situacao).toBe("abaixo-da-meta");
  });

  it("marca ok quando bate a meta", () => {
    const r = analisarPreco(45, 20, config);
    expect(r.situacao).toBe("ok");
  });

  it("separa o que é taxa e o que é rateio de custo fixo", () => {
    const r = analisarPreco(100, 40, config);

    expect(r.descontosSobreVenda.toNumber()).toBeCloseTo(4, 10); // 4% cartão
    expect(r.contribuicaoCustosFixos.toNumber()).toBeCloseTo(15, 10); // 15% fixos
    expect(r.lucro.toNumber()).toBeCloseTo(41, 10);
  });

  it("preço zero não vira divisão por zero", () => {
    const r = analisarPreco(0, 10, config);
    expect(r.margemReal.toNumber()).toBe(0);
    expect(r.situacao).toBe("prejuizo");
  });
});

describe("arredondarPrecoComercial", () => {
  it("transforma 39,22 num preço de vitrine", () => {
    expect(arredondarPrecoComercial("39.2157").toNumber()).toBe(39.9);
  });

  it("não abaixa o preço ao arredondar", () => {
    // 39,95 não pode virar 39,90 (venderia abaixo do sugerido)
    expect(arredondarPrecoComercial("39.95").toNumber()).toBe(40.9);
  });

  it("usa meio real nos itens baratos", () => {
    expect(arredondarPrecoComercial("2.31").toNumber()).toBe(2.5);
    expect(arredondarPrecoComercial("2.50").toNumber()).toBe(2.5);
    expect(arredondarPrecoComercial("2.51").toNumber()).toBe(3);
  });

  it("preço zero continua zero", () => {
    expect(arredondarPrecoComercial(0).toNumber()).toBe(0);
  });
});

describe("percentualDeCustosFixos", () => {
  it("transforma as contas do mês em percentual do faturamento", () => {
    // R$ 1.200 de fixos com R$ 8.000 de faturamento = 15%
    expect(percentualDeCustosFixos(1200, 8000).toNumber()).toBeCloseTo(15, 10);
  });

  it("sem faturamento informado, não inventa percentual", () => {
    expect(percentualDeCustosFixos(1200, 0).toNumber()).toBe(0);
  });
});
