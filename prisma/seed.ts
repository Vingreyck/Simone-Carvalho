import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type {
  Alergeno,
  CategoriaInsumo,
  UnidadeBase,
} from "../src/generated/prisma/enums";

/**
 * Seed do sistema.
 *
 * A Simone não tem nada digital hoje, então o sistema já nasce com a despensa
 * de confeitaria montada: nome, unidade certa e as equivalências caseiras
 * (xícara, colher, lata) que ela usa pra falar das receitas. Ela só precisa
 * lançar as compras pra os preços aparecerem.
 *
 * É idempotente — pode rodar quantas vezes quiser sem duplicar nada.
 */

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type SeedInsumo = {
  nome: string;
  unidadeBase: UnidadeBase;
  categoria: CategoriaInsumo;
  perecivel?: boolean;
  /** nome da unidade caseira → quanto ela vale na unidade base */
  equivalencias?: Record<string, number>;
};

/**
 * Alergênicos já preenchidos, pra ela não conferir 65 insumos na mão.
 *
 * Aqui só entra o que é **da natureza do ingrediente**: farinha de trigo tem
 * glúten, leite condensado tem leite, ovo tem ovo. Isso não muda de marca pra
 * marca, então dá pra afirmar.
 *
 * O que NÃO está aqui é de propósito. Fermento em pó, corante, pasta americana
 * e gelatina mudam de composição conforme o fabricante — fermento químico, por
 * exemplo, às vezes leva amido de trigo. Esses ficam marcados como "não
 * conferido" e aparecem numa lista pra ela olhar o rótulo. Chutar um alergênico
 * aqui seria pior que deixar em branco: ela confiaria no chute.
 *
 * O "pode conter" (contaminação cruzada) não é semeado nunca — depende do
 * rótulo da marca que ela comprou.
 */
const ALERGENOS_DO_SEED: Record<string, Alergeno[]> = {
  // glúten — o item 1 do Anexo inclui a aveia
  "Farinha de trigo": ["GLUTEN"],
  "Farinha de trigo integral": ["GLUTEN"],
  "Aveia em flocos": ["GLUTEN"],

  // castanhas e amendoim, cada um é um item separado da norma
  "Castanha de caju": ["CASTANHA_DE_CAJU"],
  Nozes: ["NOZES"],
  Amendoim: ["AMENDOIM"],

  // leite
  "Leite integral": ["LEITE"],
  "Leite condensado": ["LEITE"],
  "Creme de leite": ["LEITE"],
  "Creme de leite fresco": ["LEITE"],
  "Leite em pó": ["LEITE"],
  "Manteiga sem sal": ["LEITE"],
  "Cream cheese": ["LEITE"],
  Requeijão: ["LEITE"],
  "Iogurte natural": ["LEITE"],

  Ovo: ["OVOS"],

  // chocolate quase sempre leva lecitina de soja; avisar a mais é o lado seguro
  "Chocolate ao leite": ["LEITE", "SOJA"],
  "Chocolate branco": ["LEITE", "SOJA"],
  "Chocolate meio amargo": ["SOJA"],
  "Chocolate em pó 50%": ["SOJA"],
  "Achocolatado em pó": ["LEITE", "SOJA"],
  "Granulado de chocolate": ["SOJA"],

  // gorduras
  Margarina: ["SOJA"],
  "Óleo de soja": ["SOJA"],
  "Gordura vegetal hidrogenada": ["SOJA"],

  // o látex é o item 18 da norma, e entra pela luva
  "Luva descartável": ["LATEX"],
};

/**
 * Insumos que eu confiro como "sem alergênico" — açúcar é açúcar em qualquer
 * marca. Separado do mapa acima porque lista vazia lá em cima seria confundida
 * com "esqueci de preencher".
 */
const SEM_ALERGENO_CONFERIDO = new Set([
  "Açúcar refinado",
  "Açúcar cristal",
  "Açúcar de confeiteiro",
  "Açúcar mascavo",
  "Açúcar demerara",
  "Mel",
  "Sal",
  "Bicarbonato de sódio",
  "Cacau em pó 100%",
  "Coco ralado",
  "Óleo de coco",
  "Morango",
  "Banana",
  "Limão",
  "Laranja",
  "Maracujá",
  // embalagem não encosta em alimento de um jeito que declare alergênico
  "Caixa para bolo",
  "Forminha de papel",
  "Caixa para doces",
  "Sacola personalizada",
  "Fita de cetim",
  "Etiqueta adesiva",
  "Papel manteiga",
]);

