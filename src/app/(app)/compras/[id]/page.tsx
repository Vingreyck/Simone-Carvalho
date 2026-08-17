import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatarQuantidade, ROTULO_UNIDADE_BASE } from "@/lib/unidades";
import { formatarData, formatarMoeda, formatarMoedaPrecisa } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BotaoExcluirCompra } from "./botao-excluir";

export const dynamic = "force-dynamic";

export default async function PaginaCompra({ params }: PageProps<"/compras/[id]">) {
  const { id } = await params;

  const compra = await prisma.compra.findUnique({
    where: { id },
    include: {
      fornecedor: true,
      lancamentos: { select: { status: true, dataVencimento: true } },
      itens: {
        include: {
          insumo: { select: { id: true, nome: true, unidadeBase: true } },
          lote: { select: { quantidadeInicial: true, quantidadeRestante: true } },
        },
      },
    },
  });

  if (!compra) notFound();

  const lancamento = compra.lancamentos[0];
  const totalItens = compra.itens.reduce(
    (t, i) => t + Number(i.valorTotal),
    0,
  );

  // Se nada foi consumido, ainda dá pra apagar a compra sem mentir no histórico
  const podeExcluir = compra.itens.every(
    (i) =>
      !i.lote ||
      Number(i.lote.quantidadeRestante) === Number(i.lote.quantidadeInicial),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/compras">
            <ArrowLeft className="size-4" />
            Compras
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">
            {compra.fornecedor?.nome ?? "Compra avulsa"}
          </h2>
          <Badge variant="secondary">#{compra.numero}</Badge>
          {lancamento?.status === "PENDENTE" ? (
            <span className="bg-warning-soft text-warning border-warning/25 rounded-full border px-2 py-0.5 text-xs font-medium">
              a pagar
            </span>
          ) : (
            <span className="bg-success-soft text-success border-success/25 rounded-full border px-2 py-0.5 text-xs font-medium">
              pago
            </span>
          )}
        </div>

        <p className="text-muted-foreground mt-1 text-sm">
          {formatarData(compra.data)}
          {compra.notaFiscal ? ` · nota ${compra.notaFiscal}` : ""}
        </p>

        {compra.observacao ? (
          <p className="text-muted-foreground mt-2 text-sm italic">
            {compra.observacao}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {compra.itens.map((item) => {
              const unidade = ROTULO_UNIDADE_BASE[item.insumo.unidadeBase];

              return (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/insumos/${item.insumo.id}`}
                      className="hover:text-primary min-w-0 font-medium"
                    >
                      {item.insumo.nome}
                    </Link>
                    <span className="num shrink-0 font-medium">
                      {formatarMoeda(item.valorTotal)}
                    </span>
                  </div>

                  {/* Como ela digitou → o que o sistema entendeu */}
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="num">
                      {Number(item.quantidadeEmbalagens)} ×{" "}
                      {Number(item.tamanhoEmbalagem)} {item.unidadeEmbalagem}
                    </span>
                    <ArrowRight className="size-3" />
                    <span className="num">
                      {formatarQuantidade(
                        item.quantidadeBase,
                        item.insumo.unidadeBase,
                      )}
                    </span>
                    <span>·</span>
                    <span className="num">
                      {formatarMoedaPrecisa(item.custoUnitarioBase)} por {unidade}
                    </span>
                    {item.validade ? (
                      <>
                        <span>·</span>
                        <span>vence {formatarData(item.validade)}</span>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 space-y-1.5 border-t pt-4 text-sm">
            <div className="text-muted-foreground flex justify-between">
              <span>Itens</span>
              <span className="num">{formatarMoeda(totalItens)}</span>
            </div>
            {Number(compra.valorFrete) > 0 ? (
              <div className="text-muted-foreground flex justify-between">
                <span>Frete (rateado entre os itens)</span>
                <span className="num">{formatarMoeda(compra.valorFrete)}</span>
              </div>
            ) : null}
            <div className="flex justify-between pt-1 text-base font-semibold">
              <span>Total</span>
              <span className="num">{formatarMoeda(compra.valorTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <BotaoExcluirCompra id={compra.id} podeExcluir={podeExcluir} />
    </div>
  );
}
