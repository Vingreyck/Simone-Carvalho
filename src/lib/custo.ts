import { Decimal } from "decimal.js";

/**
 * Custo da ficha técnica.
 *
 * Uma receita é feita de insumos E de outras receitas (sub-receitas). O
 * "Bolo de brigadeiro" usa a massa, o recheio e a cobertura — cada um com ficha
 * própria. Ela cadastra o recheio uma vez e reusa em 10 bolos; quando o preço do
 * chocolate sobe, os 10 se atualizam sozinhos.
 *
 * O cálculo é recursivo, então precisa se defender de ciclo (A usa B, B usa A) —
 * senão trava o servidor com estouro de pilha.
 */

export type ItemDeReceita = {
  insumoId?: string | null;
  subReceitaId?: string | null;
  /** Na unidade base do insumo, ou na unidade de rendimento da sub-receita */
  quantidadeBase: Decimal | number | string;
};

export type ReceitaParaCusto = {
  id: string;
  nome: string;
  rendimentoQuantidade: Decimal | number | string;
  rendimentoUnidade: string;
  itens: ItemDeReceita[];
};

export type InsumoParaCusto = {
  id: string;
  nome: string;
  custoMedio: Decimal | number | string;
  unidadeBase: string;
};

export type LinhaDeCusto = {
  tipo: "insumo" | "sub-receita";
  id: string;
  nome: string;
  quantidade: Decimal;
  custoUnitario: Decimal;
  custo: Decimal;
  /** Quanto essa linha representa do custo total, em % */
  participacao: Decimal;
  semPreco: boolean;
};

export type CustoDaReceita = {
  /** Custo da receita cheia */
  custoTotal: Decimal;
  /** Custo de 1 unidade do rendimento (1 bolo, 1 brigadeiro, 1 g de recheio) */
  custoPorUnidade: Decimal;
  linhas: LinhaDeCusto[];
  /** Insumos que ainda não têm preço — o custo está incompleto enquanto houver algum */
  insumosSemPreco: string[];
};

export class ReceitaCiclicaError extends Error {
  constructor(readonly caminho: string[]) {
    super(
      `Essa receita entra em looping: ${caminho.join(" → ")}. ` +
        "Uma receita não pode usar (nem direta nem indiretamente) ela mesma.",
    );
    this.name = "ReceitaCiclicaError";
  }
}

export class ReceitaNaoEncontradaError extends Error {
  constructor(readonly id: string) {
    super(`Sub-receita não encontrada (${id}). Ela pode ter sido apagada.`);
    this.name = "ReceitaNaoEncontradaError";
  }
}

/**
 * Calcula o custo de uma receita.
 *
 * @param receitas todas as receitas indexadas por id (pra resolver as sub-receitas)
 * @param insumos todos os insumos indexados por id
 */
export function calcularCustoReceita(
  receitaId: string,
  receitas: Map<string, ReceitaParaCusto>,
  insumos: Map<string, InsumoParaCusto>,
): CustoDaReceita {
  return calcular(receitaId, receitas, insumos, []);
}

function calcular(
  receitaId: string,
  receitas: Map<string, ReceitaParaCusto>,
  insumos: Map<string, InsumoParaCusto>,
  caminho: string[],
): CustoDaReceita {
  const receita = receitas.get(receitaId);
  if (!receita) throw new ReceitaNaoEncontradaError(receitaId);

  // Ciclo: já passamos por essa receita descendo nesta mesma ramificação
  if (caminho.includes(receitaId)) {
    const nomes = [...caminho, receitaId].map(
      (id) => receitas.get(id)?.nome ?? id,
    );
    throw new ReceitaCiclicaError(nomes);
  }

  const caminhoAtual = [...caminho, receitaId];

  const linhas: LinhaDeCusto[] = [];
  const semPreco = new Set<string>();
  let custoTotal = new Decimal(0);

  for (const item of receita.itens) {
    const quantidade = new Decimal(item.quantidadeBase);

    if (item.insumoId) {
      const insumo = insumos.get(item.insumoId);
      if (!insumo) continue; // insumo apagado: ignora em vez de derrubar a tela

      const custoUnitario = new Decimal(insumo.custoMedio);
      const custo = quantidade.times(custoUnitario);

      if (custoUnitario.lessThanOrEqualTo(0)) semPreco.add(insumo.nome);

      linhas.push({
        tipo: "insumo",
        id: insumo.id,
        nome: insumo.nome,
        quantidade,
        custoUnitario,
        custo,
        participacao: new Decimal(0), // preenchido no fim, quando o total é conhecido
        semPreco: custoUnitario.lessThanOrEqualTo(0),
      });

      custoTotal = custoTotal.plus(custo);
      continue;
    }

    if (item.subReceitaId) {
      const sub = calcular(item.subReceitaId, receitas, insumos, caminhoAtual);
      const subReceita = receitas.get(item.subReceitaId)!;

      // A sub-receita entra pela fração do rendimento dela que foi usada
      const custo = sub.custoPorUnidade.times(quantidade);

      for (const nome of sub.insumosSemPreco) semPreco.add(nome);

      linhas.push({
        tipo: "sub-receita",
        id: subReceita.id,
        nome: subReceita.nome,
        quantidade,
        custoUnitario: sub.custoPorUnidade,
        custo,
        participacao: new Decimal(0),
        semPreco: sub.insumosSemPreco.length > 0,
      });

      custoTotal = custoTotal.plus(custo);
    }
  }

  const rendimento = new Decimal(receita.rendimentoQuantidade);

  // O banco tem CHECK garantindo rendimento > 0, mas o cálculo também roda no
  // navegador em cima de dados ainda não salvos — então a guarda fica aqui.
  const custoPorUnidade = rendimento.greaterThan(0)
    ? custoTotal.dividedBy(rendimento)
    : new Decimal(0);

  for (const linha of linhas) {
    linha.participacao = custoTotal.greaterThan(0)
      ? linha.custo.dividedBy(custoTotal).times(100)
      : new Decimal(0);
  }

  // Mais caro primeiro: é o que ela precisa olhar pra baratear a receita
  linhas.sort((a, b) => b.custo.comparedTo(a.custo));

  return {
    custoTotal,
    custoPorUnidade,
    linhas,
    insumosSemPreco: [...semPreco],
  };
}

/**
 * Descobre quais receitas seriam afetadas se um insumo mudasse de preço,
 * incluindo as que só usam ele através de uma sub-receita.
 *
 * É o que permite avisar: "o chocolate subiu 18% — 6 receitas ficaram mais caras".
 */
export function receitasAfetadasPor(
  insumoId: string,
  receitas: Map<string, ReceitaParaCusto>,
): string[] {
  const usaDireto = new Set<string>();
  for (const receita of receitas.values()) {
    if (receita.itens.some((i) => i.insumoId === insumoId)) {
      usaDireto.add(receita.id);
    }
  }

  // Sobe a cadeia: quem usa uma receita afetada também é afetado
  const afetadas = new Set(usaDireto);
  let mudou = true;

  while (mudou) {
    mudou = false;
    for (const receita of receitas.values()) {
      if (afetadas.has(receita.id)) continue;

      const usaAfetada = receita.itens.some(
        (i) => i.subReceitaId && afetadas.has(i.subReceitaId),
      );

      if (usaAfetada) {
        afetadas.add(receita.id);
        mudou = true;
      }
    }
  }

  return [...afetadas];
}
