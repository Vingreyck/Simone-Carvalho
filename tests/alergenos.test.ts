import { describe, expect, it } from "vitest";

import {
  ALERGENOS_EM_ORDEM,
  ROTULO_ALERGENO,
  alergenosDaReceita,
  interpretarAlergeno,
  montarAviso,
  type InsumoParaAlergenos,
  type ReceitaParaAlergenos,
} from "@/lib/alergenos";

/**
 * Aqui erro não é prejuízo, é alergia. Os testes cobrem os dois jeitos de
 * errar: esquecer um alergênico que existe, e afirmar que não tem quando
 * ninguém conferiu.
 */

function insumo(
  id: string,
  nome: string,
  alergenos: InsumoParaAlergenos["alergenos"] = [],
  extras: Partial<InsumoParaAlergenos> = {},
): InsumoParaAlergenos {
  return {
    id,
    nome,
    alergenos,
    alergenosTraco: [],
    alergenosRevisados: true,
    ...extras,
  };
}

const INSUMOS = new Map<string, InsumoParaAlergenos>(
  (
    [
      insumo("farinha", "Farinha de trigo", ["GLUTEN"]),
      insumo("ovo", "Ovo", ["OVOS"]),
      insumo("leiteCond", "Leite condensado", ["LEITE"]),
      insumo("acucar", "Açúcar refinado", []),
      insumo("castanha", "Castanha de caju", ["CASTANHA_DE_CAJU"]),
      insumo("chocolate", "Chocolate ao leite", ["LEITE", "SOJA"], {
        alergenosTraco: ["AMENDOIM", "LEITE"],
      }),
      insumo("novo", "Corante em gel", [], { alergenosRevisados: false }),
    ] as InsumoParaAlergenos[]
  ).map((i) => [i.id, i]),
);

function receitas(
  ...lista: ReceitaParaAlergenos[]
): Map<string, ReceitaParaAlergenos> {
  return new Map(lista.map((r) => [r.id, r]));
}

describe("a lista da norma", () => {
  it("tem os 18 itens do Anexo da RDC 26/2015", () => {
    expect(ALERGENOS_EM_ORDEM).toHaveLength(18);
  });

  it("todo alergênico tem um nome pra sair na etiqueta", () => {
    for (const a of ALERGENOS_EM_ORDEM) {
      expect(ROTULO_ALERGENO[a]).toBeTruthy();
    }
  });
});

describe("ler o que o rótulo escreveu", () => {
  it("reconhece os nomes comuns", () => {
    expect(interpretarAlergeno("leite")).toBe("LEITE");
    expect(interpretarAlergeno("SOJA")).toBe("SOJA");
    expect(interpretarAlergeno("Trigo")).toBe("GLUTEN");
    expect(interpretarAlergeno("glúten")).toBe("GLUTEN");
    expect(interpretarAlergeno("ovos")).toBe("OVOS");
  });

  it("aceita as variações que cada fábrica escreve", () => {
    expect(interpretarAlergeno("castanha-de-caju")).toBe("CASTANHA_DE_CAJU");
    expect(interpretarAlergeno("castanha de caju")).toBe("CASTANHA_DE_CAJU");
    expect(interpretarAlergeno("Castanha do Pará")).toBe("CASTANHA_DO_PARA");
    expect(interpretarAlergeno("castanha-do-brasil")).toBe("CASTANHA_DO_PARA");
  });

  it('tira o "e derivados" que o rótulo põe', () => {
    expect(interpretarAlergeno("leite e derivados")).toBe("LEITE");
    expect(interpretarAlergeno("derivados de soja")).toBe("SOJA");
    expect(interpretarAlergeno("trigo e derivados.")).toBe("GLUTEN");
  });

  it("o que não reconhece vira null, não vira chute", () => {
    // Melhor ela marcar na mão do que o sistema inventar um alergênico
    expect(interpretarAlergeno("corante caramelo")).toBeNull();
    expect(interpretarAlergeno("")).toBeNull();
    expect(interpretarAlergeno("conservante INS 202")).toBeNull();
  });
});

