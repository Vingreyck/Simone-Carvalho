import { prisma } from "@/lib/db";
import {
  alergenosDaReceita,
  type AvisoAlergenico,
  type InsumoParaAlergenos,
  type ReceitaParaAlergenos,
} from "@/lib/alergenos";

/**
 * Carrega o que o cálculo de alergênico precisa.
 *
 * É de propósito uma consulta separada da base de custo: alergênico não usa
 * preço nem quantidade, e misturar as duas faria a tela de ficha técnica
 * carregar dado que não usa.
 */
export async function carregarBaseDeAlergenos(): Promise<{
  receitas: Map<string, ReceitaParaAlergenos>;
  insumos: Map<string, InsumoParaAlergenos>;
}> {
  const [receitas, insumos] = await Promise.all([
    prisma.receita.findMany({
      select: {
        id: true,
        nome: true,
        itens: { select: { insumoId: true, subReceitaId: true } },
      },
    }),
    prisma.insumo.findMany({
      select: {
        id: true,
        nome: true,
        alergenos: true,
        alergenosTraco: true,
        alergenosRevisados: true,
      },
    }),
  ]);

  return {
    receitas: new Map(receitas.map((r) => [r.id, r])),
    insumos: new Map(insumos.map((i) => [i.id, i])),
  };
}

/** O aviso de uma receita só, quando a tela não precisa da base inteira. */
export async function avisoDaReceita(
  receitaId: string,
): Promise<AvisoAlergenico> {
  const base = await carregarBaseDeAlergenos();
  return alergenosDaReceita(receitaId, base.receitas, base.insumos);
}

/** Quantos insumos ativos ainda não tiveram o rótulo conferido. */
export async function insumosSemConferirAlergenos(): Promise<number> {
  return prisma.insumo.count({
    where: { ativo: true, alergenosRevisados: false },
  });
}
