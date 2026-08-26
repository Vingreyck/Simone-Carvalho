import { z } from "zod";

/**
 * Traduz o JSON Schema que o Zod gera para o subconjunto que o Gemini aceita.
 *
 * Por que isso existe: o Zod escreve campo anulável como
 * `anyOf: [{type:"string"}, {type:"null"}]`, e o Gemini não entende `anyOf`.
 * Ele quer `{type:"string", nullable:true}`. Sem essa tradução a API responde
 * 400 e o atalho de foto simplesmente não funciona.
 *
 * Mantemos só as palavras-chave documentadas do Gemini. Qualquer outra coisa é
 * descartada de propósito: um schema com campo estranho é recusado inteiro, e
 * perder uma dica de validação é bem menos grave do que perder a leitura.
 *
 * Isso NÃO enfraquece a garantia de formato — quem valida a resposta de verdade
 * continua sendo o Zod, do lado de cá. Este schema é só o pedido feito ao
 * modelo.
 */

/** O que o Gemini entende. O resto é jogado fora. */
const PALAVRAS_ACEITAS = [
  "type",
  "description",
  "enum",
  "format",
  "nullable",
  "properties",
  "required",
  "items",
] as const;

type EsquemaJson = Record<string, unknown>;

/** `{type:"null"}` — o pedaço que vira a flag `nullable` */
function ehNulo(ramo: unknown): boolean {
  return (
    typeof ramo === "object" &&
    ramo !== null &&
    (ramo as EsquemaJson).type === "null"
  );
}

function converter(no: unknown): EsquemaJson {
  if (typeof no !== "object" || no === null) return {};

  const origem = no as EsquemaJson;

  // Campo anulável: o Zod parte em anyOf, o Gemini quer a flag nullable
  const alternativas = origem.anyOf ?? origem.oneOf;
  if (Array.isArray(alternativas)) {
    const reais = alternativas.filter((ramo) => !ehNulo(ramo));
    const temNulo = reais.length < alternativas.length;

    // União de verdade (string | number) não tem como virar um tipo só.
    // Deixar sem `type` faz o Gemini aceitar qualquer coisa — e o Zod barra
    // depois, que é o comportamento certo: melhor perder a dica do que o 400.
    const base = reais.length === 1 ? converter(reais[0]) : {};

    return temNulo ? { ...base, nullable: true } : base;
  }

  const destino: EsquemaJson = {};

  for (const palavra of PALAVRAS_ACEITAS) {
    if (!(palavra in origem)) continue;

    if (palavra === "properties") {
      const propriedades = origem.properties as EsquemaJson;
      destino.properties = Object.fromEntries(
        Object.entries(propriedades).map(([nome, valor]) => [
          nome,
          converter(valor),
        ]),
      );
      continue;
    }

    if (palavra === "items") {
      destino.items = converter(origem.items);
      continue;
    }

    destino[palavra] = origem[palavra];
  }

  return destino;
}

/**
 * Zod → schema pronto pro Gemini.
 *
 * `reused: "inline"` evita `$ref`/`$defs`: o Gemini não resolve referência, e
 * um schema com `$ref` chegaria lá quebrado.
 */
export function paraEsquemaGemini(esquema: z.ZodType): EsquemaJson {
  return converter(z.toJSONSchema(esquema, { reused: "inline" }));
}