const INSUMOS: SeedInsumo[] = [
  // ---------------------------------------------------------------- secos
  {
    nome: "Farinha de trigo",
    unidadeBase: "G",
    categoria: "FARINHAS_E_SECOS",
    equivalencias: { xícara: 120, "colher de sopa": 8, pacote: 1000 },
  },
  {
    nome: "Farinha de trigo integral",
    unidadeBase: "G",
    categoria: "FARINHAS_E_SECOS",
    equivalencias: { xícara: 120, pacote: 1000 },
  },
  {
    nome: "Amido de milho (maisena)",
    unidadeBase: "G",
    categoria: "FARINHAS_E_SECOS",
    equivalencias: { xícara: 120, "colher de sopa": 8, caixa: 200 },
  },
  {
    nome: "Aveia em flocos",
    unidadeBase: "G",
    categoria: "FARINHAS_E_SECOS",
    equivalencias: { xícara: 90, pacote: 200 },
  },
  {
    nome: "Coco ralado",
    unidadeBase: "G",
    categoria: "FARINHAS_E_SECOS",
    equivalencias: { xícara: 85, pacote: 100 },
  },
  {
    nome: "Castanha de caju",
    unidadeBase: "G",
    categoria: "FARINHAS_E_SECOS",
    equivalencias: { xícara: 130 },
  },
  {
    nome: "Nozes",
    unidadeBase: "G",
    categoria: "FARINHAS_E_SECOS",
    equivalencias: { xícara: 100 },
  },
  {
    nome: "Amendoim",
    unidadeBase: "G",
    categoria: "FARINHAS_E_SECOS",
    equivalencias: { xícara: 145 },
  },

  // -------------------------------------------------------------- açúcares
  {
    nome: "Açúcar refinado",
    unidadeBase: "G",
    categoria: "ACUCARES",
    equivalencias: { xícara: 180, "colher de sopa": 12, pacote: 1000 },
  },
  {
    nome: "Açúcar cristal",
    unidadeBase: "G",
    categoria: "ACUCARES",
    equivalencias: { xícara: 200, pacote: 1000 },
  },
  {
    nome: "Açúcar de confeiteiro",
    unidadeBase: "G",
    categoria: "ACUCARES",
    equivalencias: { xícara: 120, "colher de sopa": 8, pacote: 500 },
  },
  {
    nome: "Açúcar mascavo",
    unidadeBase: "G",
    categoria: "ACUCARES",
    equivalencias: { xícara: 160, pacote: 1000 },
  },
  {
    nome: "Açúcar demerara",
    unidadeBase: "G",
    categoria: "ACUCARES",
    equivalencias: { xícara: 190, pacote: 1000 },
  },
  {
    nome: "Glucose de milho",
    unidadeBase: "G",
    categoria: "ACUCARES",
    equivalencias: { "colher de sopa": 20, pote: 500 },
  },
  {
    nome: "Mel",
    unidadeBase: "G",
    categoria: "ACUCARES",
    equivalencias: { "colher de sopa": 21, pote: 500 },
  },

  // ------------------------------------------------------------ laticínios
  {
    nome: "Leite integral",
    unidadeBase: "ML",
    categoria: "LATICINIOS",
    perecivel: true,
    equivalencias: { xícara: 240, caixa: 1000, litro: 1000 },
  },
  {
    nome: "Leite condensado",
    unidadeBase: "G",
    categoria: "LATICINIOS",
    equivalencias: { lata: 395, caixinha: 395, "colher de sopa": 20 },
  },
  {
    nome: "Creme de leite",
    unidadeBase: "G",
    categoria: "LATICINIOS",
    perecivel: true,
    equivalencias: { caixinha: 200, lata: 300 },
  },
  {
    nome: "Creme de leite fresco",
    unidadeBase: "ML",
    categoria: "LATICINIOS",
    perecivel: true,
    equivalencias: { caixa: 1000, xícara: 240 },
  },
  {
    nome: "Leite em pó",
    unidadeBase: "G",
    categoria: "LATICINIOS",
    equivalencias: { xícara: 120, "colher de sopa": 8, pacote: 400 },
  },
  {
    nome: "Manteiga sem sal",
    unidadeBase: "G",
    categoria: "LATICINIOS",
    perecivel: true,
    equivalencias: { "colher de sopa": 14, tablete: 200, "colher de chá": 5 },
  },
  {
    nome: "Margarina",
    unidadeBase: "G",
    categoria: "LATICINIOS",
    perecivel: true,
    equivalencias: { "colher de sopa": 14, pote: 500 },
  },
  {
    nome: "Cream cheese",
    unidadeBase: "G",
    categoria: "LATICINIOS",
    perecivel: true,
    equivalencias: { pote: 150, "colher de sopa": 15 },
  },
  {
    nome: "Requeijão",
    unidadeBase: "G",
    categoria: "LATICINIOS",
    perecivel: true,
    equivalencias: { pote: 200 },
  },
  {
    nome: "Iogurte natural",
    unidadeBase: "G",
    categoria: "LATICINIOS",
    perecivel: true,
    equivalencias: { pote: 170 },
  },

  // ------------------------------------------------------------------ ovos
  {
    nome: "Ovo",
    unidadeBase: "UN",
    categoria: "OVOS",
    perecivel: true,
    equivalencias: { dúzia: 12, cartela: 30 },
  },

  // ------------------------------------------------------------ chocolates
  {
    nome: "Chocolate ao leite",
    unidadeBase: "G",
    categoria: "CHOCOLATES_E_CACAU",
    equivalencias: { barra: 1000, tablete: 90 },
  },
  {
    nome: "Chocolate meio amargo",
    unidadeBase: "G",
    categoria: "CHOCOLATES_E_CACAU",
    equivalencias: { barra: 1000, tablete: 90 },
  },
  {
    nome: "Chocolate branco",
    unidadeBase: "G",
    categoria: "CHOCOLATES_E_CACAU",
    equivalencias: { barra: 1000, tablete: 90 },
  },
  {
    nome: "Chocolate em pó 50%",
    unidadeBase: "G",
    categoria: "CHOCOLATES_E_CACAU",
    equivalencias: { xícara: 90, "colher de sopa": 6, pacote: 200 },
  },
  {
    nome: "Cacau em pó 100%",
    unidadeBase: "G",
    categoria: "CHOCOLATES_E_CACAU",
    equivalencias: { xícara: 90, "colher de sopa": 6, pacote: 200 },
  },
  {
    nome: "Achocolatado em pó",
    unidadeBase: "G",
    categoria: "CHOCOLATES_E_CACAU",
    equivalencias: { xícara: 110, pacote: 400 },
  },

  // ---------------------------------------------------------------- frutas
  {
    nome: "Morango",
    unidadeBase: "G",
    categoria: "FRUTAS",
    perecivel: true,
    equivalencias: { bandeja: 300 },
  },
  { nome: "Banana", unidadeBase: "UN", categoria: "FRUTAS", perecivel: true },
  { nome: "Limão", unidadeBase: "UN", categoria: "FRUTAS", perecivel: true },
  { nome: "Laranja", unidadeBase: "UN", categoria: "FRUTAS", perecivel: true },
  { nome: "Maracujá", unidadeBase: "UN", categoria: "FRUTAS", perecivel: true },
  {
    nome: "Polpa de fruta congelada",
    unidadeBase: "G",
    categoria: "FRUTAS",
    perecivel: true,
    equivalencias: { pacote: 100 },
  },

  // -------------------------------------------------------------- gorduras
  {
    nome: "Óleo de soja",
    unidadeBase: "ML",
    categoria: "GORDURAS",
    equivalencias: { xícara: 240, "colher de sopa": 15, garrafa: 900 },
  },
  {
    nome: "Óleo de coco",
    unidadeBase: "ML",
    categoria: "GORDURAS",
    equivalencias: { "colher de sopa": 15, pote: 200 },
  },
  {
    nome: "Gordura vegetal hidrogenada",
    unidadeBase: "G",
    categoria: "GORDURAS",
    equivalencias: { "colher de sopa": 13, pote: 500 },
  },

  // ---------------------------------------------------- fermentos/aditivos
  {
    nome: "Fermento em pó químico",
    unidadeBase: "G",
    categoria: "FERMENTOS_E_ADITIVOS",
    equivalencias: { "colher de sopa": 12, "colher de chá": 4, pote: 100 },
  },
  {
    nome: "Fermento biológico seco",
    unidadeBase: "G",
    categoria: "FERMENTOS_E_ADITIVOS",
    equivalencias: { sachê: 10, "colher de chá": 3 },
  },
  {
    nome: "Bicarbonato de sódio",
    unidadeBase: "G",
    categoria: "FERMENTOS_E_ADITIVOS",
    equivalencias: { "colher de chá": 5, pote: 100 },
  },
  {
    nome: "Gelatina incolor sem sabor",
    unidadeBase: "G",
    categoria: "FERMENTOS_E_ADITIVOS",
    equivalencias: { sachê: 12, "colher de sopa": 10 },
  },
  {
    nome: "Sal",
    unidadeBase: "G",
    categoria: "FERMENTOS_E_ADITIVOS",
    equivalencias: { "colher de chá": 5, pitada: 1, pacote: 1000 },
  },
  {
    nome: "Emulsificante para sorvete/bolo",
    unidadeBase: "G",
    categoria: "FERMENTOS_E_ADITIVOS",
    equivalencias: { "colher de sopa": 15, pote: 200 },
  },
  {
    nome: "Liga neutra",
    unidadeBase: "G",
    categoria: "FERMENTOS_E_ADITIVOS",
    equivalencias: { "colher de sopa": 12, pote: 100 },
  },

  // -------------------------------------------------- essências e corantes
  {
    nome: "Essência de baunilha",
    unidadeBase: "ML",
    categoria: "ESSENCIAS_E_CORANTES",
    equivalencias: { "colher de chá": 5, "colher de sopa": 15, vidro: 30 },
  },
  {
    nome: "Corante em gel",
    unidadeBase: "G",
    categoria: "ESSENCIAS_E_CORANTES",
    equivalencias: { pote: 25, gota: 1 },
  },
  {
    nome: "Corante líquido",
    unidadeBase: "ML",
    categoria: "ESSENCIAS_E_CORANTES",
    equivalencias: { vidro: 10 },
  },

  // ----------------------------------------------------------- decoração
  {
    nome: "Pasta americana",
    unidadeBase: "G",
    categoria: "CONFEITOS_E_DECORACAO",
    equivalencias: { pacote: 1000 },
  },
  {
    nome: "Granulado de chocolate",
    unidadeBase: "G",
    categoria: "CONFEITOS_E_DECORACAO",
    equivalencias: { xícara: 150, pacote: 500 },
  },
  {
    nome: "Confeito colorido",
    unidadeBase: "G",
    categoria: "CONFEITOS_E_DECORACAO",
    equivalencias: { pacote: 100 },
  },
  {
    nome: "Papel arroz",
    unidadeBase: "UN",
    categoria: "CONFEITOS_E_DECORACAO",
  },
  {
    nome: "Pérolas de açúcar",
    unidadeBase: "G",
    categoria: "CONFEITOS_E_DECORACAO",
    equivalencias: { pote: 60 },
  },

  // ------------------------------------------------------------ embalagens
  {
    nome: "Caixa para bolo",
    unidadeBase: "UN",
    categoria: "EMBALAGENS",
    equivalencias: { pacote: 25 },
  },
  {
    nome: "Forminha de papel",
    unidadeBase: "UN",
    categoria: "EMBALAGENS",
    equivalencias: { pacote: 100 },
  },
  {
    nome: "Caixa para doces",
    unidadeBase: "UN",
    categoria: "EMBALAGENS",
    equivalencias: { pacote: 50 },
  },
  {
    nome: "Sacola personalizada",
    unidadeBase: "UN",
    categoria: "EMBALAGENS",
    equivalencias: { pacote: 100 },
  },
  {
    nome: "Fita de cetim",
    unidadeBase: "UN",
    categoria: "EMBALAGENS",
    equivalencias: { rolo: 10 },
  },
  {
    nome: "Etiqueta adesiva",
    unidadeBase: "UN",
    categoria: "EMBALAGENS",
    equivalencias: { cartela: 20 },
  },

  // ---------------------------------------------------------- descartáveis
  {
    nome: "Saco de confeitar descartável",
    unidadeBase: "UN",
    categoria: "DESCARTAVEIS",
    equivalencias: { pacote: 50 },
  },
  {
    nome: "Papel manteiga",
    unidadeBase: "UN",
    categoria: "DESCARTAVEIS",
    equivalencias: { rolo: 1 },
  },
  {
    nome: "Luva descartável",
    unidadeBase: "UN",
    categoria: "DESCARTAVEIS",
    equivalencias: { caixa: 100 },
  },
];

