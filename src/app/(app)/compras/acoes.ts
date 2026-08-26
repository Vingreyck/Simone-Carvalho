"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { converterParaBase, UnidadeDesconhecidaError } from "@/lib/unidades";
import { calcularCustoMedio, calcularEntradaDeCompra } from "@/lib/estoque";
import { lerDataLocal } from "@/lib/format";
import { montarAvisoDeAlta, type AvisoDeAlta } from "@/server/impacto";

export type Resultado = {
  ok: boolean;
  erro?: string;
  id?: string;
  /**
   * Preenchido quando a compra encareceu algum produto. É a razão de o sistema
   * existir: ela nunca teria como perceber isso sozinha.
   */
  aviso?: AvisoDeAlta | null;
};

const esquemaItem = z.object({
  insumoId: z.string().min(1, "Escolha o insumo."),
  quantidadeEmbalagens: z.coerce
    .number()
    .positive("Quantas embalagens você comprou?"),
  tamanhoEmbalagem: z.coerce
    .number()
    .positive("Quanto vem em cada embalagem?"),
  unidadeEmbalagem: z.string().trim().min(1, "Qual a unidade da embalagem?"),
  valorTotal: z.coerce.number().min(0, "O valor não pode ser negativo."),
  validade: z.string().nullish(),
});

const esquemaCompra = z.object({
  fornecedorId: z.string().nullish(),
  novoFornecedor: z.string().trim().max(80).nullish(),
  data: z.string().min(1, "Informe a data da compra."),
  notaFiscal: z.string().trim().max(60).nullish(),
  valorFrete: z.coerce.number().min(0).default(0),
  observacao: z.string().trim().max(500).nullish(),
  jaPago: z.boolean().default(false),
  itens: z.array(esquemaItem).min(1, "Adicione pelo menos um item."),
});

/**
 * Lança uma compra.
 *
 * É a ação mais importante do sistema: é aqui que "2 sacos de 5 kg por R$ 56"
 * vira 10.000 g a R$ 0,0056/g e todos os custos de receita se atualizam.
 *
 * Tudo numa transação só — se qualquer item falhar, nada entra. Estoque pela
 * metade seria pior que compra nenhuma.
 */
