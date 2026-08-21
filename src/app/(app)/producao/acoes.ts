"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { lerDataLocal } from "@/lib/format";
import {
  EstoqueInsuficienteError,
  calcularCustoMedio,
  planejarBaixa,
} from "@/lib/estoque";
import {
  ReceitaCiclicaError,
  ReceitaNaoEncontradaError,
  expandirEmInsumos,
} from "@/lib/custo";
import { carregarBaseDeCusto } from "@/server/custos";

export type Resultado = { ok: boolean; erro?: string; id?: string };

export type LinhaPrevisao = {
  insumoId: string;
  nome: string;
  unidadeBase: string;
  precisa: number;
  tem: number;
  suficiente: boolean;
};

export type Previsao = {
  linhas: LinhaPrevisao[];
  custoEstimado: number;
  podeProduzir: boolean;
  erro?: string;
};

/**
 * Mostra o que vai sair do estoque ANTES de produzir.
 *
 * Ela precisa saber que falta leite condensado antes de começar a bater a
 * massa — não depois, com o sistema recusando o registro.
 */
export async function preverProducao(
  receitaId: string,
  vezes: number,
): Promise<Previsao> {
  await exigirSessao();

  if (!receitaId || !Number.isFinite(vezes) || vezes <= 0) {
    return { linhas: [], custoEstimado: 0, podeProduzir: false };
  }

  const base = await carregarBaseDeCusto();

  let necessidades;
  try {
    necessidades = expandirEmInsumos(receitaId, vezes, base.receitas, base.insumos);
  } catch (erro) {
    if (erro instanceof ReceitaCiclicaError || erro instanceof ReceitaNaoEncontradaError) {
      return { linhas: [], custoEstimado: 0, podeProduzir: false, erro: erro.message };
    }
    throw erro;
  }

  const saldos = await prisma.insumoLote.groupBy({
    by: ["insumoId"],
    where: { insumoId: { in: necessidades.map((n) => n.insumoId) } },
    _sum: { quantidadeRestante: true },
  });

  const porInsumo = new Map(
    saldos.map((s) => [s.insumoId, Number(s._sum.quantidadeRestante ?? 0)]),
  );

  const linhas: LinhaPrevisao[] = necessidades.map((n) => {
    const tem = porInsumo.get(n.insumoId) ?? 0;
    const precisa = n.quantidadeBase.toNumber();

    return {
      insumoId: n.insumoId,
      nome: n.nome,
      unidadeBase: n.unidadeBase,
      precisa,
      tem,
      suficiente: tem >= precisa,
    };
  });

  // Custo estimado pelo custo médio; o custo REAL sai dos lotes na hora de gravar
  const custoEstimado = necessidades.reduce((total, n) => {
    const insumo = base.insumos.get(n.insumoId);
    return total.plus(n.quantidadeBase.times(new Decimal(insumo?.custoMedio ?? 0)));
  }, new Decimal(0));

  return {
    linhas,
    custoEstimado: custoEstimado.toNumber(),
    podeProduzir: linhas.length > 0 && linhas.every((l) => l.suficiente),
  };
}

const esquema = z.object({
  receitaId: z.string().min(1, "Escolha a receita."),
  quantidade: z.coerce
    .number()
    .positive("Quantas receitas você fez? Precisa ser maior que zero."),
  data: z.string().min(1, "Informe a data."),
  observacao: z.string().trim().max(500).nullish(),
});

/**
 * Registra a produção e baixa o estoque.
 *
 * O custo gravado é o REAL — sai dos lotes que efetivamente saíram, não do
 * custo médio. Se ela usou o saco de farinha caro da semana passada, é esse
 * valor que fica no histórico.
 */
