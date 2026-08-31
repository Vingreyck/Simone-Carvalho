import { prisma } from "@/lib/db";
import { prazoDeValidade } from "@/lib/estoque";

/** Quantos lotes recentes entram na conta de cada insumo. */
const LOTES_POR_INSUMO = 8;

/**
 * Quantos dias cada insumo costuma durar, pra pré-preencher a validade na
 * compra.
 *
 * Só olha lote que teve validade preenchida. Insumo novo, ou que ela nunca
 * anotou a validade, fica de fora e o campo continua em branco.
 */
export async function prazosDeValidadePorInsumo(): Promise<
  Record<string, number>
> {
  const lotes = await prisma.insumoLote.findMany({
    where: {
      validade: { not: null },
      insumo: { ativo: true, perecivel: true },
    },
    select: { insumoId: true, dataEntrada: true, validade: true },
    orderBy: { dataEntrada: "desc" },
  });

  const porInsumo = new Map<string, { dataEntrada: Date; validade: Date }[]>();

  for (const lote of lotes) {
    const lista = porInsumo.get(lote.insumoId) ?? [];

    // Já vem do mais novo pro mais velho: corta os antigos, que podem ser de
    // outra marca com prazo diferente.
    if (lista.length >= LOTES_POR_INSUMO) continue;

    lista.push({ dataEntrada: lote.dataEntrada, validade: lote.validade! });
    porInsumo.set(lote.insumoId, lista);
  }

  const prazos: Record<string, number> = {};

  for (const [insumoId, lista] of porInsumo) {
    const dias = prazoDeValidade(lista);
    if (dias !== null) prazos[insumoId] = dias;
  }

  return prazos;
}
