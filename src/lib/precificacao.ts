import { Decimal } from "decimal.js";

/**
 * Precificação pelo **markup divisor**.
 *
 * A conta que quase toda confeiteira faz é "custo × 3". O problema: taxa de
 * cartão, imposto e custos fixos são percentuais sobre o PREÇO DE VENDA, não
 * sobre o custo. Multiplicar o custo faz o lucro real ficar bem abaixo do
 * imaginado — às vezes negativo.
 *
 *   CustoDireto   = ingredientes + embalagem + mão de obra
 *   Divisor       = 1 − (%fixos + %impostos + %taxas + %margem)
 *   PreçoSugerido = CustoDireto ÷ Divisor
 *
 * Assim, quando ela vende pelo preço sugerido, sobra exatamente a margem que
 * ela pediu — depois de pagar tudo.
 */

export type ConfigPrecificacao = {
  valorHoraMaoDeObra: Decimal | number | string;
  percentualCustosFixos: Decimal | number | string;
  percentualImpostos: Decimal | number | string;
  percentualTaxaCartao: Decimal | number | string;
  margemLucroPadrao: Decimal | number | string;
};

export type EntradaDePreco = {
  /** Custo dos ingredientes, vindo da ficha técnica */
  custoIngredientes: Decimal | number | string;
  custoEmbalagem?: Decimal | number | string;
  /** Tempo total de preparo daquele produto, em minutos */
  tempoPreparoMin?: number;
  /** Margem específica deste produto; se ausente, usa a padrão da configuração */
  margemAlvo?: Decimal | number | string | null;
};

export type PrecoSugerido = {
  custoIngredientes: Decimal;
  custoEmbalagem: Decimal;
  custoMaoDeObra: Decimal;
  /** O que sai do bolso dela por unidade produzida */
  custoDireto: Decimal;
  margemUsada: Decimal;
  /** Soma dos percentuais que incidem sobre o preço de venda */
  percentuaisSobreVenda: Decimal;
  divisor: Decimal;
  precoSugerido: Decimal;
  /** true quando os percentuais somam 100% ou mais e a conta é impossível */
  impossivel: boolean;
};

export class PrecificacaoImpossivelError extends Error {
  constructor(readonly somaPercentuais: Decimal) {
    super(
      `Os percentuais somam ${somaPercentuais.toFixed(1)}%, que é 100% ou mais do ` +
        "preço de venda. Nenhum preço fecharia essa conta — reduza a margem, os " +
        "custos fixos, os impostos ou a taxa de cartão.",
    );
    this.name = "PrecificacaoImpossivelError";
  }
}

export function calcularPrecoSugerido(
  entrada: EntradaDePreco,
  config: ConfigPrecificacao,
): PrecoSugerido {
  const custoIngredientes = new Decimal(entrada.custoIngredientes);
  const custoEmbalagem = new Decimal(entrada.custoEmbalagem ?? 0);

  const valorHora = new Decimal(config.valorHoraMaoDeObra);
  const minutos = new Decimal(entrada.tempoPreparoMin ?? 0);
  const custoMaoDeObra = valorHora.times(minutos).dividedBy(60);

  const custoDireto = custoIngredientes
    .plus(custoEmbalagem)
    .plus(custoMaoDeObra);

  const margemUsada = new Decimal(
    entrada.margemAlvo ?? config.margemLucroPadrao,
  );

  const percentuaisSobreVenda = new Decimal(config.percentualCustosFixos)
    .plus(new Decimal(config.percentualImpostos))
    .plus(new Decimal(config.percentualTaxaCartao))
    .plus(margemUsada);

  const divisor = new Decimal(1).minus(percentuaisSobreVenda.dividedBy(100));

  // Divisor zero ou negativo = a conta não fecha por nenhum preço
  if (divisor.lessThanOrEqualTo(0)) {
    return {
      custoIngredientes,
      custoEmbalagem,
      custoMaoDeObra,
      custoDireto,
      margemUsada,
      percentuaisSobreVenda,
      divisor,
      precoSugerido: new Decimal(0),
      impossivel: true,
    };
  }

  return {
    custoIngredientes,
    custoEmbalagem,
    custoMaoDeObra,
    custoDireto,
    margemUsada,
    percentuaisSobreVenda,
    divisor,
    precoSugerido: custoDireto.dividedBy(divisor),
    impossivel: false,
  };
}

