import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackageOpen } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatarQuantidade, ROTULO_UNIDADE_BASE } from "@/lib/unidades";
import {
  formatarData,
  formatarDataRelativa,
  formatarMoedaPrecisa,
} from "@/lib/format";
import { ROTULO_CATEGORIA } from "@/lib/constantes";
import { situacaoEstoque, situacaoValidade, variacaoPercentual } from "@/lib/estoque";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeloEstoque, SeloValidade, SeloVariacao } from "@/components/selo-situacao";

import { PainelEquivalencias } from "./painel-equivalencias";

export const dynamic = "force-dynamic";

export default async function PaginaInsumo({ params }: PageProps<"/insumos/[id]">) {
  const { id } = await params;

  const [insumo, config] = await Promise.all([
    prisma.insumo.findUnique({
      where: { id },
      include: {
        equivalencias: { orderBy: { nome: "asc" } },
        lotes: {
          where: { quantidadeRestante: { gt: 0 } },
          orderBy: [{ validade: { sort: "asc", nulls: "last" } }, { dataEntrada: "asc" }],
          include: { compra: { select: { numero: true } } },
        },
        historicoPrecos: { orderBy: { registradoEm: "desc" }, take: 10 },
      },
    }),
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
  ]);

  if (!insumo) notFound();

  const diasAlerta = config?.diasAlertaValidade ?? 7;

  const saldo = insumo.lotes.reduce(
    (total, lote) => total + Number(lote.quantidadeRestante),
    0,
  );

  const situacao = situacaoEstoque(saldo, Number(insumo.estoqueMinimo));

  // Variação entre os dois últimos preços registrados
  const [precoAtual, precoAnterior] = insumo.historicoPrecos;
  const variacao =
    precoAtual && precoAnterior
      ? variacaoPercentual(
          Number(precoAnterior.custoUnitario),
          Number(precoAtual.custoUnitario),
        )
      : null;

  const unidade = ROTULO_UNIDADE_BASE[insumo.unidadeBase];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/insumos">
            <ArrowLeft className="size-4" />
            Insumos
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{insumo.nome}</h2>
          <SeloEstoque situacao={situacao} />
          {!insumo.ativo ? <Badge variant="secondary">Arquivado</Badge> : null}
        </div>

        <p className="text-muted-foreground mt-1 text-sm">
          {ROTULO_CATEGORIA[insumo.categoria]} · medido em {unidade}
          {insumo.marcaPreferida ? ` · marca preferida: ${insumo.marcaPreferida}` : ""}
        </p>

        {insumo.observacao ? (
          <p className="text-muted-foreground mt-2 text-sm italic">
            {insumo.observacao}
          </p>
        ) : null}
      </div>

      {/* --------------------------------------------------------- resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs">
              Tenho agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="num text-2xl font-semibold">
              {formatarQuantidade(saldo, insumo.unidadeBase)}
            </p>
            {Number(insumo.estoqueMinimo) > 0 ? (
              <p className="text-muted-foreground mt-0.5 text-xs">
                aviso abaixo de{" "}
                {formatarQuantidade(insumo.estoqueMinimo, insumo.unidadeBase)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs">
              Custo usado nas receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="num text-2xl font-semibold">
              {Number(insumo.custoMedio) > 0
                ? formatarMoedaPrecisa(insumo.custoMedio)
                : "—"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              por {unidade} · média do estoque
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs">
              Última compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="num text-2xl font-semibold">
                {insumo.custoUltimaCompra
                  ? formatarMoedaPrecisa(insumo.custoUltimaCompra)
                  : "—"}
              </p>
              {variacao ? <SeloVariacao percentual={variacao.toNumber()} /> : null}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {insumo.dataUltimaCompra
                ? formatarDataRelativa(insumo.dataUltimaCompra)
                : "nenhuma compra ainda"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------- equivalências */}
      <PainelEquivalencias
        insumoId={insumo.id}
        unidadeBase={insumo.unidadeBase}
        equivalencias={insumo.equivalencias.map((e) => ({
          id: e.id,
          nome: e.nome,
          quantidadeBase: Number(e.quantidadeBase),
        }))}
      />

      {/* --------------------------------------------------------- lotes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que tem em estoque</CardTitle>
        </CardHeader>
        <CardContent>
          {insumo.lotes.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
              <PackageOpen className="size-8 opacity-40" />
              <p>
                Nada em estoque. Lance uma compra pra este insumo ganhar saldo e
                preço.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-1">
                <Link href="/compras/nova">Lançar compra</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {insumo.lotes.map((lote) => {
                const sitValidade = situacaoValidade(lote.validade, diasAlerta);

                return (
                  <li
                    key={lote.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="num text-sm font-medium">
                        {formatarQuantidade(
                          lote.quantidadeRestante,
                          insumo.unidadeBase,
                        )}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          de{" "}
                          {formatarQuantidade(
                            lote.quantidadeInicial,
                            insumo.unidadeBase,
                          )}
                        </span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatarMoedaPrecisa(lote.custoUnitario)} por {unidade}
                        {lote.compra ? ` · compra #${lote.compra.numero}` : ""}
                        {` · entrou ${formatarData(lote.dataEntrada)}`}
                      </p>
                    </div>

                    {lote.validade ? (
                      <div className="text-right">
                        <SeloValidade situacao={sitValidade} />
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          vence {formatarDataRelativa(lote.validade)}
                        </p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------- histórico de preço */}
      {insumo.historicoPrecos.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como o preço andou</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {insumo.historicoPrecos.map((registro, i) => {
                const anterior = insumo.historicoPrecos[i + 1];
                const varia = anterior
                  ? variacaoPercentual(
                      Number(anterior.custoUnitario),
                      Number(registro.custoUnitario),
                    )
                  : null;

                return (
                  <li
                    key={registro.id}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="text-muted-foreground text-xs">
                      {formatarData(registro.registradoEm)} · {registro.origem}
                    </span>
                    <span className="flex items-center gap-2">
                      {varia ? <SeloVariacao percentual={varia.toNumber()} /> : null}
                      <span className="num text-sm font-medium">
                        {formatarMoedaPrecisa(registro.custoUnitario)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