export async function registrarProducao(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquema.safeParse(Object.fromEntries(formData.entries()));
  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { receitaId, quantidade, data, observacao } = dados.data;
  const base = await carregarBaseDeCusto();

  let necessidades;
  try {
    necessidades = expandirEmInsumos(receitaId, quantidade, base.receitas, base.insumos);
  } catch (erro) {
    if (erro instanceof ReceitaCiclicaError || erro instanceof ReceitaNaoEncontradaError) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }

  if (necessidades.length === 0) {
    return { ok: false, erro: "Esta receita não tem ingredientes cadastrados." };
  }

  const dataProducao = lerDataLocal(data);

  try {
    const producaoId = await prisma.$transaction(async (tx) => {
      const producao = await tx.producao.create({
        data: {
          receitaId,
          quantidade: new Decimal(quantidade).toFixed(4),
          data: dataProducao,
          status: "CONCLUIDA",
          observacao: observacao || null,
        },
        select: { id: true, numero: true },
      });

      let custoTotal = new Decimal(0);

      for (const necessidade of necessidades) {
        const lotes = await tx.insumoLote.findMany({
          where: { insumoId: necessidade.insumoId, quantidadeRestante: { gt: 0 } },
          select: {
            id: true,
            quantidadeRestante: true,
            custoUnitario: true,
            validade: true,
            dataEntrada: true,
          },
        });

        const plano = planejarBaixa(
          lotes.map((l) => ({
            id: l.id,
            quantidadeRestante: l.quantidadeRestante.toString(),
            custoUnitario: l.custoUnitario.toString(),
            validade: l.validade,
            dataEntrada: l.dataEntrada,
          })),
          necessidade.quantidadeBase,
          necessidade.nome,
        );

        let saldo = lotes.reduce(
          (t, l) => t.plus(new Decimal(l.quantidadeRestante.toString())),
          new Decimal(0),
        );

        for (const baixa of plano.baixas) {
          await tx.insumoLote.update({
            where: { id: baixa.loteId },
            data: {
              quantidadeRestante: { decrement: baixa.quantidade.toFixed(4) },
            },
          });

          saldo = saldo.minus(baixa.quantidade);

          await tx.movimentoEstoque.create({
            data: {
              insumoId: necessidade.insumoId,
              loteId: baixa.loteId,
              tipo: "SAIDA_PRODUCAO",
              quantidade: baixa.quantidade.negated().toFixed(4),
              custoUnitario: baixa.custoUnitario.toFixed(6),
              saldoApos: saldo.toFixed(4),
              producaoId: producao.id,
              motivo: `Produção #${producao.numero}`,
              data: dataProducao,
            },
          });
        }

        custoTotal = custoTotal.plus(plano.custoTotal);

        // Recalcula o custo médio com os lotes que sobraram
        const restantes = await tx.insumoLote.findMany({
          where: { insumoId: necessidade.insumoId, quantidadeRestante: { gt: 0 } },
          select: {
            id: true,
            quantidadeRestante: true,
            custoUnitario: true,
            validade: true,
            dataEntrada: true,
          },
        });

        const insumoAtual = await tx.insumo.findUnique({
          where: { id: necessidade.insumoId },
          select: { custoMedio: true },
        });

        const custoMedio = calcularCustoMedio(
          restantes.map((l) => ({
            id: l.id,
            quantidadeRestante: l.quantidadeRestante.toString(),
            custoUnitario: l.custoUnitario.toString(),
            validade: l.validade,
            dataEntrada: l.dataEntrada,
          })),
          insumoAtual?.custoMedio.toString() ?? 0,
        );

        await tx.insumo.update({
          where: { id: necessidade.insumoId },
          data: { custoMedio: custoMedio.toFixed(6) },
        });
      }

      await tx.producao.update({
        where: { id: producao.id },
        data: { custoTotal: custoTotal.toFixed(4) },
      });

      return producao.id;
    });

    revalidarTudo();
    return { ok: true, id: producaoId };
  } catch (erro) {
    if (erro instanceof EstoqueInsuficienteError) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }
}

/**
 * Desfaz uma produção: devolve os insumos aos lotes de onde saíram.
 *
 * Só funciona se os lotes ainda existirem — por isso a devolução é feita
 * lote a lote, usando o histórico de movimentos como fonte da verdade.
 */
export async function excluirProducao(id: string): Promise<Resultado> {
  await exigirSessao();

  const producao = await prisma.producao.findUnique({
    where: { id },
    include: { movimentos: true },
  });

  if (!producao) return { ok: false, erro: "Produção não encontrada." };

  const insumosAfetados = [
    ...new Set(producao.movimentos.map((m) => m.insumoId)),
  ];

  await prisma.$transaction(async (tx) => {
    for (const movimento of producao.movimentos) {
      if (!movimento.loteId) continue;

      const lote = await tx.insumoLote.findUnique({
        where: { id: movimento.loteId },
        select: { quantidadeInicial: true, quantidadeRestante: true },
      });

      if (!lote) continue; // lote apagado: não dá pra devolver, segue

      // A soma não pode passar do que entrou no lote (CHECK do banco)
      const devolver = movimento.quantidade.abs();
      const cabe = lote.quantidadeInicial.minus(lote.quantidadeRestante);
      const quantidade = devolver.greaterThan(cabe) ? cabe : devolver;

      await tx.insumoLote.update({
        where: { id: movimento.loteId },
        data: { quantidadeRestante: { increment: quantidade } },
      });
    }

    await tx.movimentoEstoque.deleteMany({ where: { producaoId: id } });
    await tx.producao.delete({ where: { id } });

    for (const insumoId of insumosAfetados) {
      const [lotes, insumo] = await Promise.all([
        tx.insumoLote.findMany({
          where: { insumoId, quantidadeRestante: { gt: 0 } },
          select: {
            id: true,
            quantidadeRestante: true,
            custoUnitario: true,
            validade: true,
            dataEntrada: true,
          },
        }),
        tx.insumo.findUnique({
          where: { id: insumoId },
          select: { custoMedio: true },
        }),
      ]);

      const custoMedio = calcularCustoMedio(
        lotes.map((l) => ({
          id: l.id,
          quantidadeRestante: l.quantidadeRestante.toString(),
          custoUnitario: l.custoUnitario.toString(),
          validade: l.validade,
          dataEntrada: l.dataEntrada,
        })),
        insumo?.custoMedio.toString() ?? 0,
      );

      await tx.insumo.update({
        where: { id: insumoId },
        data: { custoMedio: custoMedio.toFixed(6) },
      });
    }
  });

  revalidarTudo();
  return { ok: true };
}

function revalidarTudo() {
  revalidatePath("/producao");
  revalidatePath("/estoque");
  revalidatePath("/insumos");
  revalidatePath("/");
}

export type UltimaProducao = {
  receitaId: string;
  receitaNome: string;
  quantidade: number;
};

/**
 * A última produção, pra repetir num toque.
 *
 * Ela produz quase sempre a mesma coisa: a massa do dia, o recheio da semana.
 * Escolher receita e digitar quantidade toda vez é atrito puro.
 */
export async function ultimaProducao(): Promise<UltimaProducao | null> {
  await exigirSessao();

  const producao = await prisma.producao.findFirst({
    orderBy: { criadoEm: "desc" },
    include: { receita: { select: { id: true, nome: true, ativo: true } } },
  });

  if (!producao || !producao.receita.ativo) return null;

  return {
    receitaId: producao.receita.id,
    receitaNome: producao.receita.nome,
    quantidade: Number(producao.quantidade),
  };
}
