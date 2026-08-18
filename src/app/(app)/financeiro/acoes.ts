"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { lerDataLocal } from "@/lib/format";
import { percentualDeCustosFixos } from "@/lib/precificacao";

export type Resultado = { ok: boolean; erro?: string; id?: string };

const esquemaLancamento = z.object({
  id: z.string().nullish(),
  tipo: z.enum(["RECEITA", "DESPESA"]),
  categoriaId: z.string().nullish(),
  descricao: z.string().trim().min(2, "Descreva o lançamento.").max(120),
  valor: z.coerce.number().positive("O valor precisa ser maior que zero."),
  dataVencimento: z.string().min(1, "Informe a data."),
  jaPago: z.coerce.boolean().default(false),
  formaPagamento: z.string().trim().max(40).nullish(),
  observacao: z.string().trim().max(300).nullish(),
});

export async function salvarLancamento(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquemaLancamento.safeParse({
    ...Object.fromEntries(formData.entries()),
    jaPago: formData.get("jaPago") === "on",
  });

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { id, jaPago, dataVencimento, categoriaId, ...resto } = dados.data;
  const vencimento = lerDataLocal(dataVencimento);

  const dadosGravar = {
    ...resto,
    categoriaId: categoriaId || null,
    dataVencimento: vencimento,
    dataPagamento: jaPago ? vencimento : null,
    status: jaPago ? ("PAGO" as const) : ("PENDENTE" as const),
  };

  if (id) {
    await prisma.lancamento.update({ where: { id }, data: dadosGravar });
  } else {
    await prisma.lancamento.create({ data: dadosGravar });
  }

  revalidarTudo();
  return { ok: true };
}

/** Marca como pago/recebido (ou volta pra pendente). */
export async function alternarPagamento(
  id: string,
  pago: boolean,
): Promise<Resultado> {
  await exigirSessao();

  await prisma.lancamento.update({
    where: { id },
    data: {
      status: pago ? "PAGO" : "PENDENTE",
      dataPagamento: pago ? new Date() : null,
    },
  });

  revalidarTudo();
  return { ok: true };
}

export async function excluirLancamento(id: string): Promise<Resultado> {
  await exigirSessao();

  const lancamento = await prisma.lancamento.findUnique({
    where: { id },
    select: { compraId: true },
  });

  // Lançamento gerado por uma compra some junto com ela, não sozinho —
  // senão a compra ficaria sem contrapartida no caixa.
  if (lancamento?.compraId) {
    return {
      ok: false,
      erro:
        "Este lançamento veio de uma compra. Pra removê-lo, apague a compra " +
        "correspondente em Compras.",
    };
  }

  await prisma.lancamento.delete({ where: { id } });
  revalidarTudo();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Custos fixos — é o que fecha o ciclo despesa real → preço de venda
// ---------------------------------------------------------------------------

const esquemaCustoFixo = z.object({
  id: z.string().nullish(),
  nome: z.string().trim().min(2, "Dê um nome à conta.").max(60),
  valor: z.coerce.number().positive("O valor precisa ser maior que zero."),
  diaVencimento: z.coerce.number().int().min(1).max(31).nullish(),
});

export async function salvarCustoFixo(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const bruto = Object.fromEntries(formData.entries());
  const dados = esquemaCustoFixo.safeParse({
    ...bruto,
    diaVencimento: bruto.diaVencimento || null,
  });

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { id, ...resto } = dados.data;

  try {
    if (id) {
      await prisma.custoFixoMensal.update({ where: { id }, data: resto });
    } else {
      await prisma.custoFixoMensal.create({ data: resto });
    }
  } catch (erro) {
    if (
      typeof erro === "object" &&
      erro !== null &&
      "code" in erro &&
      (erro as { code?: string }).code === "P2002"
    ) {
      return { ok: false, erro: `Já existe uma conta chamada "${resto.nome}".` };
    }
    throw erro;
  }

  await recalcularPercentualCustosFixos();
  revalidarTudo();
  return { ok: true };
}

export async function excluirCustoFixo(id: string): Promise<Resultado> {
  await exigirSessao();

  await prisma.custoFixoMensal.delete({ where: { id } });
  await recalcularPercentualCustosFixos();

  revalidarTudo();
  return { ok: true };
}

/**
 * Converte a soma das contas fixas em percentual do faturamento e grava na
 * configuração de precificação.
 *
 * É aqui que o ciclo fecha: ela cadastra a conta de luz, e o preço sugerido de
 * todos os doces sobe pra cobrir isso.
 */
export async function recalcularPercentualCustosFixos(): Promise<void> {
  const [custos, config] = await Promise.all([
    prisma.custoFixoMensal.findMany({
      where: { ativo: true },
      select: { valor: true },
    }),
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
  ]);

  const faturamento = new Decimal(config?.faturamentoMedioMensal ?? 0);

  // Sem faturamento informado não dá pra ratear — mantém o que ela digitou à mão
  if (faturamento.lessThanOrEqualTo(0)) return;

  const total = custos.reduce(
    (soma, c) => soma.plus(new Decimal(c.valor.toString())),
    new Decimal(0),
  );

  const percentual = percentualDeCustosFixos(total, faturamento);

  // Trava em 90%: acima disso a conta do markup fica impossível e o sistema
  // deixaria de sugerir qualquer preço.
  const limitado = percentual.greaterThan(90) ? new Decimal(90) : percentual;

  await prisma.configPrecificacao.update({
    where: { id: "default" },
    data: { percentualCustosFixos: limitado.toFixed(2) },
  });

  revalidatePath("/ajustes");
  revalidatePath("/produtos");
}

/** Lança todas as contas fixas do mês como contas a pagar, de uma vez. */
export async function gerarContasDoMes(
  mesReferencia: string,
): Promise<Resultado> {
  await exigirSessao();

  const [ano, mes] = mesReferencia.split("-").map(Number);
  if (!ano || !mes) return { ok: false, erro: "Mês inválido." };

  const custos = await prisma.custoFixoMensal.findMany({
    where: { ativo: true },
  });

  if (custos.length === 0) {
    return { ok: false, erro: "Você ainda não cadastrou nenhuma conta fixa." };
  }

  const categoria = await prisma.categoriaFinanceira.findFirst({
    where: { nome: "Outras despesas", tipo: "DESPESA" },
    select: { id: true },
  });

  const inicio = new Date(ano, mes - 1, 1, 12);
  const fim = new Date(ano, mes, 0, 12);

  let criados = 0;

  for (const custo of custos) {
    const dia = Math.min(custo.diaVencimento ?? 10, fim.getDate());
    const vencimento = new Date(ano, mes - 1, dia, 12);

    // Não duplica se já foi gerado pra este mês
    const jaExiste = await prisma.lancamento.findFirst({
      where: {
        descricao: custo.nome,
        tipo: "DESPESA",
        dataVencimento: { gte: inicio, lte: fim },
      },
      select: { id: true },
    });

    if (jaExiste) continue;

    await prisma.lancamento.create({
      data: {
        tipo: "DESPESA",
        categoriaId: categoria?.id ?? null,
        descricao: custo.nome,
        valor: custo.valor,
        dataVencimento: vencimento,
        status: "PENDENTE",
      },
    });

    criados++;
  }

  revalidarTudo();

  return {
    ok: true,
    erro:
      criados === 0
        ? "As contas deste mês já tinham sido geradas."
        : undefined,
  };
}

function revalidarTudo() {
  revalidatePath("/financeiro");
  revalidatePath("/");
}
