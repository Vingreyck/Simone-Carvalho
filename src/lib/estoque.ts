import { Decimal } from "decimal.js";

/**
 * Regras de estoque.
 *
 * Funções puras de propósito: recebem os lotes, devolvem o plano de baixa.
 * Quem grava no banco é a Server Action, dentro de uma transação. Assim dá pra
 * testar a regra sem subir Postgres — e é aqui que o dinheiro erra se errar.
 */

export type LoteDisponivel = {
  id: string;
  quantidadeRestante: Decimal | number | string;
  custoUnitario: Decimal | number | string;
  validade?: Date | null;
  dataEntrada: Date;
};

export type BaixaDeLote = {
  loteId: string;
  quantidade: Decimal;
  custoUnitario: Decimal;
  custoTotal: Decimal;
};

export type PlanoDeBaixa = {
  baixas: BaixaDeLote[];
  custoTotal: Decimal;
};

export class EstoqueInsuficienteError extends Error {
  constructor(
    readonly nomeInsumo: string,
    readonly disponivel: Decimal,
    readonly solicitado: Decimal,
  ) {
    super(
      `Não tem ${nomeInsumo} suficiente: precisa de ${solicitado.toString()}, ` +
        `tem ${disponivel.toString()} em estoque.`,
    );
    this.name = "EstoqueInsuficienteError";
  }
}

/**
 * Ordem de consumo: **vence primeiro, sai primeiro**.
 *
 * É FIFO com uma correção que importa em alimento — o que manda é a validade,
 * não a data de compra. Um creme comprado hoje que vence em 3 dias tem que sair
 * antes de um comprado mês passado que vence só ano que vem. Lote sem validade
 * (farinha, açúcar) entra depois dos que têm, e aí desempata pela data de entrada.
 */
export function ordenarLotesFifo<T extends LoteDisponivel>(lotes: T[]): T[] {
  return [...lotes].sort((a, b) => {
    const va = a.validade ? a.validade.getTime() : null;
    const vb = b.validade ? b.validade.getTime() : null;

    if (va !== null && vb !== null && va !== vb) return va - vb;
    if (va !== null && vb === null) return -1;
    if (va === null && vb !== null) return 1;

    return a.dataEntrada.getTime() - b.dataEntrada.getTime();
  });
}

/**
 * Monta o plano de consumo: de quais lotes tirar e quanto de cada um.
 *
 * O custo sai do lote de verdade (não do custo médio), então a produção reflete
 * o que ela realmente pagou naquele saco de farinha.
 */
export function planejarBaixa(
  lotes: LoteDisponivel[],
  quantidadeDesejada: Decimal | number | string,
  nomeInsumo = "esse insumo",
): PlanoDeBaixa {
  const desejada = new Decimal(quantidadeDesejada);

  if (desejada.lessThanOrEqualTo(0)) {
    throw new Error("A quantidade a baixar precisa ser maior que zero.");
  }

  const disponivel = somarSaldo(lotes);
  if (disponivel.lessThan(desejada)) {
    throw new EstoqueInsuficienteError(nomeInsumo, disponivel, desejada);
  }

  const baixas: BaixaDeLote[] = [];
  let custoTotal = new Decimal(0);
  let restante = desejada;

  for (const lote of ordenarLotesFifo(lotes)) {
    if (restante.lessThanOrEqualTo(0)) break;

    const noLote = new Decimal(lote.quantidadeRestante);
    if (noLote.lessThanOrEqualTo(0)) continue;

    const retirar = Decimal.min(noLote, restante);
    const custoUnitario = new Decimal(lote.custoUnitario);
    const custo = retirar.times(custoUnitario);

    baixas.push({
      loteId: lote.id,
      quantidade: retirar,
      custoUnitario,
      custoTotal: custo,
    });

    custoTotal = custoTotal.plus(custo);
    restante = restante.minus(retirar);
  }

  return { baixas, custoTotal };
}

/** Soma o que resta em todos os lotes. */
export function somarSaldo(lotes: LoteDisponivel[]): Decimal {
  return lotes.reduce(
    (total, lote) => total.plus(new Decimal(lote.quantidadeRestante)),
    new Decimal(0),
  );
}

/**
 * Custo médio ponderado do que está em estoque agora.
 *
 * Detalhe que evita um bug feio: quando o estoque zera, o custo médio **não**
 * vira zero — mantém o último valor conhecido. Se zerasse, toda ficha técnica
 * que usa esse insumo mostraria custo R$ 0,00 e o preço sugerido despencaria
 * bem na hora em que ela mais precisa repor.
 */
export function calcularCustoMedio(
  lotes: LoteDisponivel[],
  custoAnterior: Decimal | number | string = 0,
): Decimal {
  let quantidadeTotal = new Decimal(0);
  let valorTotal = new Decimal(0);

  for (const lote of lotes) {
    const qtd = new Decimal(lote.quantidadeRestante);
    if (qtd.lessThanOrEqualTo(0)) continue;

    quantidadeTotal = quantidadeTotal.plus(qtd);
    valorTotal = valorTotal.plus(qtd.times(new Decimal(lote.custoUnitario)));
  }

  if (quantidadeTotal.lessThanOrEqualTo(0)) {
    return new Decimal(custoAnterior);
  }

  return valorTotal.dividedBy(quantidadeTotal);
}

