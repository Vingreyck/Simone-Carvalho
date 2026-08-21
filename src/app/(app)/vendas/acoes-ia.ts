"use server";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { lerPedidoDaConversa } from "@/lib/ia/extracoes";
import { traduzirErro } from "@/lib/ia/cliente";
import { CONFIANCA_ALTA, casarInsumo } from "@/lib/correspondencia";
import { normalizarTexto } from "@/lib/format";

export type ItemLidoDoPedido = {
  /** Como a cliente pediu, na conversa */
  descricao: string;
  produtoId: string | null;
  produtoNome: string | null;
  confiante: boolean;
  quantidade: number;
  /** Preço combinado na conversa; null usa o de tabela */
  precoUnitario: number | null;
  observacao: string | null;
};

export type PedidoLido = {
  ok: boolean;
  erro?: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  telefone?: string | null;
  dataEntrega?: string | null;
  enderecoEntrega?: string | null;
  sinalPago?: number | null;
  observacao?: string | null;
  itens?: ItemLidoDoPedido[];
};

/**
 * Lê a conversa do WhatsApp e monta o pedido.
 *
 * Ela vive no WhatsApp: copiar a conversa e colar aqui é muito mais rápido que
 * reler tudo e transcrever pra um formulário. Como sempre, nada é gravado — o
 * resultado abre no formulário de pedido pra ela conferir.
 */
export async function lerPedidoDoWhatsApp(
  conversa: string,
): Promise<PedidoLido> {
  await exigirSessao();

  if (!conversa.trim()) {
    return { ok: false, erro: "Cole a conversa primeiro." };
  }

  try {
    const hoje = new Date().toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const extraido = await lerPedidoDaConversa(conversa, hoje);

    const [produtos, clientes] = await Promise.all([
      prisma.produto.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, precoVenda: true },
      }),
      prisma.cliente.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, telefone: true },
      }),
    ]);

    const itens: ItemLidoDoPedido[] = extraido.itens.map((item) => {
      const casado = casarInsumo(item.descricao, produtos);
      const produto = casado
        ? produtos.find((p) => p.id === casado.id)
        : undefined;

      return {
        descricao: item.descricao,
        produtoId: casado?.id ?? null,
        produtoNome: casado?.nome ?? null,
        confiante: (casado?.confianca ?? 0) >= CONFIANCA_ALTA,
        quantidade: item.quantidade,
        // Preço combinado na conversa vence o de tabela — pode ter tido desconto
        precoUnitario:
          item.precoUnitario ??
          (produto ? Number(produto.precoVenda) : null),
        observacao: item.observacao,
      };
    });

    // Cliente já cadastrada? Casa por telefone primeiro (é único), depois nome
    let clienteId: string | null = null;

    if (extraido.telefone) {
      const soDigitos = extraido.telefone.replace(/\D/g, "");
      clienteId =
        clientes.find(
          (c) => c.telefone && c.telefone.replace(/\D/g, "") === soDigitos,
        )?.id ?? null;
    }

    if (!clienteId && extraido.cliente) {
      const alvo = normalizarTexto(extraido.cliente);
      clienteId =
        clientes.find((c) => normalizarTexto(c.nome) === alvo)?.id ?? null;
    }

    return {
      ok: true,
      clienteId,
      clienteNome: extraido.cliente,
      telefone: extraido.telefone,
      dataEntrega: extraido.dataEntrega,
      enderecoEntrega: extraido.enderecoEntrega,
      sinalPago: extraido.sinalPago,
      observacao: extraido.observacao,
      itens,
    };
  } catch (erro) {
    return { ok: false, erro: traduzirErro(erro) };
  }
}
