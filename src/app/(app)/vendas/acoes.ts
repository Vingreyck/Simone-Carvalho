"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { lerDataLocal } from "@/lib/format";
import { carregarBaseDeCusto, custoDeProduto } from "@/server/custos";
import { calcularPrecoSugerido } from "@/lib/precificacao";
import type { StatusPedido } from "@/generated/prisma/enums";

export type Resultado = { ok: boolean; erro?: string; id?: string };

const esquemaItem = z.object({
  produtoId: z.string().min(1, "Escolha o produto."),
  quantidade: z.coerce.number().positive("A quantidade precisa ser maior que zero."),
  precoUnitario: z.coerce.number().min(0, "O preço não pode ser negativo."),
  observacao: z.string().trim().max(200).nullish(),
});

const esquemaPedido = z.object({
  id: z.string().nullish(),
  clienteId: z.string().nullish(),
  novoCliente: z.string().trim().max(80).nullish(),
  telefoneNovoCliente: z.string().trim().max(30).nullish(),
  dataEntrega: z.string().nullish(),
  status: z.enum([
    "ORCAMENTO",
    "CONFIRMADO",
    "EM_PRODUCAO",
    "PRONTO",
    "ENTREGUE",
    "CANCELADO",
  ]),
  canal: z.enum(["LOJA", "WHATSAPP", "INSTAGRAM", "INDICACAO", "OUTRO"]),
  desconto: z.coerce.number().min(0).default(0),
  taxaEntrega: z.coerce.number().min(0).default(0),
  sinalPago: z.coerce.number().min(0).default(0),
  formaPagamento: z.string().trim().max(40).nullish(),
  enderecoEntrega: z.string().trim().max(200).nullish(),
  observacao: z.string().trim().max(500).nullish(),
  itens: z.array(esquemaItem).min(1, "Adicione pelo menos um produto."),
});

/**
 * Cria ou edita um pedido.
 *
 * O detalhe que importa: o custo de cada item é **congelado** no momento da
 * venda. Se a farinha dobrar de preço mês que vem, o lucro do bolo vendido hoje
 * continua sendo o que foi de verdade.
 */
export async function salvarPedido(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  let bruto: unknown;
  try {
    bruto = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, erro: "Não consegui ler os dados do pedido." };
  }

  const dados = esquemaPedido.safeParse(bruto);
  if (!dados.success) {
    return {
      ok: false,
      erro: dados.error.issues[0]?.message ?? "Confira os dados do pedido.",
    };
  }

  const { id, itens, novoCliente, telefoneNovoCliente, dataEntrega, ...cabecalho } =
    dados.data;

  const subtotal = itens.reduce(
    (t, i) => t.plus(new Decimal(i.precoUnitario).times(i.quantidade)),
    new Decimal(0),
  );

  const valorTotal = subtotal
    .minus(new Decimal(cabecalho.desconto))
    .plus(new Decimal(cabecalho.taxaEntrega));

  if (valorTotal.lessThan(0)) {
    return { ok: false, erro: "O desconto é maior que o valor do pedido." };
  }

  if (new Decimal(cabecalho.sinalPago).greaterThan(valorTotal)) {
    return { ok: false, erro: "O sinal é maior que o total do pedido." };
  }

  // --------------------------- congela o custo de cada item vendido ---------
  const [base, config, produtos] = await Promise.all([
    carregarBaseDeCusto(),
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
    prisma.produto.findMany({
      where: { id: { in: itens.map((i) => i.produtoId) } },
      select: {
        id: true,
        receitaId: true,
        consumoDaReceita: true,
        custoEmbalagem: true,
        tempoExtraMin: true,
        margemAlvo: true,
      },
    }),
  ]);

  const cfg = {
    valorHoraMaoDeObra: config?.valorHoraMaoDeObra?.toString() ?? "0",
    percentualCustosFixos: config?.percentualCustosFixos?.toString() ?? "0",
    percentualImpostos: config?.percentualImpostos?.toString() ?? "0",
    percentualTaxaCartao: config?.percentualTaxaCartao?.toString() ?? "0",
    margemLucroPadrao: config?.margemLucroPadrao?.toString() ?? "30",
  };

  const custoPorProduto = new Map<string, Decimal>();

  for (const produto of produtos) {
    const custo = custoDeProduto(produto, base);
    const preco = calcularPrecoSugerido(
      {
        custoIngredientes: custo.custoIngredientes,
        custoEmbalagem: produto.custoEmbalagem.toString(),
        tempoPreparoMin: custo.tempoTotalMin,
        margemAlvo: produto.margemAlvo?.toString() ?? null,
      },
      cfg,
    );

    custoPorProduto.set(produto.id, preco.custoDireto);
  }

  const entrega = dataEntrega ? lerDataLocal(dataEntrega) : null;

  const pedidoId = await prisma.$transaction(async (tx) => {
    let clienteId = cabecalho.clienteId || null;

    if (!clienteId && novoCliente) {
      const criado = await tx.cliente.create({
        data: { nome: novoCliente, telefone: telefoneNovoCliente || null },
        select: { id: true },
      });
      clienteId = criado.id;
    }

    const dadosPedido = {
      ...cabecalho,
      clienteId,
      dataEntrega: entrega,
      subtotal: subtotal.toFixed(2),
      valorTotal: valorTotal.toFixed(2),
    };

    if (id) {
      await tx.pedido.update({ where: { id }, data: dadosPedido });
      await tx.pedidoItem.deleteMany({ where: { pedidoId: id } });
    }

    const pedido = id
      ? { id }
      : await tx.pedido.create({ data: dadosPedido, select: { id: true } });

    await tx.pedidoItem.createMany({
      data: itens.map((i) => ({
        pedidoId: pedido.id,
        produtoId: i.produtoId,
        quantidade: new Decimal(i.quantidade).toFixed(4),
        precoUnitario: new Decimal(i.precoUnitario).toFixed(2),
        custoUnitarioSnapshot: (
          custoPorProduto.get(i.produtoId) ?? new Decimal(0)
        ).toFixed(4),
        observacao: i.observacao || null,
      })),
    });

    return pedido.id;
  });

  await sincronizarFinanceiro(pedidoId);

  revalidarTudo(pedidoId);
  return { ok: true, id: pedidoId };
}