/**
 * Converte "2 sacos de 5 kg por R$ 56" no que o estoque entende.
 * Devolve a quantidade na unidade base e quanto custa cada unidade dela.
 */
export function calcularEntradaDeCompra(params: {
  quantidadeEmbalagens: Decimal | number | string;
  /** já convertido pra unidade base (5 kg → 5000) */
  tamanhoEmbalagemBase: Decimal | number | string;
  valorTotal: Decimal | number | string;
  /** parcela do frete que coube a este item */
  freteRateado?: Decimal | number | string;
}): { quantidadeBase: Decimal; custoUnitarioBase: Decimal } {
  const embalagens = new Decimal(params.quantidadeEmbalagens);
  const tamanho = new Decimal(params.tamanhoEmbalagemBase);
  const valor = new Decimal(params.valorTotal).plus(
    new Decimal(params.freteRateado ?? 0),
  );

  const quantidadeBase = embalagens.times(tamanho);

  if (quantidadeBase.lessThanOrEqualTo(0)) {
    throw new Error(
      "A quantidade da compra precisa ser maior que zero. " +
        "Confira o número de embalagens e o tamanho de cada uma.",
    );
  }

  return {
    quantidadeBase,
    custoUnitarioBase: valor.dividedBy(quantidadeBase),
  };
}

// ---------------------------------------------------------------------------
// Situações — usadas nos avisos do painel e nas cores das listas
// ---------------------------------------------------------------------------

export type SituacaoEstoque = "sem-estoque" | "critico" | "baixo" | "ok";

/**
 * "Crítico" é abaixo da metade do mínimo — dá pra distinguir "já era" de
 * "compra na próxima ida ao mercado".
 *
 * Sem mínimo definido não existe alerta, nem com saldo zero. É proposital: no
 * primeiro acesso os 65 insumos do seed estão zerados, e pintar tudo de vermelho
 * transformaria o aviso em ruído que ela aprenderia a ignorar. O alerta só
 * aparece pros insumos que ela marcou que importam.
 */
export function situacaoEstoque(
  saldo: Decimal | number | string,
  estoqueMinimo: Decimal | number | string,
): SituacaoEstoque {
  const minimo = new Decimal(estoqueMinimo);
  if (minimo.lessThanOrEqualTo(0)) return "ok";

  const atual = new Decimal(saldo);
  if (atual.lessThanOrEqualTo(0)) return "sem-estoque";
  if (atual.lessThan(minimo.dividedBy(2))) return "critico";
  if (atual.lessThan(minimo)) return "baixo";
  return "ok";
}

export type SituacaoValidade = "vencido" | "vencendo" | "ok";

export function situacaoValidade(
  validade: Date | null | undefined,
  diasAlerta = 7,
  hoje = new Date(),
): SituacaoValidade {
  if (!validade) return "ok";

  const inicioHoje = new Date(hoje);
  inicioHoje.setHours(0, 0, 0, 0);

  const inicioValidade = new Date(validade);
  inicioValidade.setHours(0, 0, 0, 0);

  const dias = Math.round(
    (inicioValidade.getTime() - inicioHoje.getTime()) / 86_400_000,
  );

  if (dias < 0) return "vencido";
  if (dias <= diasAlerta) return "vencendo";
  return "ok";
}

/** Prazo maior que isso é erro de digitação, não validade. */
const PRAZO_MAXIMO_DIAS = 1825; // 5 anos

/**
 * Quantos dias costuma durar um insumo, olhando os lotes anteriores.
 *
 * Serve pra pré-preencher a validade na tela de compra. Prazo de validade é
 * uma característica do produto, não da compra: a farinha daquela marca vence
 * sempre uns 8 meses depois de sair da fábrica. Digitar isso item por item, em
 * toda compra, é trabalho que o sistema já tinha como poupar.
 *
 * Usa a MEDIANA, não a média: um lote comprado em promoção perto do vencimento
 * puxaria a média pra baixo e faria o sistema sugerir uma validade curta demais
 * pra todos os próximos.
 *
 * Devolve `null` quando nenhum lote anterior tinha validade — aí o campo
 * continua em branco, que é melhor que uma data inventada num campo que serve
 * pra ela não usar ingrediente estragado.
 */
export function prazoDeValidade(
  lotes: { dataEntrada: Date; validade: Date | null }[],
): number | null {
  const prazos = lotes
    .filter((l) => l.validade)
    .map((l) =>
      Math.round(
        (l.validade!.getTime() - l.dataEntrada.getTime()) / 86_400_000,
      ),
    )
    .filter((dias) => dias > 0 && dias <= PRAZO_MAXIMO_DIAS)
    .sort((a, b) => a - b);

  if (prazos.length === 0) return null;

  const meio = Math.floor(prazos.length / 2);

  return prazos.length % 2 === 1
    ? prazos[meio]!
    : Math.round((prazos[meio - 1]! + prazos[meio]!) / 2);
}

/**
 * Quanto o preço mudou entre duas compras, em %.
 * Positivo = subiu. É o que dispara "o chocolate subiu 18%".
 */
export function variacaoPercentual(
  anterior: Decimal | number | string,
  atual: Decimal | number | string,
): Decimal | null {
  const antes = new Decimal(anterior);
  if (antes.lessThanOrEqualTo(0)) return null; // sem base de comparação

  return new Decimal(atual).minus(antes).dividedBy(antes).times(100);
}