describe("aviso da receita", () => {
  it("junta os alergênicos dos insumos", () => {
    const massa: ReceitaParaAlergenos = {
      id: "massa",
      nome: "Massa de bolo",
      itens: [{ insumoId: "farinha" }, { insumoId: "ovo" }, { insumoId: "acucar" }],
    };

    const aviso = alergenosDaReceita("massa", receitas(massa), INSUMOS);

    expect(aviso.contem).toEqual(["GLUTEN", "OVOS"]);
    expect(aviso.texto).toBe(
      "ALÉRGICOS: CONTÉM GLÚTEN (TRIGO, CENTEIO, CEVADA, AVEIA), OVOS.",
    );
    expect(aviso.completo).toBe(true);
  });

  it("entra na sub-receita — é onde o alergênico se esconde", () => {
    // O bolo em si "só" tem massa e recheio. O leite está lá no fundo.
    const recheio: ReceitaParaAlergenos = {
      id: "recheio",
      nome: "Brigadeiro",
      itens: [{ insumoId: "leiteCond" }],
    };
    const massa: ReceitaParaAlergenos = {
      id: "massa",
      nome: "Massa",
      itens: [{ insumoId: "farinha" }, { insumoId: "ovo" }],
    };
    const bolo: ReceitaParaAlergenos = {
      id: "bolo",
      nome: "Bolo de brigadeiro",
      itens: [{ subReceitaId: "massa" }, { subReceitaId: "recheio" }],
    };

    const aviso = alergenosDaReceita(
      "bolo",
      receitas(bolo, massa, recheio),
      INSUMOS,
    );

    expect(aviso.contem).toEqual(["GLUTEN", "OVOS", "LEITE"]);
  });

  it("não repete alergênico que aparece em dois insumos", () => {
    const r: ReceitaParaAlergenos = {
      id: "r",
      nome: "Ganache",
      itens: [{ insumoId: "leiteCond" }, { insumoId: "chocolate" }],
    };

    const aviso = alergenosDaReceita("r", receitas(r), INSUMOS);

    // Ordem da norma: soja é o item 6, leite o 7
    expect(aviso.contem).toEqual(["SOJA", "LEITE"]);
    expect(aviso.contem.filter((a) => a === "LEITE")).toHaveLength(1);
  });

  it("sai sempre na ordem da norma, não na ordem que foi digitado", () => {
    const r: ReceitaParaAlergenos = {
      id: "r",
      nome: "Torta",
      // de propósito fora de ordem
      itens: [{ insumoId: "castanha" }, { insumoId: "leiteCond" }, { insumoId: "farinha" }],
    };

    const aviso = alergenosDaReceita("r", receitas(r), INSUMOS);

    expect(aviso.contem).toEqual(["GLUTEN", "LEITE", "CASTANHA_DE_CAJU"]);
  });

  it("avisa quando um insumo ainda não foi conferido", () => {
    const r: ReceitaParaAlergenos = {
      id: "r",
      nome: "Bolo colorido",
      itens: [{ insumoId: "farinha" }, { insumoId: "novo" }],
    };

    const aviso = alergenosDaReceita("r", receitas(r), INSUMOS);

    // Achou o glúten, mas não pode jurar que é só isso
    expect(aviso.contem).toEqual(["GLUTEN"]);
    expect(aviso.completo).toBe(false);
    expect(aviso.insumosSemRevisao).toEqual(["Corante em gel"]);
  });

  it("insumo conferido e sem alergênico não vira pendência", () => {
    const r: ReceitaParaAlergenos = {
      id: "r",
      nome: "Calda",
      itens: [{ insumoId: "acucar" }],
    };

    const aviso = alergenosDaReceita("r", receitas(r), INSUMOS);

    expect(aviso.completo).toBe(true);
    expect(aviso.texto).toBe("");
  });

  it("receita em círculo não trava o aviso", () => {
    const a: ReceitaParaAlergenos = {
      id: "a",
      nome: "A",
      itens: [{ insumoId: "farinha" }, { subReceitaId: "b" }],
    };
    const b: ReceitaParaAlergenos = {
      id: "b",
      nome: "B",
      itens: [{ insumoId: "ovo" }, { subReceitaId: "a" }],
    };

    const aviso = alergenosDaReceita("a", receitas(a, b), INSUMOS);

    expect(aviso.contem).toEqual(["GLUTEN", "OVOS"]);
  });
});

describe('"pode conter"', () => {
  it("não repete o que já está no contém", () => {
    // O chocolate tem traço de leite, mas leite já é declarado como CONTÉM.
    // Repetir treina quem lê a ignorar a etiqueta.
    const r: ReceitaParaAlergenos = {
      id: "r",
      nome: "Cobertura",
      itens: [{ insumoId: "chocolate" }],
    };

    const aviso = alergenosDaReceita("r", receitas(r), INSUMOS);

    expect(aviso.contem).toContain("LEITE");
    expect(aviso.podeConter).toEqual(["AMENDOIM"]);
    expect(aviso.texto).toBe(
      "ALÉRGICOS: CONTÉM SOJA, LEITE. ALÉRGICOS: PODE CONTER AMENDOIM.",
    );
  });

  it("sozinho, sai só a frase do pode conter", () => {
    const aviso = montarAviso({ contem: [], podeConter: ["AMENDOIM"] });

    expect(aviso.texto).toBe("ALÉRGICOS: PODE CONTER AMENDOIM.");
  });
});
