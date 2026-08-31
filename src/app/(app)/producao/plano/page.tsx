import Link from "next/link";
import { ArrowLeft, ChefHat, ShoppingCart, TriangleAlert } from "lucide-react";

import { carregarPlano } from "@/server/plano";
import { ROTULO_URGENCIA, type Urgencia } from "@/lib/plano";
import { formatarQuantidade, type UnidadeBase } from "@/lib/unidades";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/estado-vazio";
import { BotaoCopiar } from "@/components/botao-copiar";

import { BotaoJaFiz } from "./botao-ja-fiz";

export const metadata = { title: "O que fazer" };

/** Só o que está apertado ganha cor — se tudo grita, nada é urgente. */
const CLASSE_URGENCIA: Record<Urgencia, string> = {
  atrasado: "bg-danger-soft text-danger border-danger/25",
  hoje: "bg-warning-soft text-warning border-warning/25",
  amanha: "bg-info-soft text-info border-info/25",
  "esta-semana": "bg-muted text-muted-foreground border",
  depois: "bg-muted text-muted-foreground border",
  "sem-data": "bg-muted text-muted-foreground border",
};

export default async function PlanoPage() {
  const plano = await carregarPlano();

  /**
   * A lista de compras em texto, pra ela levar no mercado.
   * O celular fica no bolso; o que serve é a lista colada no WhatsApp dela mesma.
   */
  const listaDeCompras = plano.faltaComprar
    .map(
      (f) =>
        `• ${f.nome} — ${formatarQuantidade(f.falta.toNumber(), f.unidadeBase as UnidadeBase)}`,
    )
    .join("\n");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/producao" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">O que fazer</h1>
          <p className="text-muted-foreground text-sm">
            Das encomendas confirmadas que ainda não saíram.
          </p>
        </div>
      </div>

      {plano.totalDeItens === 0 ? (
        <EstadoVazio
          icone={ChefHat}
          titulo="Nada pendente"
          descricao="Nenhuma encomenda confirmada esperando. Quando a cliente confirmar um pedido, ele aparece aqui com o que você precisa fazer."
          acao={
            <Button asChild>
              <Link href="/vendas">Ver encomendas</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ChefHat className="size-4" />
                Você precisa fazer
              </CardTitle>
            </CardHeader>

            <CardContent>
              <ul className="divide-y">
                {plano.aFazer.map((linha) => (
                  <li key={linha.produtoId} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className="num">
                            {linha.quantidade.toNumber().toLocaleString("pt-BR")}x
                          </span>{" "}
                          {linha.produtoNome}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {linha.pedidos
                            .map(
                              (p) =>
                                `#${p.numero}${p.cliente ? ` ${p.cliente}` : ""}` +
                                (linha.pedidos.length > 1
                                  ? ` (${p.quantidade.toNumber()})`
                                  : ""),
                            )
                            .join(" · ")}
                        </p>
                        {linha.semReceita ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Sem ficha técnica — não entra na lista de compras.
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            CLASSE_URGENCIA[linha.urgencia],
                          )}
                        >
                          {ROTULO_URGENCIA[linha.urgencia]}
                        </span>

                        {linha.receitaId && linha.vezesDaReceita.greaterThan(0) ? (
                          <BotaoJaFiz
                            receitaId={linha.receitaId}
                            vezes={linha.vezesDaReceita.toNumber()}
                            produtoId={linha.produtoId}
                            produtoNome={linha.produtoNome}
                            quantidade={linha.quantidade.toNumber()}
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card
            className={cn(
              plano.faltaComprar.length > 0 && "border-warning/40",
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="size-4" />
                    Você precisa comprar
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Contando o que já tem no estoque.
                  </p>
                </div>

                {plano.faltaComprar.length > 0 ? (
                  <BotaoCopiar
                    texto={`Lista de compras:\n${listaDeCompras}`}
                    rotulo="Copiar lista"
                  />
                ) : null}
              </div>
            </CardHeader>

            <CardContent>
              {plano.faltaComprar.length === 0 ? (
                <p className="text-success text-sm font-medium">
                  Tem tudo. Dá pra fazer sem ir ao mercado.
                </p>
              ) : (
                <ul className="divide-y">
                  {plano.faltaComprar.map((f) => (
                    <li
                      key={f.insumoId}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <Link
                        href={`/insumos/${f.insumoId}`}
                        className="min-w-0 flex-1 truncate text-sm hover:underline"
                      >
                        {f.nome}
                      </Link>
                      <div className="shrink-0 text-right">
                        <p className="num text-warning text-sm font-medium">
                          faltam{" "}
                          {formatarQuantidade(
                            f.falta.toNumber(),
                            f.unidadeBase as UnidadeBase,
                          )}
                        </p>
                        <p className="text-muted-foreground num text-xs">
                          precisa{" "}
                          {formatarQuantidade(
                            f.precisa.toNumber(),
                            f.unidadeBase as UnidadeBase,
                          )}
                          , tem{" "}
                          {formatarQuantidade(
                            f.tem.toNumber(),
                            f.unidadeBase as UnidadeBase,
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {plano.temAtrasado ? (
            <div className="border-danger/40 bg-danger/10 flex gap-2.5 rounded-lg border p-3">
              <TriangleAlert className="text-danger mt-0.5 size-4 shrink-0" />
              <p className="text-sm">
                Tem encomenda com a data de entrega já passada. Se combinou outra
                data com a cliente, atualize no pedido pra a lista ficar certa.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
