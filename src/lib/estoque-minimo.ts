import { Decimal } from "decimal.js";

import { mediana } from "./estatistica";

/**
 * Quanto precisa sobrar de um insumo antes de avisar — calculado do consumo.
 *
 * O alerta de "insumo acabando" e a lista de compras dependem de
 * `Insumo.estoqueMinimo`, e `situacaoEstoque` devolve "ok" quando o mínimo é 0.
 * Como o seed não define mínimo em nenhum dos 65 insumos, o aviso nunca liga:
 * a funcionalidade existe inteira e nunca aparece pra ela, a não ser que ela
 * pare e configure 65 itens na mão. Ninguém faz isso.
 *
 * O sistema já sabe quanto sai de cada insumo (cada produção grava a baixa) e
 * de quanto em quanto tempo ela repõe (cada compra tem data). Com isso dá pra
 * preencher sozinho.
 */

/** Sem esse tanto de histórico, a média diária ainda é chute. */
export const DIAS_MINIMOS_DE_HISTORICO = 30;

/** Quando não dá pra saber de quanto em quanto tempo ela compra o insumo. */
export const COBERTURA_PADRAO_DIAS = 14;

/**
 * Limites da cobertura.
 *
 * Sem o teto, um insumo comprado uma vez a cada seis meses (essência, corante)
 * pediria meio ano de estoque e viveria em alerta. Sem o piso, um insumo
 * comprado toda semana teria mínimo tão baixo que o aviso chegaria tarde
 * demais pra ela conseguir comprar antes de acabar.
 */
export const COBERTURA_MINIMA_DIAS = 7;
export const COBERTURA_MAXIMA_DIAS = 45;

export type BaseDoMinimo = {
  /** Tudo que saiu por produção no período, na unidade base */
  consumoTotal: Decimal | number | string;
  /** Tamanho do período observado */
  diasObservados: number;
  /** Intervalo médio entre as compras desse insumo; null quando não dá pra saber */
  diasEntreCompras: number | null;
  unidadeBase: "G" | "ML" | "UN";
};

/**
 * O mínimo sugerido, ou `null` quando ainda não há base pra sugerir.
 *
 * A cobertura é o intervalo entre as compras dela, não um número redondo
 * escolhido por mim: cruzar o mínimo passa a significar "sobrou mais ou menos
 * até a próxima ida ao mercado". É o momento certo de avisar — e `situacaoEstoque`
 * ainda marca como crítico na metade disso, que é a hora de correr.
 */
export function sugerirEstoqueMinimo(base: BaseDoMinimo): Decimal | null {
  const consumo = new Decimal(base.consumoTotal.toString()).abs();

  if (base.diasObservados < DIAS_MINIMOS_DE_HISTORICO) return null;
  if (consumo.lessThanOrEqualTo(0)) return null;

  const cobertura = Math.min(
    COBERTURA_MAXIMA_DIAS,
    Math.max(
      COBERTURA_MINIMA_DIAS,
      Math.round(base.diasEntreCompras ?? COBERTURA_PADRAO_DIAS),
    ),
  );

  const porDia = consumo.dividedBy(base.diasObservados);
  return arredondarParaCima(porDia.times(cobertura), base.unidadeBase);
}

/**
 * Sobe pro próximo número "de cabeça".
 *
 * 1.847 g não é um número que alguém escreveria — e o mínimo aparece na tela
 * dela ("me avise quando sobrar menos que"). Arredondar pra cima também erra
 * pro lado certo: avisa um pouco antes, nunca depois.
 */
export function arredondarParaCima(
  valor: Decimal,
  unidadeBase: "G" | "ML" | "UN",
): Decimal {
  if (unidadeBase === "UN") {
    const inteiro = valor.ceil();
    return inteiro.lessThan(1) ? new Decimal(1) : inteiro;
  }

  const passo = valor.lessThan(500) ? 50 : valor.lessThan(5000) ? 100 : 500;

  return valor.dividedBy(passo).ceil().times(passo);
}

/**
 * De quanto em quanto tempo ela costuma comprar aquele insumo.
 *
 * Olha o intervalo entre compras SEGUIDAS e tira a mediana — não o período
 * inteiro dividido pelo número de compras.
 *
 * ⚠️ A diferença não é acadêmica. Ela comprou fermento uma vez em setembro, e
 * de março pra cá compra toda semana. O período inteiro dividido pelas compras
 * dá ~50 dias por causa daquele buraco de seis meses; a mediana dos intervalos
 * seguidos dá 7, que é a verdade. Com 50 (na prática 45, o teto), o mínimo
 * sairia seis vezes maior e o insumo viveria marcado como "acabando" — o
 * alerta vira ruído e ela para de olhar.
 *
 * Precisa de pelo menos duas compras: com uma só não existe intervalo.
 */
export function intervaloEntreCompras(datas: Date[]): number | null {
  if (datas.length < 2) return null;

  const ordenadas = [...datas].sort((a, b) => a.getTime() - b.getTime());
  const intervalos: number[] = [];

  for (let i = 1; i < ordenadas.length; i++) {
    const dias =
      (ordenadas[i]!.getTime() - ordenadas[i - 1]!.getTime()) / 86_400_000;

    // Duas compras no mesmo dia (nota dividida em duas) não são um intervalo
    if (dias > 0) intervalos.push(dias);
  }

  return mediana(intervalos);
}
