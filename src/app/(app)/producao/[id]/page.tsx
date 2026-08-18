import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChefHat } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatarData, formatarMoeda, formatarMoedaPrecisa } from "@/lib/format";
import { formatarQuantidade } from "@/lib/unidades";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BotaoDesfazerProducao } from "./botao-desfazer";

export const dynamic = "force-dynamic";

export default async function PaginaProducaoDetalhe({
  params,
}: PageProps<"/producao/[id]">) {
  const { id } = await params;

  const producao = await prisma.producao.findUnique({
    where: { id },
    include: {
      receita: { select: { id: true, nome: true, rendimentoUnidade: true } },
      movimentos: {
        include: {
          insumo: { select: { id: true, nome: true, unidadeBase: true } },
          lote: { select: { validade: true } },
        },
      },
    },
  });

  if (!producao) notFound();

  // Vários lotes do mesmo insumo viram uma linha só na tela
  const porInsumo = new Map<
    string,
    { nome: string; unidadeBase: string; quantidade: number; custo: number }
  >();

  for (const m of producao.movimentos) {
    const atual = porInsumo.get(m.insumoId) ?? {
      nome: m.insumo.nome,
      unidadeBase: m.insumo.unidadeBase,
      quantidade: 0,
      custo: 0,
    };

    atual.quantidade += Math.abs(Number(m.quantidade));
    atual.custo += Math.abs(Number(m.quantidade)) * Number(m.custoUnitario);
    porInsumo.set(m.insumoId, atual);
  }

  const linhas = [...porInsumo.entries()].sort((a, b) => b[1].custo - a[1].custo);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/producao">
            <ArrowLeft className="size-4" />
            Produção
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{producao.receita.nome}</h2>
          <Badge variant="secondary">#{producao.numero}</Badge>
        </div>

        <p className="text-muted-foreground mt-1 text-sm">
          {formatarData(producao.data)} · {Number(producao.quantidade)}{" "}
          {Number(producao.quantidade) === 1 ? "receita" : "receitas"} ·{" "}
          <Link
            href={`/receitas/${producao.receita.id}`}
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            <ChefHat className="size-3.5" />
            ver ficha
          </Link>
        </p>

        {producao.observacao ? (
          <p className="text-muted-foreground mt-2 text-sm italic">
            {producao.observacao}
          </p>
        ) : null}
      </div>

      <Card className="border-gold-hairline from-accent/40 to-card bg-gradient-to-br">
        <CardContent className="py-5 text-center">
          <p className="text-muted-foreground text-xs">
            Custo real desta fornada
          </p>
          <p className="num text-primary text-3xl font-semibold">
            {formatarMoeda(producao.custoTotal)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Calculado pelos lotes que realmente saíram, não pela média.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que saiu do estoque</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {linhas.map(([insumoId, l]) => (
              <li
                key={insumoId}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <Link
                  href={`/insumos/${insumoId}`}
                  className="hover:text-primary min-w-0 truncate text-sm font-medium"
                >
                  {l.nome}
                </Link>

                <div className="shrink-0 text-right">
                  <p className="num text-sm">
                    {formatarQuantidade(
                      l.quantidade,
                      l.unidadeBase as "G" | "ML" | "UN",
                    )}
                  </p>
                  <p className="text-muted-foreground num text-xs">
                    {formatarMoedaPrecisa(l.custo, 2)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <BotaoDesfazerProducao id={producao.id} />
    </div>
  );
}