export async function lancarCompra(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  let bruto: unknown;
  try {
    bruto = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, erro: "Não consegui ler os dados do formulário." };
  }

  const dados = esquemaCompra.safeParse(bruto);
  if (!dados.success) {
    const problema = dados.error.issues[0];
    return {
      ok: false,
      erro: problema?.message ?? "Confira os dados da compra.",
    };
  }

  const { itens, valorFrete, jaPago, novoFornecedor, ...cabecalho } = dados.data;

  // Carrega os insumos com as equivalências — precisa delas pra converter "lata" em gramas
  const insumos = await prisma.insumo.findMany({
    where: { id: { in: itens.map((i) => i.insumoId) } },
    include: { equivalencias: true },
  });

  const porId = new Map(insumos.map((i) => [i.id, i]));

  const faltando = itens.find((i) => !porId.has(i.insumoId));
  if (faltando) {
    return { ok: false, erro: "Um dos insumos escolhidos não existe mais." };
  }

  // ---- converte tudo ANTES de abrir a transação, pra falhar cedo e barato ----
  const valorItens = itens.reduce((t, i) => t.plus(i.valorTotal), new Decimal(0));
  const frete = new Decimal(valorFrete);

  type ItemPreparado = {
    insumoId: string;
    quantidadeEmbalagens: Decimal;
    tamanhoEmbalagem: Decimal;
    unidadeEmbalagem: string;
    quantidadeBase: Decimal;
    valorTotal: Decimal;
    custoUnitarioBase: Decimal;
    validade: Date | null;
  };

  const preparados: ItemPreparado[] = [];

  for (const item of itens) {
    const insumo = porId.get(item.insumoId)!;

    let tamanhoEmBase: Decimal;
    try {
      tamanhoEmBase = converterParaBase(
        item.tamanhoEmbalagem,
        item.unidadeEmbalagem,
        insumo.unidadeBase,
        insumo.equivalencias.map((e) => ({
          nome: e.nome,
          quantidadeBase: e.quantidadeBase.toString(),
        })),
      );
    } catch (erro) {
      if (erro instanceof UnidadeDesconhecidaError) {
        return {
          ok: false,
          erro: `${insumo.nome}: ${erro.message}`,
        };
      }
      throw erro;
    }

    // Frete rateado pelo peso financeiro do item — quem custou mais carrega mais frete
    const freteDoItem = valorItens.greaterThan(0)
      ? frete.times(new Decimal(item.valorTotal)).dividedBy(valorItens)
      : frete.dividedBy(itens.length);

    let entrada;
    try {
      entrada = calcularEntradaDeCompra({
        quantidadeEmbalagens: item.quantidadeEmbalagens,
        tamanhoEmbalagemBase: tamanhoEmBase,
        valorTotal: item.valorTotal,
        freteRateado: freteDoItem,
      });
    } catch (erro) {
      return {
        ok: false,
        erro: `${insumo.nome}: ${(erro as Error).message}`,
      };
    }

    preparados.push({
      insumoId: item.insumoId,
      quantidadeEmbalagens: new Decimal(item.quantidadeEmbalagens),
      tamanhoEmbalagem: new Decimal(item.tamanhoEmbalagem),
      unidadeEmbalagem: item.unidadeEmbalagem,
      quantidadeBase: entrada.quantidadeBase,
      valorTotal: new Decimal(item.valorTotal),
      custoUnitarioBase: entrada.custoUnitarioBase,
      validade: item.validade ? lerDataLocal(item.validade) : null,
    });
  }

  const valorTotalCompra = valorItens.plus(frete);
  const dataCompra = lerDataLocal(cabecalho.data);

  /**
   * O custo médio de cada insumo ANTES desta compra.
   *
   * É o que permite responder, logo depois de salvar, "o chocolate subiu e
   * estes produtos ficaram no prejuízo". Comparo o custo MÉDIO, não o preço da
   * embalagem: se ela tinha 10 kg de farinha barata e comprou 1 kg cara, o
   * custo dos doces mal se mexe — e o aviso precisa dizer a verdade, senão vira
   * alarme falso.
   */
  const custoMedioAntes = new Map<string, Decimal>(
    preparados.map((item) => [
      item.insumoId,
      new Decimal(porId.get(item.insumoId)!.custoMedio.toString()),
    ]),
  );
  const custoMedioDepois = new Map<string, Decimal>();

  // -------------------------------- grava tudo de uma vez ou nada --------------
  const compraId = await prisma.$transaction(async (tx) => {
    let fornecedorId = cabecalho.fornecedorId || null;

    if (!fornecedorId && novoFornecedor) {
      const criado = await tx.fornecedor.upsert({
        where: { nome: novoFornecedor },
        update: {},
        create: { nome: novoFornecedor },
        select: { id: true },
      });
      fornecedorId = criado.id;
    }

    const compra = await tx.compra.create({
      data: {
        fornecedorId,
        data: dataCompra,
        valorTotal: valorTotalCompra.toFixed(2),
        valorFrete: frete.toFixed(2),
        notaFiscal: cabecalho.notaFiscal || null,
        observacao: cabecalho.observacao || null,
      },
      select: { id: true, numero: true },
    });

    for (const item of preparados) {
      const insumo = porId.get(item.insumoId)!;

      const compraItem = await tx.compraItem.create({
        data: {
          compraId: compra.id,
          insumoId: item.insumoId,
          quantidadeEmbalagens: item.quantidadeEmbalagens.toFixed(4),
          tamanhoEmbalagem: item.tamanhoEmbalagem.toFixed(4),
          unidadeEmbalagem: item.unidadeEmbalagem,
          quantidadeBase: item.quantidadeBase.toFixed(4),
          valorTotal: item.valorTotal.toFixed(2),
          custoUnitarioBase: item.custoUnitarioBase.toFixed(6),
          validade: item.validade,
        },
        select: { id: true },
      });

      const lote = await tx.insumoLote.create({
        data: {
          insumoId: item.insumoId,
          compraId: compra.id,
          compraItemId: compraItem.id,
          quantidadeInicial: item.quantidadeBase.toFixed(4),
          quantidadeRestante: item.quantidadeBase.toFixed(4),
          custoUnitario: item.custoUnitarioBase.toFixed(6),
          validade: item.validade,
          dataEntrada: dataCompra,
        },
        select: { id: true },
      });

      // Recalcula o custo médio a partir de TODOS os lotes com saldo
      const lotes = await tx.insumoLote.findMany({
        where: { insumoId: item.insumoId, quantidadeRestante: { gt: 0 } },
        select: {
          id: true,
          quantidadeRestante: true,
          custoUnitario: true,
          validade: true,
          dataEntrada: true,
        },
      });

      const saldo = lotes.reduce(
        (t, l) => t.plus(new Decimal(l.quantidadeRestante.toString())),
        new Decimal(0),
      );

      const custoMedio = calcularCustoMedio(
        lotes.map((l) => ({
          id: l.id,
          quantidadeRestante: l.quantidadeRestante.toString(),
          custoUnitario: l.custoUnitario.toString(),
          validade: l.validade,
          dataEntrada: l.dataEntrada,
        })),
        insumo.custoMedio.toString(),
      );

      custoMedioDepois.set(item.insumoId, custoMedio);

      await tx.movimentoEstoque.create({
        data: {
          insumoId: item.insumoId,
          loteId: lote.id,
          tipo: "ENTRADA_COMPRA",
          quantidade: item.quantidadeBase.toFixed(4),
          custoUnitario: item.custoUnitarioBase.toFixed(6),
          saldoApos: saldo.toFixed(4),
          motivo: `Compra #${compra.numero}`,
          data: dataCompra,
        },
      });

      // Só registra no histórico se o preço realmente mudou — evita poluir
      // a lista com dezenas de linhas iguais.
      const precoAnterior = insumo.custoUltimaCompra
        ? new Decimal(insumo.custoUltimaCompra.toString())
        : null;

      if (
        !precoAnterior ||
        !precoAnterior.equals(item.custoUnitarioBase.toDecimalPlaces(6))
      ) {
        await tx.historicoPrecoInsumo.create({
          data: {
            insumoId: item.insumoId,
            custoUnitario: item.custoUnitarioBase.toFixed(6),
            origem: "compra",
            compraId: compra.id,
            registradoEm: dataCompra,
          },
        });
      }

      await tx.insumo.update({
        where: { id: item.insumoId },
        data: {
          custoMedio: custoMedio.toFixed(6),
          custoUltimaCompra: item.custoUnitarioBase.toFixed(6),
          dataUltimaCompra: dataCompra,
        },
      });
    }

    // Conta a pagar no financeiro — a compra vira despesa automaticamente
    const categoria = await tx.categoriaFinanceira.findFirst({
      where: { nome: "Compra de insumos", tipo: "DESPESA" },
      select: { id: true },
    });

    await tx.lancamento.create({
      data: {
        tipo: "DESPESA",
        categoriaId: categoria?.id ?? null,
        descricao: `Compra #${compra.numero}`,
        valor: valorTotalCompra.toFixed(2),
        dataVencimento: dataCompra,
        dataPagamento: jaPago ? dataCompra : null,
        status: jaPago ? "PAGO" : "PENDENTE",
        compraId: compra.id,
      },
    });

    return compra.id;
  });

  revalidatePath("/compras");
  revalidatePath("/insumos");
  revalidatePath("/estoque");
  revalidatePath("/financeiro");
  revalidatePath("/produtos");
  revalidatePath("/");

  // Fora da transação de propósito: se a conta do impacto falhar por qualquer
  // motivo, a compra já está gravada. Perder o aviso é ruim; perder a compra
  // que ela acabou de digitar seria bem pior.
  let aviso: AvisoDeAlta | null = null;
  try {
    aviso = await montarAvisoDeAlta(custoMedioAntes, custoMedioDepois);
  } catch {
    aviso = null;
  }

  return { ok: true, id: compraId, aviso };
}

