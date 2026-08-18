import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChefHat, Pencil, TriangleAlert } from "lucide-react";

import { prisma } from "@/lib/db";
import { carregarBaseDeCusto, custoDeProduto } from "@/server/custos";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { PainelPreco } from "./painel-preco";
import { BotoesProduto } from "./botoes-produto";

export const dynamic = "force-dynamic";

export default async function PaginaProduto({ params }: PageProps<"/produtos/[id]">) {
  const { id } = await params;

  const [produto, base, config] = await Promise.all([
    prisma.produto.findUnique({
      where: { id },
      include: {
        receita: {
          select: { id: true, nome: true, rendimentoUnidade: true },
        },
      },
    }),
    carregarBaseDeCusto(),
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
  ]);

  if (!produto) notFound();

  const custo = custoDeProduto(produto, base);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/produtos">
            <ArrowLeft className="size-4" />
            Produtos
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{produto.nome}</h2>
              {!produto.ativo ? (
                <Badge variant="secondary">Arquivado</Badge>
              ) : null}
            </div>

            {produto.receita ? (
              <p className="text-muted-foreground mt-1 text-sm">
                Usa {Number(produto.consumoDaReceita)}{" "}
                {produto.receita.rendimentoUnidade} da ficha{" "}
                <Link
                  href={`/receitas/${produto.receita.id}`}
                  className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                >
                  <ChefHat className="size-3.5" />
                  {produto.receita.nome}
                </Link>
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-sm">
                Sem ficha técnica — o custo de ingredientes está zerado.
              </p>
            )}

            {produto.descricao ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {produto.descricao}
              </p>
            ) : null}
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/produtos/${id}/editar`}>
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

      {custo.insumosSemPreco.length > 0 ? (
        <Alert className="border-warning/30 bg-warning-soft/40">
          <TriangleAlert className="text-warning size-4" />
          <AlertDescription>
            O preço abaixo está <strong>menor que o real</strong>:{" "}
            {custo.insumosSemPreco.join(", ")} ainda sem preço. Lance uma compra
            desses insumos.
          </AlertDescription>
        </Alert>
      ) : null}

      {!produto.receitaId ? (
        <Alert className="border-warning/30 bg-warning-soft/40">
          <TriangleAlert className="text-warning size-4" />
          <AlertDescription>
            Este produto não está ligado a nenhuma ficha técnica, então o sistema
            não sabe quanto ele gasta de ingrediente.{" "}
            <Link
              href={`/produtos/${id}/editar`}
              className="text-primary font-medium underline"
            >
              Ligar a uma ficha
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <PainelPreco
        produtoId={produto.id}
        custoIngredientes={custo.custoIngredientes.toNumber()}
        custoEmbalagem={Number(produto.custoEmbalagem)}
        tempoTotalMin={custo.tempoTotalMin}
        precoAtual={Number(produto.precoVenda)}
        margemAlvo={
          produto.margemAlvo === null ? null : Number(produto.margemAlvo)
        }
        config={{
          valorHoraMaoDeObra: config?.valorHoraMaoDeObra?.toString() ?? "0",
          percentualCustosFixos: config?.percentualCustosFixos?.toString() ?? "0",
          percentualImpostos: config?.percentualImpostos?.toString() ?? "0",
          percentualTaxaCartao: config?.percentualTaxaCartao?.toString() ?? "0",
          margemLucroPadrao: config?.margemLucroPadrao?.toString() ?? "30",
        }}
      />

      <BotoesProduto id={produto.id} ativo={produto.ativo} />
    </div>
  );
}
