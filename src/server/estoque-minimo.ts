import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import {
  intervaloEntreCompras,
  sugerirEstoqueMinimo,
} from "@/lib/estoque-minimo";

/** Janela de consumo observada. */
const DIAS_DA_JANELA = 90;

export type MinimoSugerido = {
  insumoId: string;
  nome: string;
  minimo: Decimal;
};

/**
 * Calcula o estoque mínimo dos insumos que ainda estão com mínimo zerado.
 *
 * Só olha quem está em 0. Número que ELA escolheu nunca é tocado — o sistema
 * preenche o que estava em branco, não corrige o que ela decidiu.
 */
export async function calcularMinimosSugeridos(
  hoje = new Date(),
): Promise<MinimoSugerido[]> {
  const insumos = await prisma.insumo.findMany({
    where: { ativo: true, estoqueMinimo: 0 },
    select: { id: true, nome: true, unidadeBase: true },
  });

  if (insumos.length === 0) return [];

  const ids = insumos.map((i) => i.id);
  const inicioDaJanela = new Date(hoje);
  inicioDaJanela.setDate(inicioDaJanela.getDate() - DIAS_DA_JANELA);

  const [consumos, primeirosMovimentos, itensDeCompra] = await Promise.all([
    prisma.movimentoEstoque.groupBy({
      by: ["insumoId"],
      where: {
        insumoId: { in: ids },
        tipo: "SAIDA_PRODUCAO",
        data: { gte: inicioDaJanela },
      },
      _sum: { quantidade: true },
    }),
    /*
      Desde quando este insumo existe no estoque.

      É o que define o tamanho do período observado. Sem isso, um insumo que
      entrou na semana passada e foi usado uma vez pareceria ter um consumo
      diário altíssimo, e o mínimo sugerido sairia absurdo.
    */
    prisma.movimentoEstoque.groupBy({
      by: ["insumoId"],
      where: { insumoId: { in: ids } },
      _min: { data: true },
    }),
    // Histórico inteiro de compras: quanto mais datas, melhor o intervalo médio
    prisma.compraItem.findMany({
      where: { insumoId: { in: ids } },
      select: { insumoId: true, compra: { select: { data: true } } },
    }),
  ]);

  const consumoPorInsumo = new Map(
    consumos.map((c) => [c.insumoId, c._sum.quantidade ?? new Decimal(0)]),
  );
  const inicioPorInsumo = new Map(
    primeirosMovimentos.map((m) => [m.insumoId, m._min.data]),
  );

  const comprasPorInsumo = new Map<string, Date[]>();
  for (const item of itensDeCompra) {
    const lista = comprasPorInsumo.get(item.insumoId) ?? [];
    lista.push(item.compra.data);
    comprasPorInsumo.set(item.insumoId, lista);
  }

  const sugestoes: MinimoSugerido[] = [];

  for (const insumo of insumos) {
    const consumo = consumoPorInsumo.get(insumo.id);
    const desde = inicioPorInsumo.get(insumo.id);

    if (!consumo || !desde) continue;

    const diasDesdeOInicio = Math.floor(
      (hoje.getTime() - desde.getTime()) / 86_400_000,
    );

    const minimo = sugerirEstoqueMinimo({
      consumoTotal: consumo.toString(),
      diasObservados: Math.min(diasDesdeOInicio, DIAS_DA_JANELA),
      diasEntreCompras: intervaloEntreCompras(
        comprasPorInsumo.get(insumo.id) ?? [],
      ),
      unidadeBase: insumo.unidadeBase,
    });

    if (!minimo) continue;

    sugestoes.push({ insumoId: insumo.id, nome: insumo.nome, minimo });
  }

  return sugestoes;
}

/** Grava os mínimos calculados. Devolve quantos insumos foram preenchidos. */
export async function preencherMinimosZerados(
  hoje = new Date(),
): Promise<number> {
  const sugestoes = await calcularMinimosSugeridos(hoje);

  for (const sugestao of sugestoes) {
    /*
      O `estoqueMinimo: 0` no where não é redundante: entre o cálculo e a
      gravação ela pode ter definido o mínimo desse insumo na mão, e o palpite
      do sistema não pode passar por cima.
    */
    await prisma.insumo.updateMany({
      where: { id: sugestao.insumoId, estoqueMinimo: 0 },
      data: { estoqueMinimo: sugestao.minimo.toFixed(4) },
    });
  }

  return sugestoes.length;
}
