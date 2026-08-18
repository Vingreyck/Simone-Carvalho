import Link from "next/link";
import { Plus, Tags, TriangleAlert } from "lucide-react";

import { prisma } from "@/lib/db";
import { carregarBaseDeCusto, custoDeProduto } from "@/server/custos";
import { analisarPreco, calcularPrecoSugerido } from "@/lib/precificacao";
import { formatarMoeda, formatarPorcentagem } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function PaginaProdutos() {
  const [produtos, base, config] = await Promise.all([
    prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        receitaId: true,
        consumoDaReceita: true,
        custoEmbalagem: true,
        tempoExtraMin: true,
        precoVenda: true,
        margemAlvo: true,
        receita: { select: { nome: true } },
      },
    }),
    carregarBaseDeCusto(),
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
  ]);

  const cfg = {
    valorHoraMaoDeObra: config?.valorHoraMaoDeObra?.toString() ?? "0",
    percentualCustosFixos: config?.percentualCustosFixos?.toString() ?? "0",
    percentualImpostos: config?.percentualImpostos?.toString() ?? "0",
    percentualTaxaCartao: config?.percentualTaxaCartao?.toString() ?? "0",
    margemLucroPadrao: config?.margemLucroPadrao?.toString() ?? "30",
  };

  const analisados = produtos.map((produto) => {
    const custo = custoDeProduto(produto, base);

    const sugestao = calcularPrecoSugerido(
      {
        custoIngredientes: custo.custoIngredientes,
        custoEmbalagem: produto.custoEmbalagem.toString(),
        tempoPreparoMin: custo.tempoTotalMin,
        margemAlvo: produto.margemAlvo?.toString() ?? null,
      },
      cfg,
    );

    const analise = analisarPreco(
      produto.precoVenda.toString(),
      sugestao.custoDireto,
      cfg,
      produto.margemAlvo?.toString() ?? null,
    );

    return { produto, custo, sugestao, analise };
  });

  const noPrejuizo = analisados.filter(
    (a) => Number(a.produto.precoVenda) > 0 && a.analise.situacao === "prejuizo",
  );
  const semPreco = analisados.filter((a) => Number(a.produto.precoVenda) <= 0);

  const precificacaoConfigurada =
    Number(config?.valorHoraMaoDeObra ?? 0) > 0 ||
    Number(config?.percentualCustosFixos ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <CabecalhoPagina
        titulo="Produtos e preços"
        descricao="Quanto custa fazer cada doce e por quanto vender pra ter lucro de verdade."
        acao={
          <Button asChild>
            <Link href="/produtos/novo">
              <Plus className="size-4" />
              Novo produto
            </Link>
          </Button>
        }
      />

      {!precificacaoConfigurada && produtos.length > 0 ? (
        <Alert className="border-warning/30 bg-warning-soft/40">
          <TriangleAlert className="text-warning size-4" />
          <AlertDescription>
            Você ainda não disse quanto vale sua hora nem quanto gasta de custos
            fixos. Sem isso o preço sugerido sai baixo demais.{" "}
            <Link href="/ajustes" className="text-primary font-medium underline">
              Configurar agora
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {noPrejuizo.length > 0 ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>
            <strong>
              {noPrejuizo.length}{" "}
              {noPrejuizo.length === 1 ? "produto está" : "produtos estão"} sendo
              {noPrejuizo.length === 1 ? " vendido" : " vendidos"} no prejuízo:
            </strong>{" "}
            {noPrejuizo.map((a) => a.produto.nome).join(", ")}. Depois de pagar
            ingredientes, taxas e custos fixos, sobra menos que zero.
          </AlertDescription>
        </Alert>
      ) : null}

      {produtos.length === 0 ? (
        <EstadoVazio
          icone={Tags}
          titulo="Nenhum produto cadastrado"
          descricao="Produto é o que você vende — o bolo pronto, a caixa de brigadeiro. Ligue cada um a uma ficha técnica e o sistema calcula o preço."
          acao={
            <Button asChild>
              <Link href="/produtos/novo">
                <Plus className="size-4" />
                Criar primeiro produto
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {analisados.map(({ produto, custo, sugestao, analise }) => {
            const temPreco = Number(produto.precoVenda) > 0;

            return (
              <Link key={produto.id} href={`/produtos/${produto.id}`}>
                <Card
                  className={cn(
                    "transition-colors",
                    temPreco && analise.situacao === "prejuizo"
                      ? "border-danger/40"
                      : "hover:border-primary/40",
                  )}
                >
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{produto.nome}</span>
                        <SeloSituacao
                          situacao={temPreco ? analise.situacao : "sem-preco"}
                        />
                      </div>

                      <p className="text-muted-foreground num mt-0.5 text-xs">
                        custa {formatarMoeda(sugestao.custoDireto)} pra fazer
                        {produto.receita ? ` · ${produto.receita.nome}` : ""}
                        {custo.insumosSemPreco.length > 0
                          ? " · custo incompleto"
                          : ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {temPreco ? (
                        <>
                          <p className="num font-semibold">
                            {formatarMoeda(produto.precoVenda)}
                          </p>
                          <p
                            className={cn(
                              "num text-xs",
                              analise.lucro.lessThan(0)
                                ? "text-danger font-medium"
                                : "text-muted-foreground",
                            )}
                          >
                            sobra {formatarMoeda(analise.lucro)} (
                            {formatarPorcentagem(analise.margemReal, 0)})
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-muted-foreground text-xs">
                            sugerido
                          </p>
                          <p className="num text-primary font-semibold">
                            {formatarMoeda(sugestao.precoSugerido)}
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {semPreco.length > 0 ? (
            <p className="text-muted-foreground pt-2 text-center text-xs">
              {semPreco.length}{" "}
              {semPreco.length === 1
                ? "produto ainda sem preço definido"
                : "produtos ainda sem preço definido"}
              . Abra e toque em &ldquo;Usar este preço&rdquo;.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SeloSituacao({
  situacao,
}: {
  situacao: "prejuizo" | "sem-lucro" | "abaixo-da-meta" | "ok" | "sem-preco";
}) {
  const estilos = {
    prejuizo: { texto: "Prejuízo", classe: "bg-danger-soft text-danger border-danger/25" },
    "sem-lucro": { texto: "Sem lucro", classe: "bg-danger-soft text-danger border-danger/25" },
    "abaixo-da-meta": {
      texto: "Abaixo da meta",
      classe: "bg-warning-soft text-warning border-warning/25",
    },
    ok: { texto: "No lucro", classe: "bg-success-soft text-success border-success/25" },
    "sem-preco": {
      texto: "Sem preço",
      classe: "bg-muted text-muted-foreground border",
    },
  }[situacao];

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
        estilos.classe,
      )}
    >
      {estilos.texto}
    </span>
  );
}
