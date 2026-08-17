import {
  Boxes,
  ChefHat,
  CookingPot,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
  Video,
  Wallet,
  Wheat,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa único da navegação — barra lateral, barra inferior do celular e o
 * título de cada página saem daqui. Mudou em um lugar, mudou em todos.
 */

export type ItemNav = {
  href: string;
  titulo: string;
  /** Frase curta que explica o módulo pra quem nunca usou */
  descricao: string;
  icone: LucideIcon;
  /** Aparece na barra inferior do celular (no máximo 4 + "Mais") */
  noCelular?: boolean;
};

export type GrupoNav = {
  titulo: string;
  itens: ItemNav[];
};

export const GRUPOS_NAV: GrupoNav[] = [
  {
    titulo: "Início",
    itens: [
      {
        href: "/",
        titulo: "Painel",
        descricao: "O resumo do dia: entregas, dinheiro e o que precisa de atenção.",
        icone: LayoutDashboard,
        noCelular: true,
      },
    ],
  },
  {
    titulo: "Receitas e produtos",
    itens: [
      {
        href: "/receitas",
        titulo: "Fichas técnicas",
        descricao: "Suas receitas com o custo calculado sozinho.",
        icone: ChefHat,
        noCelular: true,
      },
      {
        href: "/produtos",
        titulo: "Produtos e preços",
        descricao: "Por quanto vender cada doce pra ter lucro de verdade.",
        icone: Tags,
        noCelular: true,
      },
      {
        href: "/producao",
        titulo: "Produção",
        descricao: "Registre o que produziu e o estoque baixa sozinho.",
        icone: CookingPot,
      },
    ],
  },
  {
    titulo: "Estoque",
    itens: [
      {
        href: "/insumos",
        titulo: "Insumos",
        descricao: "Tudo que você compra pra produzir.",
        icone: Wheat,
      },
      {
        href: "/compras",
        titulo: "Compras",
        descricao: "Lance a nota do mercado e os preços se atualizam.",
        icone: ShoppingCart,
      },
      {
        href: "/estoque",
        titulo: "Estoque",
        descricao: "O que tem, o que está acabando e o que vence.",
        icone: Boxes,
        noCelular: true,
      },
    ],
  },
  {
    titulo: "Negócio",
    itens: [
      {
        href: "/vendas",
        titulo: "Vendas e encomendas",
        descricao: "Pedidos, clientes e a agenda de entregas.",
        icone: Receipt,
      },
      {
        href: "/financeiro",
        titulo: "Financeiro",
        descricao: "Contas a pagar e receber, caixa e lucro.",
        icone: Wallet,
      },
    ],
  },
  {
    titulo: "Loja",
    itens: [
      {
        href: "/cameras",
        titulo: "Câmeras",
        descricao: "Veja a loja ao vivo de onde estiver.",
        icone: Video,
      },
    ],
  },
];

export const ITEM_AJUSTES: ItemNav = {
  href: "/ajustes",
  titulo: "Ajustes",
  descricao: "Precificação, dados do negócio e sua senha.",
  icone: Settings,
};

export const TODOS_ITENS: ItemNav[] = [
  ...GRUPOS_NAV.flatMap((g) => g.itens),
  ITEM_AJUSTES,
];

/** Itens fixos da barra inferior do celular (o resto vai pro "Mais"). */
export const ITENS_CELULAR = TODOS_ITENS.filter((i) => i.noCelular);

/** Descobre em qual item a rota atual está, pra marcar como ativo. */
export function itemAtivo(pathname: string): ItemNav | undefined {
  if (pathname === "/") return TODOS_ITENS.find((i) => i.href === "/");

  return TODOS_ITENS.filter((i) => i.href !== "/")
    .filter((i) => pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
