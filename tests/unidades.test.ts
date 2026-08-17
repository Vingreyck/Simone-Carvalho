import { describe, expect, it } from "vitest";

import {
  UnidadeDesconhecidaError,
  converterParaBase,
  formatarQuantidade,
  normalizarUnidade,
  unidadesDisponiveis,
} from "@/lib/unidades";

/**
 * Conversão de unidade é onde o dinheiro começa a errar.
 * Se "5 kg" virar 5 g, o custo do bolo sai 1000x menor e ela vende no prejuízo
 * sem o sistema reclamar. Por isso esses testes existem.
 */

const XICARA_FARINHA = [{ nome: "xícara", quantidadeBase: 120 }];

describe("normalizarUnidade", () => {
  it("ignora acento, maiúscula, plural e espaço sobrando", () => {
    expect(normalizarUnidade("Xícara")).toBe("xicara");
    expect(normalizarUnidade("XÍCARAS")).toBe("xicara");
    expect(normalizarUnidade("  xicaras  ")).toBe("xicara");
    expect(normalizarUnidade("Colher de Sopa")).toBe("colher de sopa");
  });
});

describe("converterParaBase — unidades padrão", () => {
  it("converte quilo para grama", () => {
    expect(converterParaBase(5, "kg", "G").toNumber()).toBe(5000);
  });

  it("converte litro para mililitro", () => {
    expect(converterParaBase(1.5, "l", "ML").toNumber()).toBe(1500);
  });

  it("mantém a unidade base sem alteração", () => {
    expect(converterParaBase(250, "g", "G").toNumber()).toBe(250);
  });

  it("converte dúzia para unidade", () => {
    expect(converterParaBase(2, "dúzia", "UN").toNumber()).toBe(24);
  });

  it("aceita decimal sem erro de ponto flutuante", () => {
    // 0.1 + 0.2 em float dá 0.30000000000000004 — com Decimal não dá.
    const meio = converterParaBase("0.35", "kg", "G");
    expect(meio.toNumber()).toBe(350);
  });
});

describe("converterParaBase — equivalências caseiras", () => {
  it("usa a equivalência cadastrada no insumo", () => {
    expect(converterParaBase(2, "xícara", "G", XICARA_FARINHA).toNumber()).toBe(
      240,
    );
  });

  it("respeita que xícara de açúcar pesa diferente de xícara de farinha", () => {
    const acucar = [{ nome: "xícara", quantidadeBase: 180 }];

    expect(converterParaBase(1, "xícara", "G", XICARA_FARINHA).toNumber()).toBe(120);
    expect(converterParaBase(1, "xícara", "G", acucar).toNumber()).toBe(180);
  });

  it("aceita meia xícara", () => {
    expect(
      converterParaBase("0.5", "xícara", "G", XICARA_FARINHA).toNumber(),
    ).toBe(60);
  });

  it("a equivalência do insumo vence a unidade padrão de mesmo nome", () => {
    // Se ela cadastrar "dúzia" = 10 (caixa com 10), vale o dela, não os 12 do sistema.
    const duziaDaCasa = [{ nome: "dúzia", quantidadeBase: 10 }];
    expect(converterParaBase(1, "dúzia", "UN", duziaDaCasa).toNumber()).toBe(10);
  });
});

describe("converterParaBase — erros", () => {
  it("recusa unidade de massa em insumo líquido", () => {
    expect(() => converterParaBase(1, "kg", "ML")).toThrow(
      UnidadeDesconhecidaError,
    );
  });

  it("recusa unidade caseira não cadastrada e explica o que fazer", () => {
    expect(() => converterParaBase(1, "punhado", "G")).toThrow(
      /Cadastre a equivalência/,
    );
  });
});

describe("unidadesDisponiveis", () => {
  it("lista as padrão mais as cadastradas no insumo", () => {
    expect(unidadesDisponiveis("G", XICARA_FARINHA)).toEqual([
      "g",
      "kg",
      "xícara",
    ]);
  });
});

describe("formatarQuantidade", () => {
  it("mostra em kg quando passa de 1000 g", () => {
    expect(formatarQuantidade(1500, "G")).toBe("1,5 kg");
  });

  it("mantém em g abaixo de 1000", () => {
    expect(formatarQuantidade(250, "G")).toBe("250 g");
  });

  it("mostra em litro quando passa de 1000 ml", () => {
    expect(formatarQuantidade(2000, "ML")).toBe("2 l");
  });

  it("unidade contável não vira 'quilo de ovo'", () => {
    expect(formatarQuantidade(1500, "UN")).toBe("1.500 un");
  });
});
