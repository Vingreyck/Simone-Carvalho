import type { Alergeno } from "@/generated/prisma/enums";

/**
 * Aviso de alergênico da ficha técnica.
 *
 * Base legal: RDC 26/2015 da ANVISA, obrigatória desde 2016. O Anexo lista 18
 * alimentos de declaração obrigatória, e os artigos 6º e 7º definem as frases
 * exatas — "Alérgicos: Contém X" e "Alérgicos: Pode conter X".
 *
 * A regra de ouro aqui é o oposto da do custo: **em caso de dúvida, avisar a
 * mais**. Custo errado dá prejuízo; alergênico esquecido manda alguém pro
 * hospital. Por isso, quando um insumo ainda não foi conferido, o sistema não
 * finge que a lista está completa — ele diz que não sabe.
 */

/** Nome comum de cada alergênico, como vai sair no aviso. */
export const ROTULO_ALERGENO: Record<Alergeno, string> = {
  GLUTEN: "glúten (trigo, centeio, cevada, aveia)",
  CRUSTACEOS: "crustáceos",
  OVOS: "ovos",
  PEIXES: "peixes",
  AMENDOIM: "amendoim",
  SOJA: "soja",
  LEITE: "leite",
  AMENDOA: "amêndoa",
  AVELA: "avelã",
  CASTANHA_DE_CAJU: "castanha-de-caju",
  CASTANHA_DO_PARA: "castanha-do-pará",
  MACADAMIA: "macadâmia",
  NOZES: "nozes",
  PECA: "pecã",
  PISTACHE: "pistache",
  PINOLI: "pinoli",
  CASTANHA: "castanha",
  LATEX: "látex natural",
};

/**
 * Ordem do Anexo da RDC. Usada na tela e no aviso pra sair sempre igual —
 * a mesma receita não pode gerar duas etiquetas diferentes.
 */
export const ALERGENOS_EM_ORDEM: Alergeno[] = [
  "GLUTEN",
  "CRUSTACEOS",
  "OVOS",
  "PEIXES",
  "AMENDOIM",
  "SOJA",
  "LEITE",
  "AMENDOA",
  "AVELA",
  "CASTANHA_DE_CAJU",
  "CASTANHA_DO_PARA",
  "MACADAMIA",
  "NOZES",
  "PECA",
  "PISTACHE",
  "PINOLI",
  "CASTANHA",
  "LATEX",
];

const POSICAO = new Map(ALERGENOS_EM_ORDEM.map((a, i) => [a, i]));

export type InsumoParaAlergenos = {
  id: string;
  nome: string;
  alergenos: Alergeno[];
  alergenosTraco: Alergeno[];
  alergenosRevisados: boolean;
};

export type ReceitaParaAlergenos = {
  id: string;
  nome: string;
  itens: { insumoId?: string | null; subReceitaId?: string | null }[];
};

export type AvisoAlergenico = {
  contem: Alergeno[];
  podeConter: Alergeno[];
  /**
   * Insumos que ninguém conferiu ainda. Enquanto tiver nome nesta lista, o
   * aviso está incompleto — e a tela precisa dizer isso, não escondê-lo.
   */
  insumosSemRevisao: string[];
  /** Pronto pra colar na etiqueta; vazio quando não há nada a declarar. */
  texto: string;
  /** Confiável só quando todo insumo da receita foi conferido. */
  completo: boolean;
};

function ordenar(alergenos: Iterable<Alergeno>): Alergeno[] {
  return [...new Set(alergenos)].sort(
    (a, b) => (POSICAO.get(a) ?? 99) - (POSICAO.get(b) ?? 99),
  );
}

/**
 * Percorre a receita, entra nas sub-receitas e junta os alergênicos de todos os
 * insumos que ela usa.
 *
 * Diferente do cálculo de custo, aqui a quantidade não importa: um grama de
 * amendoim declara igual a um quilo.
 */
export function alergenosDaReceita(
  receitaId: string,
  receitas: Map<string, ReceitaParaAlergenos>,
  insumos: Map<string, InsumoParaAlergenos>,
): AvisoAlergenico {
  const contem = new Set<Alergeno>();
  const traco = new Set<Alergeno>();
  const semRevisao = new Set<string>();
  const receitasVistas = new Set<string>();

  function visitar(id: string) {
    // Guarda contra receita que se referencia em círculo. O cadastro já
    // impede isso, mas um aviso de alergia não pode depender disso pra existir.
    if (receitasVistas.has(id)) return;
    receitasVistas.add(id);

    const receita = receitas.get(id);
    if (!receita) return;

    for (const item of receita.itens) {
      if (item.subReceitaId) {
        visitar(item.subReceitaId);
        continue;
      }

      if (!item.insumoId) continue;

      const insumo = insumos.get(item.insumoId);
      if (!insumo) continue;

      for (const a of insumo.alergenos) contem.add(a);
      for (const a of insumo.alergenosTraco) traco.add(a);

      if (!insumo.alergenosRevisados) semRevisao.add(insumo.nome);
    }
  }

  visitar(receitaId);

  return montarAviso({
    contem: [...contem],
    podeConter: [...traco],
    insumosSemRevisao: [...semRevisao],
  });
}

/**
 * Monta o aviso final a partir das listas cruas.
 *
 * Separado da varredura porque o produto também precisa disso — ele soma o
 * alergênico da receita com o da embalagem.
 */
export function montarAviso({
  contem,
  podeConter,
  insumosSemRevisao = [],
}: {
  contem: Alergeno[];
  podeConter: Alergeno[];
  insumosSemRevisao?: string[];
}): AvisoAlergenico {
  const listaContem = ordenar(contem);

  // "Pode conter leite" num produto que JÁ contém leite é ruído: a cliente
  // alérgica já foi avisada, e ruído treina quem lê a ignorar a etiqueta.
  const jaDeclarado = new Set(listaContem);
  const listaPodeConter = ordenar(podeConter).filter((a) => !jaDeclarado.has(a));

  const partes: string[] = [];
  if (listaContem.length > 0) {
    partes.push(`ALÉRGICOS: CONTÉM ${nomes(listaContem)}`);
  }
  if (listaPodeConter.length > 0) {
    partes.push(`ALÉRGICOS: PODE CONTER ${nomes(listaPodeConter)}`);
  }

  return {
    contem: listaContem,
    podeConter: listaPodeConter,
    insumosSemRevisao: [...insumosSemRevisao].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
    texto: partes.join(". ") + (partes.length > 0 ? "." : ""),
    completo: insumosSemRevisao.length === 0,
  };
}

/** A norma manda o aviso em caixa alta, então os nomes vão em caixa alta. */
function nomes(alergenos: Alergeno[]): string {
  return alergenos
    .map((a) => ROTULO_ALERGENO[a].toUpperCase())
    .join(", ");
}
