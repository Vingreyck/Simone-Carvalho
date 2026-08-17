import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatarData, formatarMoeda } from "@/lib/format";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PaginaCompras() {
  const compras = await prisma.compra.findMany({
    orderBy: { data: "desc" },
    take: 100,
    include: {
      fornecedor: { select: { nome: true } },
      _count: { select: { itens: true } },
      lancamentos: { select: { status: true }, take: 1 },
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        titulo="Compras"
        descricao="Cada compra lançada atualiza o preço dos insumos e o custo das suas receitas."
        acao={
          <Button asChild>
            <Link href="/compras/nova">
              <Plus className="size-4" />
              Lançar compra
            </Link>
          </Button>
        }
      />

      {compras.length === 0 ? (
        <EstadoVazio
          icone={ShoppingCart}
          titulo="Nenhuma compra lançada ainda"
          descricao="Lance a primeira nota do mercado. É ela que dá preço aos insumos — sem isso, o custo das receitas fica zerado."
          acao={
            <Button asChild>
              <Link href="/compras/nova">
                <Plus className="size-4" />
                Lançar primeira compra
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {compras.map((compra) => {
            const pendente = compra.lancamentos[0]?.status === "PENDENTE";

            return (
              <Link key={compra.id} href={`/compras/${compra.id}`}>
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {compra.fornecedor?.nome ?? "Compra avulsa"}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          #{compra.numero}
                        </Badge>
                        {pendente ? (
                          <span className="bg-warning-soft text-warning border-warning/25 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                            a pagar
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatarData(compra.data)} · {compra._count.itens}{" "}
                        {compra._count.itens === 1 ? "item" : "itens"}
                      </p>
                    </div>

                    <span className="num shrink-0 font-semibold">
                      {formatarMoeda(compra.valorTotal)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