const CATEGORIAS_FINANCEIRAS: { nome: string; tipo: "RECEITA" | "DESPESA" }[] = [
  { nome: "Venda de produtos", tipo: "RECEITA" },
  { nome: "Encomendas", tipo: "RECEITA" },
  { nome: "Outras receitas", tipo: "RECEITA" },

  { nome: "Compra de insumos", tipo: "DESPESA" },
  { nome: "Embalagens", tipo: "DESPESA" },
  { nome: "Energia elétrica", tipo: "DESPESA" },
  { nome: "Gás", tipo: "DESPESA" },
  { nome: "Água", tipo: "DESPESA" },
  { nome: "Aluguel", tipo: "DESPESA" },
  { nome: "Internet e telefone", tipo: "DESPESA" },
  { nome: "Marketing e divulgação", tipo: "DESPESA" },
  { nome: "Manutenção e equipamentos", tipo: "DESPESA" },
  { nome: "Impostos e taxas", tipo: "DESPESA" },
  { nome: "Entrega e transporte", tipo: "DESPESA" },
  { nome: "Retirada da Simone", tipo: "DESPESA" },
  { nome: "Outras despesas", tipo: "DESPESA" },
];

async function main() {
  console.log("Semeando o banco...\n");

  // ------------------------------------------------------------- usuária
  const email = process.env.SEED_ADMIN_EMAIL ?? "simone@doceria.local";
  const nome = process.env.SEED_ADMIN_NOME ?? "Simone Carvalho";
  const senha = process.env.SEED_ADMIN_SENHA ?? "mudar123";

  const jaExiste = await prisma.usuario.findUnique({ where: { email } });

  if (jaExiste) {
    console.log(`  usuária ......... ${email} (já existia, senha preservada)`);
  } else {
    await prisma.usuario.create({
      data: { nome, email, senhaHash: await bcrypt.hash(senha, 12) },
    });
    console.log(`  usuária ......... ${email} criada`);
  }

  // ----------------------------------------------------------- configuração
  await prisma.configNegocio.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", nomeFantasia: "Simone Carvalho Doceria" },
  });

  await prisma.configPrecificacao.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      margemLucroPadrao: 30,
      alertaVariacaoPreco: 10,
      diasAlertaValidade: 7,
    },
  });
  console.log("  configuração .... pronta");

  // ------------------------------------------------- categorias financeiras
  for (const categoria of CATEGORIAS_FINANCEIRAS) {
    await prisma.categoriaFinanceira.upsert({
      where: { nome_tipo: { nome: categoria.nome, tipo: categoria.tipo } },
      update: {},
      create: { ...categoria, sistema: true },
    });
  }
  console.log(`  categorias ...... ${CATEGORIAS_FINANCEIRAS.length} financeiras`);

  // ---------------------------------------------------------------- insumos
  let equivalenciasCriadas = 0;

  for (const item of INSUMOS) {
    const alergenos = ALERGENOS_DO_SEED[item.nome] ?? [];
    const conferido =
      alergenos.length > 0 || SEM_ALERGENO_CONFERIDO.has(item.nome);

    const insumo = await prisma.insumo.upsert({
      where: { nome: item.nome },
      // Não sobrescreve o que ela já ajustou (preço, estoque mínimo, marca).
      update: {},
      create: {
        nome: item.nome,
        unidadeBase: item.unidadeBase,
        categoria: item.categoria,
        perecivel: item.perecivel ?? false,
        alergenos,
        alergenosRevisados: conferido,
      },
    });

    // Banco que já existia veio de um seed sem alergênico. Preenche só quem
    // ninguém conferiu ainda — assim o que ELA marcou nunca é sobrescrito.
    if (conferido) {
      await prisma.insumo.updateMany({
        where: { nome: item.nome, alergenosRevisados: false },
        data: { alergenos, alergenosRevisados: true },
      });
    }

    for (const [nomeEquiv, quantidade] of Object.entries(
      item.equivalencias ?? {},
    )) {
      await prisma.insumoEquivalencia.upsert({
        where: { insumoId_nome: { insumoId: insumo.id, nome: nomeEquiv } },
        update: {},
        create: {
          insumoId: insumo.id,
          nome: nomeEquiv,
          quantidadeBase: quantidade,
        },
      });
      equivalenciasCriadas++;
    }
  }

  console.log(
    `  insumos ......... ${INSUMOS.length} itens, ${equivalenciasCriadas} equivalências`,
  );
  console.log("\nPronto.");
}

main()
  .catch((erro) => {
    console.error("Falha no seed:", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
