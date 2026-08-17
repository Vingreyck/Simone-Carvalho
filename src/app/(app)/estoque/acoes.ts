"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { converterParaBase, UnidadeDesconhecidaError } from "@/lib/unidades";
import {
  EstoqueInsuficienteError,
  calcularCustoMedio,
  planejarBaixa,
} from "@/lib/estoque";

export type Resultado = { ok: boolean; erro?: string };

const esquema = z.object({
  insumoId: z.string().min(1, "Escolha o insumo."),
  quantidade: z.coerce.number().positive("Informe uma quantidade maior que zero."),
  unidade: z.string().trim().min(1, "Escolha a unidade."),
  motivo: z.string().trim().max(200).nullish(),
});

/**
 * Registra perda: estragou, queimou, caiu no chão.
 *
 * Sai pelo mesmo FIFO da produção (o que vence antes sai antes), então o custo
 * da perda reflete o lote que realmente se perdeu.
 */
export async function registrarPerda(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquema.safeParse({
    insumoId: formData.get("insumoId"),
    quantidade: formData.get("quantidade"),
    unidade: formData.get("unidade"),
    motivo: formData.get("motivo"),
  });

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { insumoId, quantidade, unidade, motivo } = dados.data;

  const insumo = await prisma.insumo.findUnique({
    where: { id: insumoId },
    include: { equivalencias: true },
  });

  if (!insumo) return { ok: false, erro: "Insumo não encontrado." };

  let quantidadeBase: Decimal;
  try {
    quantidadeBase = converterParaBase(
      quantidade,
      unidade,
      insumo.unidadeBase,
      insumo.equivalencias.map((e) => ({
        nome: e.nome,
        quantidadeBase: e.quantidadeBase.toString(),
      })),
    );
  } catch (erro) {
    if (erro instanceof UnidadeDesconhecidaError) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const lotes = await tx.insumoLote.findMany({
        where: { insumoId, quantidadeRestante: { gt: 0 } },
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
        quantidadeBase,
        insumo.nome,
      );

      let saldo = lotes.reduce(
        (t, l) => t.plus(new Decimal(l.quantidadeRestante.toString())),
        new Decimal(0),
      );

      for (const baixa of plano.baixas) {
        await tx.insumoLote.update({
          where: { id: baixa.loteId },
          data: { quantidadeRestante: { decrement: baixa.quantidade.toFixed(4) } },
        });

        saldo = saldo.minus(baixa.quantidade);

        await tx.movimentoEstoque.create({
          data: {
            insumoId,
            loteId: baixa.loteId,
            tipo: "PERDA",
            quantidade: baixa.quantidade.negated().toFixed(4),
            custoUnitario: baixa.custoUnitario.toFixed(6),
            saldoApos: saldo.toFixed(4),
            motivo: motivo || "Perda registrada",
          },
        });
      }

      await atualizarCustoMedio(tx, insumoId, insumo.custoMedio.toString());
    });
  } catch (erro) {
    if (erro instanceof EstoqueInsuficienteError) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }

  revalidarTudo();
  return { ok: true };
}

const esquemaAjuste = z.object({
  insumoId: z.string().min(1),
  saldoReal: z.coerce.number().min(0, "O saldo não pode ser negativo."),
  unidade: z.string().trim().min(1),
  motivo: z.string().trim().max(200).nullish(),
});

/**
 * Inventário: ela conta o que tem de verdade e o sistema acerta a diferença.
 *
 * Se sobrou mais do que o sistema achava, entra um lote novo pelo custo médio
 * atual (não dá pra saber de qual compra veio). Se faltou, sai por FIFO.
 */
