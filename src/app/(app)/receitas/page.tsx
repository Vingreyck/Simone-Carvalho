import Link from "next/link";
import { ChefHat, Plus, TriangleAlert } from "lucide-react";

import { prisma } from "@/lib/db";
import { carregarBaseDeCusto, custoSeguro } from "@/server/custos";
import { formatarMinutos, formatarMoeda, formatarMoedaPrecisa } from "@/lib/format";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PaginaReceitas() {
  const [receitas, base] = await Promise.all([
    prisma.receita.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        rendimentoQuantidade: true,
        rendimentoUnidade: true,
        tempoPreparoMin: true,
        _count: { select: { itens: true, usadaEm: true } },
      },
    }),
    carregarBaseDeCusto(),
  ]);

  const comCusto = receitas.map((r) => ({
    ...r,
    custo: custoSeguro(r.id, base),
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        titulo="Fichas técnicas"
        descricao="Suas receitas com o custo calculado sozinho. Quando um ingrediente sobe de preço, todas se atualizam."
        acao={
          <Button asChild>
            <Link href="/receitas/nova">
              <Plus className="size-4" />
              Nova ficha
            </Link>
          </Button>
        }
      />

      {receitas.length === 0 ? (
        <EstadoVazio
          icone={ChefHat}
          titulo="Nenhuma ficha técnica ainda"
          descricao="Comece pelas bases que você mais usa — massa de bolo, brigadeiro de recheio, ganache. Depois é só montar os bolos usando elas."
          acao={
            <Button asChild>
              <Link href="/receitas/nova">
                <Plus className="size-4" />
                Criar primeira ficha
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {comCusto.map((receita) => (
            <Link key={receita.id} href={`/receitas/${receita.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{receita.nome}</span>

                      {receita._count.usadaEm > 0 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          usada em {receita._count.usadaEm}
                        </Badge>
                      ) : null}

                      {receita.custo.erro ? (
                        <span className="bg-danger-soft text-danger border-danger/25 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                          <TriangleAlert className="size-3" />
                          erro
                        </span>
                      ) : receita.custo.insumosSemPreco.length > 0 ? (
                        <span className="bg-warning-soft text-warning border-warning/25 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                          custo incompleto
                        </span>
                      ) : null}
                    </div>

                    <p className="text-muted-foreground mt-0.5 text-xs">
                      rende {Number(receita.rendimentoQuantidade)}{" "}
                      {receita.rendimentoUnidade}
                      {" · "}
                      {receita._count.itens}{" "}
                      {receita._count.itens === 1 ? "item" : "itens"}
                      {receita.tempoPreparoMin > 0
                        ? ` · ${formatarMinutos(receita.tempoPreparoMin)}`
                        : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="num font-semibold">
                      {formatarMoeda(receita.custo.custoTotal)}
                    </p>
                    <p className="text-muted-foreground num text-xs">
                      {formatarMoedaPrecisa(receita.custo.custoPorUnidade, 2)} cada
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
