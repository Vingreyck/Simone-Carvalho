import { Decimal } from "decimal.js";

/**
 * Quanto ela fatura por mês — medido, não perguntado.
 *
 * Esse número não é decoração: o `%CustosFixos` do preço sai de
 * `soma das contas fixas ÷ faturamento`. Enquanto ele era digitado à mão em
 * Ajustes, bastava ela digitar uma vez e nunca mais pra o divisor do markup
 * ficar errado — e o preço sugerido de TODO doce erra junto, sem nenhum sinal
 * na tela. Ela não teria como perceber.
 *
 * O sistema já registra cada venda. Então ele mede.
 */

/** Meses fechados que entram na média. */
export const MESES_PARA_MEDIA = 3;

/**
 * Mínimo de meses com venda pra confiar na medição.
 *
 * Com um mês só, um mês fraco (ou o mês em que ela começou a usar o sistema no
 * dia 20) viraria a base de rateio e empurraria o preço de tudo pra cima.
 */
export const MESES_MINIMOS = 2;

export type MesDeFaturamento = {
  /** "2026-07" */
  mes: string;
  total: Decimal;
};

/**
 * Média dos meses fechados com venda, ou `null` quando ainda não dá pra medir.
 *
 * Duas exclusões de propósito:
 *
 * 1. **O mês corrente não entra.** No dia 3 ele tem 3 dias de venda. Entrar na
 *    média puxaria o faturamento pra baixo, o que aumenta o % de custos fixos,
 *    o que sobe o preço sugerido — todo começo de mês. O preço não pode
 *    oscilar por causa do calendário.
 * 2. **Mês zerado não entra.** Zero quase nunca quer dizer "não vendeu nada":
 *    quer dizer que ela não lançou. Contar como mês normal cortaria a média
 *    pela metade.
 */
export function mediaDeFaturamento(meses: MesDeFaturamento[]): Decimal | null {
  const comVenda = meses.filter((m) => m.total.greaterThan(0));

  if (comVenda.length < MESES_MINIMOS) return null;

  const soma = comVenda.reduce(
    (total, m) => total.plus(m.total),
    new Decimal(0),
  );

  return soma.dividedBy(comVenda.length);
}

/**
 * Os meses fechados que devem ser olhados, do mais antigo pro mais novo.
 *
 * Devolve as bordas em vez de só os rótulos porque quem consulta o banco
 * precisa das datas — e assim a regra de "o mês corrente não conta" mora num
 * lugar só.
 */
export function janelaDeMesesFechados(
  hoje: Date,
  quantidade = MESES_PARA_MEDIA,
): { inicio: Date; fim: Date } {
  // Primeiro dia do mês corrente é o FIM da janela (exclusivo): tudo antes
  // dele é mês fechado.
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - quantidade, 1);

  return { inicio, fim };
}

/** "2026-07", que é como os meses são agrupados e comparados. */
export function chaveDoMes(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${data.getFullYear()}-${mes}`;
}

/**
 * Agrupa lançamentos por mês, somando o valor.
 *
 * Separado da consulta pro cálculo poder ser testado sem banco — é a regra que
 * decide preço, e regra que decide preço tem teste.
 */
export function somarPorMes(
  lancamentos: { data: Date; valor: Decimal | number | string }[],
): MesDeFaturamento[] {
  const porMes = new Map<string, Decimal>();

  for (const l of lancamentos) {
    const chave = chaveDoMes(l.data);
    const atual = porMes.get(chave) ?? new Decimal(0);
    porMes.set(chave, atual.plus(new Decimal(l.valor.toString())));
  }

  return [...porMes.entries()]
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}
