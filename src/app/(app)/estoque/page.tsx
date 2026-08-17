import Link from "next/link";
import { Boxes, CalendarClock, Plus, TriangleAlert } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatarQuantidade } from "@/lib/unidades";
import { formatarData, formatarDataRelativa, formatarMoeda } from "@/lib/format";
import { situacaoEstoque, situacaoValidade } from "@/lib/estoque";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { SeloEstoque, SeloValidade } from "@/components/selo-situacao";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PainelEstoque, type ItemEstoque } from "./painel-estoque";

export const dynamic = "force-dynamic";

export default async function PaginaEstoque() {
  const [insumos, config] = await Promise.all([
    prisma.insumo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        unidadeBase: true,
        estoqueMinimo: true,
        custoMedio: true,
        equivalencias: { select: { nome: true, quantidadeBase: true } },
        lotes: {
          where: { quantidadeRestante: { gt: 0 } },
          select: { quantidadeRestante: true, custoUnitario: true, validade: true },
        },
      },
    }),
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
  ]);

  const diasAlerta = config?.diasAlertaValidade ?? 7;

  const itens: ItemEstoque[] = insumos.map((insumo) => {
    const saldo = insumo.lotes.reduce(
      (t, l) => t + Number(l.quantidadeRestante),
      0,
    );
    const valorEmEstoque = insumo.lotes.reduce(
      (t, l) => t + Number(l.quantidadeRestante) * Number(l.custoUnitario),
      0,
    );

    return {
      id: insumo.id,
      nome: insumo.nome,
      unidadeBase: insumo.unidadeBase,
      estoqueMinimo: Number(insumo.estoqueMinimo),
      saldo,
      valorEmEstoque,
      situacao: situacaoEstoque(saldo, Number(insumo.estoqueMinimo)),
      unidades: insumo.equivalencias.map((e) => ({
        nome: e.nome,
        quantidadeBase: Number(e.quantidadeBase),
      })),
    };
  });

  const precisamComprar = itens.filter((i) => i.situacao !== "ok");
  const valorTotal = itens.reduce((t, i) => t + i.valorEmEstoque, 0);

  // Lotes que vencem logo — a lista que ela olha antes de decidir o que produzir
  const lotesEmRisco = insumos
    .flatMap((insumo) =>
      insumo.lotes
        .filter((l) => l.validade)
        .map((l) => ({
          insumoId: insumo.id,
          nome: insumo.nome,
          unidadeBase: insumo.unidadeBase,
          quantidade: Number(l.quantidadeRestante),
          validade: l.validade!,
          situacao: situacaoValidade(l.validade, diasAlerta),
        })),
    )
    .filter((l) => l.situacao !== "ok")
    .sort((a, b) => a.validade.getTime() - b.validade.getTime());

  const temAlgo = itens.some((i) => i.saldo > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <CabecalhoPagina
        titulo="Estoque"
        descricao="O que você tem agora, o que está acabando e o que vence primeiro."
        acao={
          <Button asChild>
            <Link href="/compras/nova">
              <Plus className="size-4" />
              Lançar compra
            </Link>
          </Button>
        }
      />

      {!temAlgo ? (
        <EstadoVazio
          icone={Boxes}
          titulo="Estoque vazio"
          descricao="Assim que você lançar uma compra, os insumos aparecem aqui com saldo, custo e validade."
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
        <>
          {/* ------------------------------------------------------- avisos */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs">
                  Valor parado em estoque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="num text-2xl font-semibold">
                  {formatarMoeda(valorTotal)}
                </p>
              </CardContent>
            </Card>

            <Card className={precisamComprar.length > 0 ? "border-warning/30" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <TriangleAlert className="size-3.5" />
                  Precisa comprar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="num text-2xl font-semibold">
                  {precisamComprar.length}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {precisamComprar.length === 1 ? "insumo" : "insumos"} abaixo do
                  mínimo
                </p>
              </CardContent>
            </Card>

            <Card className={lotesEmRisco.length > 0 ? "border-danger/30" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <CalendarClock className="size-3.5" />
                  Vencendo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="num text-2xl font-semibold">{lotesEmRisco.length}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {lotesEmRisco.length === 1 ? "lote" : "lotes"} pra usar logo
                </p>
              </CardContent>
            </Card>
          </div>

          {lotesEmRisco.length > 0 ? (
            <Card className="border-danger/25">
              <CardHeader>
                <CardTitle className="text-base">Use isto primeiro</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {lotesEmRisco.slice(0, 8).map((lote, i) => (
                    <li
                      key={`${lote.insumoId}-${i}`}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/insumos/${lote.insumoId}`}
                          className="hover:text-primary text-sm font-medium"
                        >
                          {lote.nome}
                        </Link>
                        <p className="text-muted-foreground num text-xs">
                          {formatarQuantidade(lote.quantidade, lote.unidadeBase)} ·
                          vence {formatarData(lote.validade)} (
                          {formatarDataRelativa(lote.validade)})
                        </p>
                      </div>
                      <SeloValidade situacao={lote.situacao} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {precisamComprar.length > 0 ? (
            <Card className="border-warning/25">
              <CardHeader>
                <CardTitle className="text-base">Lista de compras</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {precisamComprar.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/insumos/${item.id}`}
                          className="hover:text-primary text-sm font-medium"
                        >
                          {item.nome}
                        </Link>
                        <p className="text-muted-foreground num text-xs">
                          tem {formatarQuantidade(item.saldo, item.unidadeBase)} ·
                          mínimo{" "}
                          {formatarQuantidade(item.estoqueMinimo, item.unidadeBase)}
                        </p>
                      </div>
                      <SeloEstoque situacao={item.situacao} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* --------------------------------------------- lista + ajustes */}
          <PainelEstoque itens={itens} />
        </>
      )}
    </div>
  );
}
