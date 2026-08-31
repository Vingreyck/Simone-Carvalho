import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import {
  janelaDeMesesFechados,
  mediaDeFaturamento,
  somarPorMes,
} from "@/lib/faturamento";

/**
 * Quanto ela faturou por mês, de verdade, nos últimos meses fechados.
 *
 * `null` quando ainda não há histórico suficiente — aí quem chama volta pro
 * número que ela digitou em Ajustes.
 *
 * Conta só o que foi RECEBIDO (status PAGO): encomenda confirmada e ainda não
 * paga não é faturamento, e se entrasse aqui o rateio dos custos fixos ficaria
 * otimista — o que baixaria o preço sugerido, que é o erro que este sistema
 * existe pra evitar.
 */
export async function faturamentoMedioMedido(
  hoje = new Date(),
): Promise<Decimal | null> {
  const { inicio, fim } = janelaDeMesesFechados(hoje);

  const recebidos = await prisma.lancamento.findMany({
    where: {
      tipo: "RECEITA",
      status: "PAGO",
      dataPagamento: { gte: inicio, lt: fim },
    },
    select: { dataPagamento: true, valor: true },
  });

  const meses = somarPorMes(
    recebidos.map((l) => ({
      data: l.dataPagamento!,
      valor: l.valor.toString(),
    })),
  );

  return mediaDeFaturamento(meses);
}
