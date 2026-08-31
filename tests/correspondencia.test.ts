import { describe, expect, it } from "vitest";

import { CONFIANCA_ALTA, casarInsumo } from "@/lib/correspondencia";

/**
 * As descrições abaixo são do jeito que mercado brasileiro escreve mesmo:
 * abreviado, em maiúscula, com marca e peso no meio.
 */

const insumos = [
  { id: "acucar", nome: "Açúcar refinado" },
  { id: "acucar-mascavo", nome: "Açúcar mascavo" },
  { id: "farinha", nome: "Farinha de trigo" },
  { id: "leitecond", nome: "Leite condensado" },
  { id: "leitepo", nome: "Leite em pó" },
  { id: "choco-leite", nome: "Chocolate ao leite" },
  { id: "choco-amargo", nome: "Chocolate meio amargo" },
  { id: "manteiga", nome: "Manteiga sem sal" },
  { id: "ovo", nome: "Ovo" },
  { id: "fermento", nome: "Fermento em pó químico" },
];

describe("casarInsumo — abreviações de nota", () => {
  it("acha açúcar em 'ACUC REFINADO UNIAO 1KG'", () => {
    const r = casarInsumo("ACUC REFINADO UNIAO 1KG", insumos);
    expect(r?.id).toBe("acucar");
  });

  it("distingue açúcar refinado de mascavo", () => {
    expect(casarInsumo("ACUCAR MASCAVO 500G", insumos)?.id).toBe(
      "acucar-mascavo",
    );
    expect(casarInsumo("ACUCAR REFINADO 1KG", insumos)?.id).toBe("acucar");
  });

  it("acha farinha em 'FARINHA TRIGO DONA BENTA 1KG'", () => {
    expect(casarInsumo("FARINHA TRIGO DONA BENTA 1KG", insumos)?.id).toBe(
      "farinha",
    );
  });

  it("acha leite condensado em 'LT COND MOCA 395G'", () => {
    expect(casarInsumo("LT COND MOCA 395G", insumos)?.id).toBe("leitecond");
  });

  it("não confunde leite condensado com leite em pó", () => {
    expect(casarInsumo("LEITE PO NINHO 400G", insumos)?.id).toBe("leitepo");
    expect(casarInsumo("LEITE CONDENSADO ITALAC", insumos)?.id).toBe("leitecond");
  });

  it("distingue chocolate ao leite de meio amargo", () => {
    expect(casarInsumo("CHOC AO LEITE NESTLE 1KG", insumos)?.id).toBe(
      "choco-leite",
    );
    expect(casarInsumo("CHOCOLATE MEIO AMARGO GAROTO", insumos)?.id).toBe(
      "choco-amargo",
    );
  });

  it("acha manteiga em 'MANTEIGA S/ SAL AVIACAO 200G'", () => {
    expect(casarInsumo("MANTEIGA S/ SAL AVIACAO 200G", insumos)?.id).toBe(
      "manteiga",
    );
  });

  it("acha fermento em 'FERMENTO PO ROYAL 100G'", () => {
    expect(casarInsumo("FERMENTO PO ROYAL 100G", insumos)?.id).toBe("fermento");
  });
});

describe("casarInsumo — quando é melhor não adivinhar", () => {
  it("devolve null pra produto que ela não tem cadastrado", () => {
    expect(casarInsumo("DETERGENTE YPE 500ML", insumos)).toBeNull();
  });

  it("devolve null pra linha que é só número e embalagem", () => {
    expect(casarInsumo("1 PACOTE 500G", insumos)).toBeNull();
  });

  it("devolve null pra descrição vazia", () => {
    expect(casarInsumo("", insumos)).toBeNull();
  });

  it("não casa com lista de candidatos vazia", () => {
    expect(casarInsumo("ACUCAR REFINADO", [])).toBeNull();
  });
});

describe("casarInsumo — apelidos aprendidos", () => {
  it("o que ela ensinou vence a semelhança", () => {
    // Esse texto sozinho cairia em "Açúcar refinado"; ela corrigiu pra mascavo
    const apelidos = new Map([["acuc especial 1kg", "acucar-mascavo"]]);

    const r = casarInsumo("ACUC ESPECIAL 1KG", insumos, apelidos);

    expect(r?.id).toBe("acucar-mascavo");
    expect(r?.confianca).toBe(1);
  });

  it("apelido apontando pra insumo apagado cai na semelhança", () => {
    const apelidos = new Map([["acuc refinado uniao 1kg", "insumo-que-sumiu"]]);

    expect(casarInsumo("ACUC REFINADO UNIAO 1KG", insumos, apelidos)?.id).toBe(
      "acucar",
    );
  });
});

describe("confiança", () => {
  it("nome escrito por extenso e igual dá confiança alta", () => {
    const r = casarInsumo("LEITE CONDENSADO", insumos);
    expect(r!.confianca).toBeGreaterThanOrEqual(CONFIANCA_ALTA);
  });

  it("marca e peso no meio não derrubam a confiança", () => {
    // O nota traz lixo ("uniao", "1kg"), mas o nome do insumo foi todo reconhecido
    const r = casarInsumo("ACUCAR REFINADO UNIAO PACOTE 1KG", insumos);
    expect(r!.confianca).toBeGreaterThanOrEqual(CONFIANCA_ALTA);
  });
});
