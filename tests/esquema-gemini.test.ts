import { describe, expect, it } from "vitest";
import { z } from "zod";

import { paraEsquemaGemini } from "@/lib/ia/esquema-gemini";
import {
  NotaSchema,
  PedidoExtraidoSchema,
  ReceitaExtraidaSchema,
} from "@/lib/ia/esquemas";

/**
 * O Gemini recusa o schema inteiro (400) se encontrar palavra-chave que não
 * conhece. Como não dá pra testar isso sem chave de API, o teste garante o que
 * é verificável aqui: que a tradução só emite o que ele entende.
 */

/** Varre o schema inteiro atrás de palavra-chave proibida. */
function palavrasUsadas(no: unknown, encontradas = new Set<string>()): Set<string> {
  if (Array.isArray(no)) {
    for (const item of no) palavrasUsadas(item, encontradas);
    return encontradas;
  }

  if (typeof no !== "object" || no === null) return encontradas;

  for (const [chave, valor] of Object.entries(no)) {
    encontradas.add(chave);

    // Nome de campo da confeitaria não é palavra-chave — não desce por ali
    if (chave === "properties") {
      for (const sub of Object.values(valor as Record<string, unknown>)) {
        palavrasUsadas(sub, encontradas);
      }
      continue;
    }

    if (chave === "required") continue;

    palavrasUsadas(valor, encontradas);
  }

  return encontradas;
}

const ACEITAS = new Set([
  "type",
  "description",
  "enum",
  "format",
  "nullable",
  "properties",
  "required",
  "items",
]);

describe("tradução de schema pro Gemini", () => {
  it("transforma anyOf de anulável em nullable", () => {
    const esquema = paraEsquemaGemini(z.object({ nome: z.string().nullable() }));

    expect(esquema.properties).toEqual({
      nome: { type: "string", nullable: true },
    });
  });

  it("não marca nullable o que não é anulável", () => {
    const esquema = paraEsquemaGemini(z.object({ nome: z.string() }));

    expect(esquema.properties).toEqual({ nome: { type: "string" } });
  });

  it("descarta $schema e additionalProperties", () => {
    const esquema = paraEsquemaGemini(z.object({ nome: z.string() }));

    expect(esquema).not.toHaveProperty("$schema");
    expect(esquema).not.toHaveProperty("additionalProperties");
  });

  it("desce em array de objeto — é onde ficam os itens da nota", () => {
    const esquema = paraEsquemaGemini(
      z.object({
        itens: z.array(z.object({ preco: z.number().nullable() })),
      }),
    );

    const itens = esquema.properties as Record<string, Record<string, unknown>>;
    const item = itens.itens.items as Record<string, Record<string, unknown>>;

    expect(item.properties.preco).toEqual({ type: "number", nullable: true });
  });

  it("preserva required", () => {
    const esquema = paraEsquemaGemini(
      z.object({ a: z.string(), b: z.string().nullable() }),
    );

    // Anulável ainda é obrigatório: precisa vir, mesmo que venha null
    expect(esquema.required).toEqual(["a", "b"]);
  });

  it("não deixa passar palavra-chave que o Gemini não conhece", () => {
    for (const esquema of [
      NotaSchema,
      ReceitaExtraidaSchema,
      PedidoExtraidoSchema,
    ]) {
      const proibidas = [...palavrasUsadas(paraEsquemaGemini(esquema))].filter(
        (palavra) => !ACEITAS.has(palavra),
      );

      expect(proibidas).toEqual([]);
    }
  });

  it("mantém os campos dos três esquemas de verdade", () => {
    const nota = paraEsquemaGemini(NotaSchema);
    const propriedades = Object.keys(nota.properties as object);

    expect(propriedades).toEqual([
      "fornecedor",
      "data",
      "notaFiscal",
      "itens",
      "valorTotal",
    ]);
  });
});
