import Link from "next/link";
import { Plus, Receipt, Zap } from "lucide-react";

import { prisma } from "@/lib/db";
import { estaEmAberto } from "@/lib/pedidos";
import { formatarMoeda } from "@/lib/format";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ListaPedidos, type PedidoDaLista } from "./lista-pedidos";

export const dynamic = "force-dynamic";

export default async function PaginaVendas() {
  const [pedidos, temProduto] = await Promise.all([
    prisma.pedido.findMany({
      orderBy: [{ dataEntrega: "asc" }, { dataPedido: "desc" }],
      take: 200,
      include: {
        cliente: { select: { nome: true, telefone: true } },
        _count: { select: { itens: true } },
      },
    }),
    prisma.produto.count({ where: { ativo: true } }),
  ]);

  const lista: PedidoDaLista[] = pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    cliente: p.cliente?.nome ?? null,
    telefone: p.cliente?.telefone ?? null,
    dataPedido: p.dataPedido.toISOString(),
    dataEntrega: p.dataEntrega?.toISOString() ?? null,
    status: p.status,
    canal: p.canal,
    valorTotal: Number(p.valorTotal),
    sinalPago: Number(p.sinalPago),
    quantidadeItens: p._count.itens,
  }));

  const emAberto = lista.filter((p) => estaEmAberto(p.status));
  const aReceber = emAberto.reduce(
    (t, p) => t + (p.valorTotal - p.sinalPago),
    0,
  );

  if (temProduto === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <CabecalhoPagina
          titulo="Vendas e encomendas"
          descricao="Pedidos, clientes e a agenda de entregas."
        />
        <EstadoVazio
          icone={Receipt}
          titulo="Cadastre um produto primeiro"
          descricao="O pedido é montado com os produtos que você vende, e é deles que vem o preço."
          acao={
            <Button asChild>
              <Link href="/produtos/novo">Criar produto</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CabecalhoPagina
        titulo="Vendas e encomendas"
        descricao="Pedidos, clientes e a agenda de entregas."
        acao={
          <div className="flex gap-2">
            {/*
              Venda de balcão vem primeiro: é a mais comum dela — a pessoa vai
              lá, escolhe e leva. Encomenda é a exceção, não a regra.
            */}
            <Button asChild>
              <Link href="/vendas/agora">
                <Zap className="size-4" />
                Venda agora
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vendas/novo">
                <Plus className="size-4" />
                Encomenda
              </Link>
            </Button>
          </div>
        }
      />

      {pedidos.length === 0 ? (
        <EstadoVazio
          icone={Receipt}
          titulo="Nenhum pedido ainda"
          descricao="Registre as encomendas aqui pra não perder data de entrega nem esquecer quem já pagou."
          acao={
            <Button asChild>
              <Link href="/vendas/novo">
                <Plus className="size-4" />
                Registrar primeiro pedido
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-medium">
                  Pedidos em aberto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="num text-2xl font-semibold">{emAberto.length}</p>
              </CardContent>
            </Card>

            <Card className="border-gold-hairline">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-medium">
                  Falta receber
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="num text-2xl font-semibold">
                  {formatarMoeda(aReceber)}
                </p>
              </CardContent>
            </Card>
          </div>

          <ListaPedidos pedidos={lista} />
        </>
      )}
    </div>
  );
}