export async function ajustarEstoque(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquemaAjuste.safeParse({
    insumoId: formData.get("insumoId"),
    saldoReal: formData.get("saldoReal"),
    unidade: formData.get("unidade"),
    motivo: formData.get("motivo"),
  });

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { insumoId, saldoReal, unidade, motivo } = dados.data;

  const insumo = await prisma.insumo.findUnique({
    where: { id: insumoId },
    include: { equivalencias: true },
  });

  if (!insumo) return { ok: false, erro: "Insumo não encontrado." };

  let saldoDesejado: Decimal;
  try {
    saldoDesejado = converterParaBase(
      saldoReal,
      unidade,
      insumo.unidadeBase,
      insumo.equivalencias.map((e) => ({
        nome: e.nome,
        quantidadeBase: e.quantidadeBase.toString(),
      })),
    );
  } catch (erro) {
    if (erro instanceof UnidadeDesconhecidaError) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }

  await prisma.$transaction(async (tx) => {
    const lotes = await tx.insumoLote.findMany({
      where: { insumoId, quantidadeRestante: { gt: 0 } },
      select: {
        id: true,
        quantidadeRestante: true,
        custoUnitario: true,
        validade: true,
        dataEntrada: true,
      },
    });

    const saldoAtual = lotes.reduce(
      (t, l) => t.plus(new Decimal(l.quantidadeRestante.toString())),
      new Decimal(0),
    );

    const diferenca = saldoDesejado.minus(saldoAtual);
    if (diferenca.isZero()) return;

    const razao = motivo || "Ajuste de inventário";

    if (diferenca.greaterThan(0)) {
      // Sobrou: entra lote novo pelo custo médio conhecido
      const custo = new Decimal(insumo.custoMedio.toString());

      const lote = await tx.insumoLote.create({
        data: {
          insumoId,
          quantidadeInicial: diferenca.toFixed(4),
          quantidadeRestante: diferenca.toFixed(4),
          custoUnitario: custo.toFixed(6),
        },
        select: { id: true },
      });

      await tx.movimentoEstoque.create({
        data: {
          insumoId,
          loteId: lote.id,
          tipo: "AJUSTE_INVENTARIO",
          quantidade: diferenca.toFixed(4),
          custoUnitario: custo.toFixed(6),
          saldoApos: saldoDesejado.toFixed(4),
          motivo: razao,
        },
      });
    } else {
      const plano = planejarBaixa(
        lotes.map((l) => ({
          id: l.id,
          quantidadeRestante: l.quantidadeRestante.toString(),
          custoUnitario: l.custoUnitario.toString(),
          validade: l.validade,
          dataEntrada: l.dataEntrada,
        })),
        diferenca.abs(),
        insumo.nome,
      );

      let saldo = saldoAtual;

      for (const baixa of plano.baixas) {
        await tx.insumoLote.update({
          where: { id: baixa.loteId },
          data: { quantidadeRestante: { decrement: baixa.quantidade.toFixed(4) } },
        });

        saldo = saldo.minus(baixa.quantidade);

        await tx.movimentoEstoque.create({
          data: {
            insumoId,
            loteId: baixa.loteId,
            tipo: "AJUSTE_INVENTARIO",
            quantidade: baixa.quantidade.negated().toFixed(4),
            custoUnitario: baixa.custoUnitario.toFixed(6),
            saldoApos: saldo.toFixed(4),
            motivo: razao,
          },
        });
      }
    }

    await atualizarCustoMedio(tx, insumoId, insumo.custoMedio.toString());
  });

  revalidarTudo();
  return { ok: true };
}

/** Recalcula e grava o custo médio a partir dos lotes que sobraram. */
async function atualizarCustoMedio(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  insumoId: string,
  custoAnterior: string,
) {
  const lotes = await tx.insumoLote.findMany({
    where: { insumoId, quantidadeRestante: { gt: 0 } },
    select: {
      id: true,
      quantidadeRestante: true,
      custoUnitario: true,
      validade: true,
      dataEntrada: true,
    },
  });

  const custoMedio = calcularCustoMedio(
    lotes.map((l) => ({
      id: l.id,
      quantidadeRestante: l.quantidadeRestante.toString(),
      custoUnitario: l.custoUnitario.toString(),
      validade: l.validade,
      dataEntrada: l.dataEntrada,
    })),
    custoAnterior,
  );

  await tx.insumo.update({
    where: { id: insumoId },
    data: { custoMedio: custoMedio.toFixed(6) },
  });
}

function revalidarTudo() {
  revalidatePath("/estoque");
  revalidatePath("/insumos");
  revalidatePath("/");
}