export async function mudarStatusPedido(
  id: string,
  status: StatusPedido,
): Promise<Resultado> {
  await exigirSessao();

  await prisma.pedido.update({ where: { id }, data: { status } });
  await sincronizarFinanceiro(id);

  revalidarTudo(id);
  return { ok: true };
}

export async function registrarSinal(
  id: string,
  valor: number,
): Promise<Resultado> {
  await exigirSessao();

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: { valorTotal: true },
  });

  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  if (!Number.isFinite(valor) || valor < 0) {
    return { ok: false, erro: "Valor inválido." };
  }

  if (new Decimal(valor).greaterThan(pedido.valorTotal.toString())) {
    return { ok: false, erro: "O valor recebido é maior que o total do pedido." };
  }

  await prisma.pedido.update({ where: { id }, data: { sinalPago: valor } });
  await sincronizarFinanceiro(id);

  revalidarTudo(id);
  return { ok: true };
}

export async function excluirPedido(id: string): Promise<Resultado> {
  await exigirSessao();

  await prisma.$transaction(async (tx) => {
    await tx.lancamento.deleteMany({ where: { pedidoId: id } });
    await tx.pedido.delete({ where: { id } });
  });

  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  revalidatePath("/");

  return { ok: true };
}

/**
 * Reflete o pedido no financeiro.
 *
 * Apaga e recria os lançamentos do pedido a cada mudança em vez de tentar
 * casar um a um. É idempotente e evita o pior cenário: dinheiro duplicado ou
 * sumido no caixa depois de ela editar o pedido três vezes.
 *
 * Orçamento e pedido cancelado não geram nada — só viram dinheiro quando ela
 * confirma.
 */
async function sincronizarFinanceiro(pedidoId: string): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { cliente: { select: { nome: true } } },
  });

  if (!pedido) return;

  await prisma.lancamento.deleteMany({ where: { pedidoId } });

  const naoGeraCaixa =
    pedido.status === "ORCAMENTO" || pedido.status === "CANCELADO";

  if (naoGeraCaixa) return;

  const categoria = await prisma.categoriaFinanceira.findFirst({
    where: { nome: "Encomendas", tipo: "RECEITA" },
    select: { id: true },
  });

  const total = new Decimal(pedido.valorTotal.toString());
  const sinal = new Decimal(pedido.sinalPago.toString());
  const falta = total.minus(sinal);

  const quem = pedido.cliente?.nome ?? "Venda avulsa";
  const vencimento = pedido.dataEntrega ?? pedido.dataPedido;

  // O sinal já entrou no caixa — vira lançamento pago
  if (sinal.greaterThan(0)) {
    await prisma.lancamento.create({
      data: {
        tipo: "RECEITA",
        categoriaId: categoria?.id ?? null,
        descricao: `Sinal do pedido #${pedido.numero} — ${quem}`,
        valor: sinal.toFixed(2),
        dataVencimento: pedido.dataPedido,
        dataPagamento: pedido.dataPedido,
        status: "PAGO",
        pedidoId,
      },
    });
  }

  if (falta.lessThanOrEqualTo(0)) return;

  // Entregue = ela já recebeu o restante
  const jaRecebeu = pedido.status === "ENTREGUE";

  await prisma.lancamento.create({
    data: {
      tipo: "RECEITA",
      categoriaId: categoria?.id ?? null,
      descricao: `Pedido #${pedido.numero} — ${quem}`,
      valor: falta.toFixed(2),
      dataVencimento: vencimento,
      dataPagamento: jaRecebeu ? new Date() : null,
      status: jaRecebeu ? "PAGO" : "PENDENTE",
      formaPagamento: pedido.formaPagamento,
      pedidoId,
    },
  });
}

// ---------------------------------------------------------------- clientes

const esquemaCliente = z.object({
  id: z.string().nullish(),
  nome: z.string().trim().min(2, "Informe o nome.").max(80),
  telefone: z.string().trim().max(30).nullish(),
  endereco: z.string().trim().max(200).nullish(),
  observacao: z.string().trim().max(300).nullish(),
});

export async function salvarCliente(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquemaCliente.safeParse(Object.fromEntries(formData.entries()));
  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { id, ...resto } = dados.data;

  if (id) {
    await prisma.cliente.update({ where: { id }, data: resto });
  } else {
    await prisma.cliente.create({ data: resto });
  }

  revalidatePath("/vendas");
  return { ok: true };
}

function revalidarTudo(pedidoId: string) {
  revalidatePath("/vendas");
  revalidatePath(`/vendas/${pedidoId}`);
  revalidatePath("/financeiro");
  revalidatePath("/");
}
