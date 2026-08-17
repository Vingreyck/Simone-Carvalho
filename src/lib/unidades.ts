import { Decimal } from "decimal.js";

/**
 * Conversão de unidades.
 *
 * Regra do sistema: o estoque SEMPRE vive na unidade base do insumo (g, ml ou un).
 * Kg, litro, xícara e colher são só formas de DIGITAR — convertidas na entrada.
 * Assim "comprei 5 kg" e "usei 500 g" falam a mesma língua sem gambiarra.
 */

export type UnidadeBase = "G" | "ML" | "UN";

type ConversaoPadrao = { base: UnidadeBase; fator: Decimal };

/**
 * Unidades que o sistema já entende sozinho, sem cadastro.
 * O fator diz quanto 1 dessa unidade vale na unidade base.
 */
const CONVERSOES_PADRAO: Record<string, ConversaoPadrao> = {
  // massa → g
  g: { base: "G", fator: new Decimal(1) },
  grama: { base: "G", fator: new Decimal(1) },
  kg: { base: "G", fator: new Decimal(1000) },
  quilo: { base: "G", fator: new Decimal(1000) },
  mg: { base: "G", fator: new Decimal("0.001") },

  // volume → ml
  ml: { base: "ML", fator: new Decimal(1) },
  mililitro: { base: "ML", fator: new Decimal(1) },
  l: { base: "ML", fator: new Decimal(1000) },
  litro: { base: "ML", fator: new Decimal(1000) },

  // contagem → un
  un: { base: "UN", fator: new Decimal(1) },
  unidade: { base: "UN", fator: new Decimal(1) },
  duzia: { base: "UN", fator: new Decimal(12) },
};

export const ROTULO_UNIDADE_BASE: Record<UnidadeBase, string> = {
  G: "g",
  ML: "ml",
  UN: "un",
};

/** Equivalência caseira cadastrada no insumo: 1 xícara de farinha = 120 g. */
export type Equivalencia = {
  nome: string;
  quantidadeBase: Decimal | number | string;
};

export class UnidadeDesconhecidaError extends Error {
  constructor(
    readonly unidade: string,
    readonly unidadeBase: UnidadeBase,
  ) {
    super(
      `Não sei converter "${unidade}" para ${ROTULO_UNIDADE_BASE[unidadeBase]}. ` +
        `Cadastre a equivalência no insumo (ex.: 1 xícara = 120 g).`,
    );
    this.name = "UnidadeDesconhecidaError";
  }
}

/**
 * Deixa "Xícara", "xicaras", " COLHER DE SOPA " no mesmo formato pra comparar.
 * Tira acento, plural e espaço sobrando — ela vai digitar de tudo quanto é jeito.
 */
export function normalizarUnidade(nome: string): string {
  const semAcento = nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // remove plural simples ("xicaras" → "xicara", "gramas" → "grama")
  return semAcento.replace(/s$/, "").replace(/\s+/g, " ");
}

/**
 * Converte uma quantidade digitada para a unidade base do insumo.
 *
 * @example converterParaBase(2, "kg", "G")            // 2000
 * @example converterParaBase(2, "xícara", "G", [{ nome: "xícara", quantidadeBase: 120 }])  // 240
 */
export function converterParaBase(
  quantidade: Decimal | number | string,
  unidade: string,
  unidadeBase: UnidadeBase,
  equivalencias: Equivalencia[] = [],
): Decimal {
  const qtd = new Decimal(quantidade);
  const alvo = normalizarUnidade(unidade);

  // 1) Equivalência do próprio insumo tem prioridade — ela pode ter cadastrado
  //    "lata" com um valor específico que não bate com nenhum padrão.
  const equivalencia = equivalencias.find(
    (e) => normalizarUnidade(e.nome) === alvo,
  );
  if (equivalencia) {
    return qtd.times(new Decimal(equivalencia.quantidadeBase.toString()));
  }

  // 2) Unidades que o sistema já conhece
  const padrao = CONVERSOES_PADRAO[alvo];
  if (padrao) {
    if (padrao.base !== unidadeBase) {
      throw new UnidadeDesconhecidaError(unidade, unidadeBase);
    }
    return qtd.times(padrao.fator);
  }

  throw new UnidadeDesconhecidaError(unidade, unidadeBase);
}

/** Lista o que aparece no dropdown de unidade daquele insumo. */
export function unidadesDisponiveis(
  unidadeBase: UnidadeBase,
  equivalencias: Equivalencia[] = [],
): string[] {
  const padrao: Record<UnidadeBase, string[]> = {
    G: ["g", "kg"],
    ML: ["ml", "l"],
    UN: ["un", "dúzia"],
  };

  return [...padrao[unidadeBase], ...equivalencias.map((e) => e.nome)];
}

/**
 * Mostra a quantidade do jeito que ela leria: 1500 g vira "1,5 kg",
 * 250 g continua "250 g". Nada de "0,0015 toneladas".
 */
export function formatarQuantidade(
  quantidadeBase: Decimal | number | string,
  unidadeBase: UnidadeBase,
): string {
  const qtd = new Decimal(quantidadeBase);

  if (unidadeBase === "UN") {
    return `${formatarNumero(qtd)} un`;
  }

  const grande = unidadeBase === "G" ? "kg" : "l";
  const pequena = ROTULO_UNIDADE_BASE[unidadeBase];

  if (qtd.abs().greaterThanOrEqualTo(1000)) {
    return `${formatarNumero(qtd.dividedBy(1000))} ${grande}`;
  }

  return `${formatarNumero(qtd)} ${pequena}`;
}

/** Número em pt-BR, sem casas decimais inúteis (2,5 e não 2,5000). */
function formatarNumero(valor: Decimal): string {
  const casas = valor.decimalPlaces();
  return valor.toNumber().toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(casas, 3),
  });
}
