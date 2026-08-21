import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { carregarOpcoesDoPedido } from "@/server/opcoes-pedido";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { EditorPedido } from "../../editor-pedido";

export const dynamic = "force-dynamic";

export default async function PaginaEditarPedido({
  params,
}: PageProps<"/vendas/[id]/editar">) {
  const { id } = await params;

  const [pedido, opcoes] = await Promise.all([
    prisma.pedido.findUnique({ where: { id }, include: { itens: true } }),
    carregarOpcoesDoPedido(),
  ]);

  if (!pedido) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href={`/vendas/${id}`}>
          <ArrowLeft className="size-4" />
          Pedido #{pedido.numero}
        </Link>
      </Button>

      <CabecalhoPagina titulo={`Editar pedido #${pedido.numero}`} />

      <EditorPedido
        produtos={opcoes.produtos}
        clientes={opcoes.clientes}
        pedido={{
          id: pedido.id,
          clienteId: pedido.clienteId,
          dataEntrega: pedido.dataEntrega?.toISOString() ?? null,
          status: pedido.status,
          canal: pedido.canal,
          desconto: Number(pedido.desconto),
          taxaEntrega: Number(pedido.taxaEntrega),
          sinalPago: Number(pedido.sinalPago),
          formaPagamento: pedido.formaPagamento,
          enderecoEntrega: pedido.enderecoEntrega,
          observacao: pedido.observacao,
          itens: pedido.itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: Number(i.quantidade),
            precoUnitario: Number(i.precoUnitario),
            observacao: i.observacao,
          })),
        }}
      />
    </div>
  );
}
