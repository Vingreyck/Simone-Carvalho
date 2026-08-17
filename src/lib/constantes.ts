import type { CategoriaInsumo, UnidadeBase } from "@/generated/prisma/enums";

/**
 * Tradução dos enums do banco pra linguagem dela.
 * Um lugar só — se mudar o rótulo, muda em toda a interface.
 */

export const ROTULO_CATEGORIA: Record<CategoriaInsumo, string> = {
  FARINHAS_E_SECOS: "Farinhas e secos",
  ACUCARES: "Açúcares",
  LATICINIOS: "Laticínios",
  OVOS: "Ovos",
  CHOCOLATES_E_CACAU: "Chocolates e cacau",
  FRUTAS: "Frutas",
  GORDURAS: "Gorduras e óleos",
  FERMENTOS_E_ADITIVOS: "Fermentos e aditivos",
  ESSENCIAS_E_CORANTES: "Essências e corantes",
  CONFEITOS_E_DECORACAO: "Confeitos e decoração",
  EMBALAGENS: "Embalagens",
  DESCARTAVEIS: "Descartáveis",
  OUTROS: "Outros",
};

export const CATEGORIAS: CategoriaInsumo[] = Object.keys(
  ROTULO_CATEGORIA,
) as CategoriaInsumo[];

export const ROTULO_UNIDADE: Record<UnidadeBase, string> = {
  G: "Peso (gramas)",
  ML: "Volume (mililitros)",
  UN: "Unidade (contável)",
};

/** Explicação que aparece embaixo do campo, pra ela escolher certo. */
export const AJUDA_UNIDADE: Record<UnidadeBase, string> = {
  G: "Farinha, açúcar, chocolate — tudo que você pesa.",
  ML: "Leite, óleo, essência — tudo que você mede em litro ou ml.",
  UN: "Ovo, forminha, caixa — tudo que você conta.",
};

export const UNIDADES: UnidadeBase[] = ["G", "ML", "UN"];
