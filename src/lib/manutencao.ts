/**
 * Regra de quando a rotina automática pode rodar de novo.
 *
 * Fica separada da ação porque quem decide *mostrar* o gatilho é o painel
 * (servidor) e quem *confere de novo* é a própria ação — as duas precisam da
 * mesma regra, e um arquivo "use server" só pode exportar função assíncrona.
 */

/** Intervalo mínimo entre duas execuções. */
export const HORAS_ENTRE_EXECUCOES = 12;

/**
 * Meio dia é curto o bastante pra virada de mês ser percebida no mesmo dia, e
 * longo o bastante pra ela abrir o painel a manhã inteira sem disparar nada.
 */
export function manutencaoVencida(
  ultimaExecucao: Date | null | undefined,
  agora = new Date(),
): boolean {
  if (!ultimaExecucao) return true;

  const horas = (agora.getTime() - ultimaExecucao.getTime()) / 3_600_000;
  return horas >= HORAS_ENTRE_EXECUCOES;
}