/**
 * Apaga uma compra e desfaz o que ela causou.
 *
 * Só é permitido se NADA daquele lote foi consumido ainda — desfazer uma entrada
 * já usada em produção deixaria o histórico de custo mentindo.
 */
export async function excluirCompra(id: string): Promise<Resultado> {
  await exigirSessao();

  const compra = await prisma.compra.findUnique({
    where: { id },
    include: {
      lotes: {
        select: {
          id: true,
          insumoId: true,
          quantidadeInicial: true,
          quantidadeRestante: true,
        },
      },
    },
  });

  if (!compra) return { ok: false, erro: "Compra não encontrada." };

  const jaConsumido = compra.lotes.find(
    (l) => !l.quantidadeRestante.equals(l.quantidadeInicial),
  );

  if (jaConsumido) {
    return {
      ok: false,
      erro:
        "Esta compra já teve insumo usado em produção, então não dá pra apagar. " +
        "Se algo veio errado, registre uma perda ou um ajuste de estoque.",
    };
  }

  const insumosAfetados = [...new Set(compra.lotes.map((l) => l.insumoId))];

  await prisma.$transaction(async (tx) => {
    await tx.movimentoEstoque.deleteMany({
      where: { loteId: { in: compra.lotes.map((l) => l.id) } },
    });
    await tx.historicoPrecoInsumo.deleteMany({ where: { compraId: id } });
    await tx.lancamento.deleteMany({ where: { compraId: id } });
    await tx.insumoLote.deleteMany({ where: { compraId: id } });
    await tx.compra.delete({ where: { id } });

    // Recalcula o custo médio dos insumos que perderam lote
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

      const ultimo = await tx.historicoPrecoInsumo.findFirst({
        where: { insumoId },
        orderBy: { registradoEm: "desc" },
        select: { custoUnitario: true, registradoEm: true },
      });

      await tx.insumo.update({
        where: { id: insumoId },
        data: {
          custoMedio: custoMedio.toFixed(6),
          custoUltimaCompra: ultimo?.custoUnitario ?? null,
          dataUltimaCompra: ultimo?.registradoEm ?? null,
        },
      });
    }
  });

  revalidatePath("/compras");
  revalidatePath("/insumos");
  revalidatePath("/estoque");
  revalidatePath("/financeiro");

  return { ok: true };
}