export type SituacaoPreco = "prejuizo" | "sem-lucro" | "abaixo-da-meta" | "ok";

export type AnaliseDePreco = {
  precoVenda: Decimal;
  custoDireto: Decimal;
  /** Quanto some em taxa de cartão e imposto */
  descontosSobreVenda: Decimal;
  /** Quanto desse produto vai pagar os custos fixos do mês */
  contribuicaoCustosFixos: Decimal;
  /** O que sobra de verdade */
  lucro: Decimal;
  /** Lucro ÷ preço de venda, em % */
  margemReal: Decimal;
  situacao: SituacaoPreco;
};

/**
 * O outro lado da conta: dado o preço que ela JÁ pratica, quanto sobra mesmo?
 *
 * É o que sustenta o alerta de prejuízo — vender um bolo por R$ 40 quando o
 * custo direto é R$ 38 parece lucro, mas depois da taxa de cartão e do rateio
 * dos custos fixos vira perda.
 */
export function analisarPreco(
  precoVenda: Decimal | number | string,
  custoDireto: Decimal | number | string,
  config: ConfigPrecificacao,
  margemAlvo?: Decimal | number | string | null,
): AnaliseDePreco {
  const preco = new Decimal(precoVenda);
  const custo = new Decimal(custoDireto);

  const percentualDescontos = new Decimal(config.percentualImpostos).plus(
    new Decimal(config.percentualTaxaCartao),
  );

  const descontosSobreVenda = preco.times(percentualDescontos).dividedBy(100);
  const contribuicaoCustosFixos = preco
    .times(new Decimal(config.percentualCustosFixos))
    .dividedBy(100);

  const lucro = preco
    .minus(custo)
    .minus(descontosSobreVenda)
    .minus(contribuicaoCustosFixos);

  const margemReal = preco.greaterThan(0)
    ? lucro.dividedBy(preco).times(100)
    : new Decimal(0);

  const meta = new Decimal(margemAlvo ?? config.margemLucroPadrao);

  let situacao: SituacaoPreco;
  if (lucro.lessThan(0)) situacao = "prejuizo";
  else if (lucro.isZero()) situacao = "sem-lucro";
  else if (margemReal.lessThan(meta)) situacao = "abaixo-da-meta";
  else situacao = "ok";

  return {
    precoVenda: preco,
    custoDireto: custo,
    descontosSobreVenda,
    contribuicaoCustosFixos,
    lucro,
    margemReal,
    situacao,
  };
}

/**
 * Arredonda pra um preço que se fala em voz alta: 39,21 → 39,90.
 * Sugerir "R$ 39,21" numa vitrine de doceria não combina.
 */
export function arredondarPrecoComercial(
  valor: Decimal | number | string,
): Decimal {
  const preco = new Decimal(valor);
  if (preco.lessThanOrEqualTo(0)) return new Decimal(0);

  // Até R$ 10, arredonda pra cima em múltiplos de R$ 0,50
  if (preco.lessThan(10)) {
    return preco.times(2).ceil().dividedBy(2);
  }

  // Acima disso, sobe pro próximo ,90
  const inteiro = preco.floor();
  const comNoventa = inteiro.plus("0.90");

  return comNoventa.greaterThanOrEqualTo(preco)
    ? comNoventa
    : inteiro.plus(1).plus("0.90");
}

/**
 * Converte os custos fixos do mês em percentual sobre o faturamento.
 * Fecha o ciclo: gás, luz e aluguel reais viram parte do preço de cada doce.
 */
export function percentualDeCustosFixos(
  totalCustosFixosMensais: Decimal | number | string,
  faturamentoMedioMensal: Decimal | number | string,
): Decimal {
  const faturamento = new Decimal(faturamentoMedioMensal);
  if (faturamento.lessThanOrEqualTo(0)) return new Decimal(0);

  return new Decimal(totalCustosFixosMensais)
    .dividedBy(faturamento)
    .times(100);
}
