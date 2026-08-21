import { normalizarTexto } from "./format";

/**
 * Casa o texto do cupom com o insumo cadastrado.
 *
 * "ACUC REFINADO UNIAO 1KG" precisa virar "Açúcar refinado". Isso não é
 * trabalho pra IA: é comparação de texto, e comparação de texto é determinística,
 * instantânea e de graça. A IA já fez a parte difícil (ler a foto).
 *
 * A estratégia é casar por PREFIXO de palavra, porque é assim que mercado
 * abrevia — "ACUC" de açúcar, "CHOC" de chocolate, "LT" de leite.
 */

export type Candidato = {
  id: string;
  nome: string;
};

export type Correspondencia = {
  id: string;
  nome: string;
  /** 0 a 1 — quanto do nome do insumo foi reconhecido no texto do cupom */
  confianca: number;
};

/**
 * Palavras que aparecem em quase todo cupom e não ajudam a distinguir nada.
 * Sem tirar essas, "PACOTE" casaria com qualquer insumo que tenha "pacote".
 */
const RUIDO = new Set([
  "kg", "g", "mg", "ml", "l", "un", "und", "unid", "pct", "pc",
  "cx", "pacote", "saco", "lata", "caixa", "garrafa", "frasco",
  "de", "do", "da", "com", "sem", "e", "em", "ao", "tipo", "pote", "sache",
]);

function palavrasUteis(texto: string): string[] {
  return normalizarTexto(texto)
    .split(/[^a-z0-9%]+/)
    .filter((p) => p.length >= 2)
    // Fora número e medida ("1kg", "395g", "500ml") — não identificam produto
    .filter((p) => !/^\d/.test(p) && !RUIDO.has(p));
}

/**
 * Quanto duas palavras se parecem.
 *
 * Prefixo curto vale quase tanto quanto palavra inteira, e isso é proposital:
 * abreviação de cupom é sempre muito mais curta que a palavra ("cond" de
 * condensado). Penalizar pelo tamanho relativo jogaria fora justamente o sinal
 * que a gente quer ler.
 */
function semelhancaDePalavra(a: string, b: string): number {
  if (a === b) return 1;

  const [curta, longa] = a.length <= b.length ? [a, b] : [b, a];

  // Mínimo de 3 letras pra "ovo" não casar com "ovos de codorna" por acaso
  if (curta.length >= 3 && longa.startsWith(curta)) return 0.9;

  return 0;
}

/**
 * Peso de cada palavra: quanto mais rara entre os insumos, mais ela identifica.
 *
 * "leite" aparece em leite condensado, leite em pó e chocolate ao leite —
 * reconhecer "leite" quase não diz nada. "condensado" aparece em um só, então
 * reconhecer "cond" praticamente decide o casamento. Sem esse peso,
 * "LT COND MOCA" não chegava a lugar nenhum: perdia "leite" e a média puxava
 * "condensado" pra baixo.
 */
function pesosPorPalavra(candidatos: Candidato[]): Map<string, number> {
  const ocorrencias = new Map<string, number>();

  for (const candidato of candidatos) {
    for (const palavra of new Set(palavrasUteis(candidato.nome))) {
      ocorrencias.set(palavra, (ocorrencias.get(palavra) ?? 0) + 1);
    }
  }

  const pesos = new Map<string, number>();
  for (const [palavra, vezes] of ocorrencias) {
    pesos.set(palavra, 1 / vezes);
  }

  return pesos;
}

/**
 * Pontua um candidato contra o texto do cupom.
 *
 * A média é sobre as palavras do INSUMO, não do cupom: marca, peso e código do
 * cupom não devem diluir a nota. O que importa é quanto do nome do insumo foi
 * reconhecido ali.
 */
function pontuar(
  palavrasDoCupom: string[],
  nomeDoInsumo: string,
  pesos: Map<string, number>,
): number {
  const palavrasDoInsumo = palavrasUteis(nomeDoInsumo);
  if (palavrasDoInsumo.length === 0 || palavrasDoCupom.length === 0) return 0;

  let soma = 0;
  let pesoTotal = 0;

  for (const palavraInsumo of palavrasDoInsumo) {
    const peso = pesos.get(palavraInsumo) ?? 1;

    let melhor = 0;
    for (const palavraCupom of palavrasDoCupom) {
      melhor = Math.max(melhor, semelhancaDePalavra(palavraInsumo, palavraCupom));
    }

    soma += melhor * peso;
    pesoTotal += peso;
  }

  /**
   * O piso 1 no denominador evita um empate injusto: "Leite em pó" só tem
   * palavras comuns, então o peso total dele é baixo e casar só o "pó" já dava
   * nota alta — empatando com "Fermento em pó químico", que tinha casado o
   * "fermento" inteiro. Com o piso, quem casa palavra distintiva ganha.
   */
  return soma / Math.max(pesoTotal, 1);
}

/**
 * Encontra o insumo mais parecido com o texto do cupom.
 *
 * @param apelidos casamentos que ela já confirmou antes — têm prioridade total
 * @returns null quando nada chegou perto o bastante (melhor pedir do que errar)
 */
export function casarInsumo(
  descricaoDoCupom: string,
  candidatos: Candidato[],
  apelidos: Map<string, string> = new Map(),
): Correspondencia | null {
  const normalizado = normalizarTexto(descricaoDoCupom);

  // Ela já ensinou este exato texto uma vez — não há o que adivinhar
  const aprendido = apelidos.get(normalizado);
  if (aprendido) {
    const candidato = candidatos.find((c) => c.id === aprendido);
    if (candidato) {
      return { id: candidato.id, nome: candidato.nome, confianca: 1 };
    }
  }

  const palavras = palavrasUteis(descricaoDoCupom);
  if (palavras.length === 0) return null;

  const pesos = pesosPorPalavra(candidatos);
  let melhor: Correspondencia | null = null;

  for (const candidato of candidatos) {
    const nota = pontuar(palavras, candidato.nome, pesos);

    if (!melhor || nota > melhor.confianca) {
      melhor = { id: candidato.id, nome: candidato.nome, confianca: nota };
    }
  }

  // Abaixo disso o palpite atrapalha mais do que ajuda: ela perde tempo
  // desfazendo um casamento errado em vez de escolher do zero.
  if (!melhor || melhor.confianca < 0.5) return null;

  return melhor;
}

/** Acima disso o palpite é bom o bastante pra vir marcado como "conferido". */
export const CONFIANCA_ALTA = 0.8;
