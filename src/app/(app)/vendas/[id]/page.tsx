import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Pencil, Phone } from "lucide-react";

import { prisma } from "@/lib/db";
import { CLASSE_STATUS, ROTULO_CANAL, ROTULO_STATUS } from "@/lib/pedidos";
import { formatarData, formatarDataRelativa, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AcoesPedido } from "./acoes-pedido";

export const dynamic = "force-dynamic";

export default async function PaginaPedido({ params }: PageProps<"/vendas/[id]">) {
  const { id } = await params;

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: {
      cliente: true,
      itens: { include: { produto: { select: { id: true, nome: true } } } },
      lancamentos: { select: { status: true, valor: true, descricao: true } },
    },
  });

  if (!pedido) notFound();

  const total = Number(pedido.valorTotal);
  const sinal = Number(pedido.sinalPago);
  const falta = total - sinal;

  /**
   * Lucro real da venda: usa o custo CONGELADO no momento do pedido, não o
   * custo de hoje. Se a farinha subiu depois, o lucro daquela venda não muda.
   */
  const custoTotal = pedido.itens.reduce(
    (t, i) => t + Number(i.custoUnitarioSnapshot) * Number(i.quantidade),
    0,
  );

  const lucro = total - Number(pedido.taxaEntrega) - custoTotal;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/vendas">
            <ArrowLeft className="size-4" />
            Vendas
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">
                {pedido.cliente?.nome ?? "Venda avulsa"}
              </h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  CLASSE_STATUS[pedido.status],
                )}
              >
                {ROTULO_STATUS[pedido.status]}
              </span>
            </div>

            <p className="text-muted-foreground mt-1 text-sm">
              Pedido #{pedido.numero} · {ROTULO_CANAL[pedido.canal]} · feito em{" "}
              {formatarData(pedido.dataPedido)}
            </p>

            {pedido.dataEntrega ? (
              <p className="mt-1 text-sm font-medium">
                Entrega {formatarDataRelativa(pedido.dataEntrega)} (
                {formatarData(pedido.dataEntrega)})
              </p>
            ) : null}

            <div className="text-muted-foreground mt-2 space-y-0.5 text-sm">
              {pedido.cliente?.telefone ? (
                <p className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {pedido.cliente.telefone}
                </p>
              ) : null}
              {pedido.enderecoEntrega ? (
                <p className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {pedido.enderecoEntrega}
                </p>
              ) : null}
            </div>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/vendas/${id}/editar`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
        </div>

        {pedido.observacao ? (
          <div className="bg-accent/40 mt-3 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Observação
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">
              {pedido.observacao}
            </p>
          </div>
        ) : null}
      </div>

      <AcoesPedido
        id={pedido.id}
        status={pedido.status}
        valorTotal={total}
        sinalPago={sinal}
      />

      {/* ------------------------------------------------------------ itens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">O pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {pedido.itens.map((item) => (
              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/produtos/${item.produto.id}`}
                      className="hover:text-primary text-sm font-medium"
                    >
                      {Number(item.quantidade)}× {item.produto.nome}
                    </Link>
                    {item.observacao ? (
                      <p className="text-muted-foreground text-xs">
                        {item.observacao}
                      </p>
                    ) : null}
                  </div>

                  <span className="num shrink-0 text-sm font-medium">
                    {formatarMoeda(
                      Number(item.precoUnitario) * Number(item.quantidade),
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <ul className="mt-4 space-y-1.5 border-t pt-4 text-sm">
            <li className="text-muted-foreground flex justify-between">
              <span>Produtos</span>
              <span className="num">{formatarMoeda(pedido.subtotal)}</span>
            </li>
            {Number(pedido.desconto) > 0 ? (
              <li className="text-muted-foreground flex justify-between">
                <span>Desconto</span>
                <span className="num">− {formatarMoeda(pedido.desconto)}</span>
              </li>
            ) : null}
            {Number(pedido.taxaEntrega) > 0 ? (
              <li className="text-muted-foreground flex justify-between">
                <span>Entrega</span>
                <span className="num">+ {formatarMoeda(pedido.taxaEntrega)}</span>
              </li>
            ) : null}

            <li className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="num">{formatarMoeda(total)}</span>
            </li>

            {sinal > 0 ? (
              <>
                <li className="text-success flex justify-between">
                  <span>Já recebeu</span>
                  <span className="num">{formatarMoeda(sinal)}</span>
                </li>
                {falta > 0 ? (
                  <li className="text-primary flex justify-between font-medium">
                    <span>Falta receber</span>
                    <span className="num">{formatarMoeda(falta)}</span>
                  </li>
                ) : null}
              </>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- lucro */}
      {custoTotal > 0 ? (
        <Card className="border-gold-hairline">
          <CardHeader>
            <CardTitle className="text-base">Quanto sobrou nesta venda</CardTitle>
            <p className="text-muted-foreground text-sm">
              Pelo custo do dia em que você fechou o pedido.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              <li className="text-muted-foreground flex justify-between">
                <span>Você recebe pelos produtos</span>
                <span className="num">
                  {formatarMoeda(total - Number(pedido.taxaEntrega))}
                </span>
              </li>
              <li className="text-muted-foreground flex justify-between">
                <span>Custo de fazer</span>
                <span className="num">− {formatarMoeda(custoTotal)}</span>
              </li>
              <li className="flex justify-between border-t pt-2 font-semibold">
                <span>Sobrou</span>
                <span
                  className={cn(
                    "num text-lg",
                    lucro < 0 ? "text-danger" : "text-success",
                  )}
                >
                  {formatarMoeda(lucro)}
                </span>
              </li>
            </ul>

            <p className="text-muted-foreground mt-3 text-xs">
              Não desconta taxa de cartão nem custos fixos — esses aparecem na
              tela de cada produto.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
