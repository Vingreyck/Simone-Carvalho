import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChefHat, Pencil, TriangleAlert, Utensils } from "lucide-react";

import { prisma } from "@/lib/db";
import { carregarBaseDeCusto, custoSeguro } from "@/server/custos";
import { formatarMinutos, formatarMoeda, formatarMoedaPrecisa } from "@/lib/format";
import { formatarQuantidade } from "@/lib/unidades";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BotoesReceita } from "./botoes-receita";

export const dynamic = "force-dynamic";

export default async function PaginaReceita({ params }: PageProps<"/receitas/[id]">) {
  const { id } = await params;

  const [receita, base] = await Promise.all([
    prisma.receita.findUnique({
      where: { id },
      include: {
        itens: {
          orderBy: { ordem: "asc" },
          include: {
            insumo: { select: { id: true, nome: true, unidadeBase: true } },
            subReceita: { select: { id: true, nome: true, rendimentoUnidade: true } },
          },
        },
        usadaEm: {
          select: { receita: { select: { id: true, nome: true } } },
        },
        produtos: { select: { id: true, nome: true } },
      },
    }),
    carregarBaseDeCusto(),
  ]);

  if (!receita) notFound();

  const custo = custoSeguro(id, base);

  // Casa cada item da ficha com a linha de custo correspondente
  const custoPorChave = new Map(
    custo.linhas.map((l) => [`${l.tipo}:${l.id}`, l]),
  );

  const usadaEm = [
    ...new Map(receita.usadaEm.map((u) => [u.receita.id, u.receita])).values(),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/receitas">
            <ArrowLeft className="size-4" />
            Fichas técnicas
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{receita.nome}</h2>
              {!receita.ativo ? <Badge variant="secondary">Arquivada</Badge> : null}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Rende {Number(receita.rendimentoQuantidade)}{" "}
              {receita.rendimentoUnidade}
              {receita.tempoPreparoMin > 0
                ? ` · ${formatarMinutos(receita.tempoPreparoMin)} de preparo`
                : ""}
              {receita.categoria ? ` · ${receita.categoria}` : ""}
            </p>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/receitas/${id}/editar`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {custo.erro ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{custo.erro}</AlertDescription>
        </Alert>
      ) : null}

      {/* ---------------------------------------------------------- custo */}
      <Card className="border-gold-hairline from-accent/40 to-card bg-gradient-to-br">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs">
                Custo dos ingredientes da receita inteira
              </p>
              <p className="num text-primary text-3xl font-semibold">
                {formatarMoeda(custo.custoTotal)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-muted-foreground text-xs">
                Cada {singular(receita.rendimentoUnidade)} sai por
              </p>
              <p className="num text-xl font-semibold">
                {formatarMoedaPrecisa(custo.custoPorUnidade, 2)}
              </p>
            </div>
          </div>

          {custo.insumosSemPreco.length > 0 ? (
            <Alert className="border-warning/30 bg-warning-soft/40 mt-4">
              <TriangleAlert className="text-warning size-4" />
              <AlertDescription className="text-xs">
                Custo incompleto:{" "}
                <strong>{custo.insumosSemPreco.join(", ")}</strong> ainda sem
                preço. Lance uma compra desses insumos.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------ ingredientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que vai nela</CardTitle>
          <p className="text-muted-foreground text-sm">
            Ordenado do que mais pesa no custo pro que menos pesa.
          </p>
        </CardHeader>

        <CardContent>
          <ul className="divide-y">
            {[...receita.itens]
              .sort((a, b) => {
                const ca = custoPorChave.get(chaveDoItem(a))?.custo.toNumber() ?? 0;
                const cb = custoPorChave.get(chaveDoItem(b))?.custo.toNumber() ?? 0;
                return cb - ca;
              })
              .map((item) => {
                const linha = custoPorChave.get(chaveDoItem(item));
                const ehSub = Boolean(item.subReceitaId);
                const nome = ehSub ? item.subReceita?.nome : item.insumo?.nome;
                const participacao = linha?.participacao.toNumber() ?? 0;

                return (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {ehSub ? (
                            <ChefHat className="text-primary size-3.5 shrink-0" />
                          ) : (
                            <Utensils className="text-muted-foreground size-3.5 shrink-0" />
                          )}
                          <Link
                            href={
                              ehSub
                                ? `/receitas/${item.subReceitaId}`
                                : `/insumos/${item.insumoId}`
                            }
                            className="hover:text-primary truncate text-sm font-medium"
                          >
                            {nome}
                          </Link>
                        </div>

                        <p className="text-muted-foreground num mt-0.5 text-xs">
                          {Number(item.quantidade)} {item.unidade}
                          {!ehSub && item.insumo
                            ? ` (${formatarQuantidade(item.quantidadeBase, item.insumo.unidadeBase)})`
                            : ""}
                          {item.observacao ? ` · ${item.observacao}` : ""}
                        </p>

                        {/* Barra de participação: mostra visualmente o que domina o custo */}
                        {participacao > 0 ? (
                          <div className="bg-muted mt-1.5 h-1 w-full max-w-48 overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{ width: `${Math.min(participacao, 100)}%` }}
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="num text-sm font-medium">
                          {formatarMoeda(linha?.custo ?? 0)}
                        </p>
                        {participacao > 0 ? (
                          <p className="text-muted-foreground num text-xs">
                            {participacao.toFixed(0)}% do custo
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </CardContent>
      </Card>

      {/* --------------------------------------------------------- preparo */}
      {receita.modoPreparo ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modo de preparo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{receita.modoPreparo}</p>
          </CardContent>
        </Card>
      ) : null}

      {receita.observacao ? (
        <Card className="bg-accent/30">
          <CardContent className="py-4">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Observações
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{receita.observacao}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------------------------------------- onde usa */}
      {usadaEm.length > 0 || receita.produtos.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onde esta receita aparece</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {usadaEm.map((r) => (
              <Button key={r.id} variant="outline" size="sm" asChild>
                <Link href={`/receitas/${r.id}`}>
                  <ChefHat className="size-3.5" />
                  {r.nome}
                </Link>
              </Button>
            ))}
            {receita.produtos.map((p) => (
              <Button key={p.id} variant="outline" size="sm" asChild>
                <Link href={`/produtos/${p.id}`}>{p.nome}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <BotoesReceita
        id={receita.id}
        ativo={receita.ativo}
        temDependentes={usadaEm.length > 0 || receita.produtos.length > 0}
      />
    </div>
  );
}

function chaveDoItem(item: { insumoId: string | null; subReceitaId: string | null }) {
  return item.subReceitaId
    ? `sub-receita:${item.subReceitaId}`
    : `insumo:${item.insumoId}`;
}

function singular(unidade: string): string {
  const limpo = unidade.trim().toLowerCase();
  return limpo.endsWith("s") ? limpo.slice(0, -1) : limpo;
}
