import { describe, expect, it } from "vitest";

import {
  formatarMinutos,
  formatarMoeda,
  formatarMoedaPrecisa,
  lerDataLocal,
  lerNumeroBR,
  normalizarTexto,
} from "@/lib/format";

describe("lerDataLocal", () => {
  it("mantém o dia que ela escolheu no calendário", () => {
    // `new Date("2026-08-17")` daria meia-noite UTC = 16/08 21h no Brasil,
    // e a compra lançada hoje apareceria como sendo de ontem.
    const data = lerDataLocal("2026-08-17");

    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(7); // agosto
    expect(data.getDate()).toBe(17);
  });

  it("ancora ao meio-dia, pra horário de verão não virar o dia", () => {
    expect(lerDataLocal("2026-10-18").getHours()).toBe(12);
  });

  it("recusa data mal formada em vez de gravar Invalid Date", () => {
    expect(() => lerDataLocal("17/08/2026")).toThrow(/Data inválida/);
    expect(() => lerDataLocal("")).toThrow(/Data inválida/);
  });
});

describe("lerNumeroBR", () => {
  it("entende o formato que ela digita", () => {
    expect(lerNumeroBR("28,50")).toBe(28.5);
    expect(lerNumeroBR("1.234,56")).toBe(1234.56);
  });

  it("também aceita o formato com ponto decimal", () => {
    expect(lerNumeroBR("28.50")).toBe(28.5);
    expect(lerNumeroBR(28.5)).toBe(28.5);
  });

  it("ignora símbolo de moeda e espaço", () => {
    expect(lerNumeroBR("R$ 56,00")).toBe(56);
  });

  it("campo vazio vira zero em vez de NaN", () => {
    expect(lerNumeroBR("")).toBe(0);
    expect(lerNumeroBR(null)).toBe(0);
    expect(lerNumeroBR("abc")).toBe(0);
  });
});

describe("normalizarTexto", () => {
  it("deixa a busca funcionar sem acento", () => {
    expect(normalizarTexto("Açúcar refinado")).toBe("acucar refinado");
    expect(normalizarTexto("  CHOCOLATE  ")).toBe("chocolate");
  });
});

describe("formatação de dinheiro", () => {
  it("mostra reais no formato brasileiro", () => {
    expect(formatarMoeda(28)).toContain("28,00");
    expect(formatarMoeda(1234.5)).toContain("1.234,50");
  });

  it("preserva as casas do custo por grama", () => {
    // Arredondar 0,0056 pra 2 casas viraria R$ 0,01 e destruiria a ficha técnica
    expect(formatarMoedaPrecisa(0.0056)).toContain("0,0056");
  });
});

describe("formatarMinutos", () => {
  it("escreve o tempo do jeito que se fala", () => {
    expect(formatarMinutos(90)).toBe("1h 30min");
    expect(formatarMinutos(45)).toBe("45min");
    expect(formatarMinutos(120)).toBe("2h");
    expect(formatarMinutos(0)).toBe("—");
  });
});
