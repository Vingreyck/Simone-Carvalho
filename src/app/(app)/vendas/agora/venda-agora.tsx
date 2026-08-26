"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Minus, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { formatarMoeda, lerNumeroBR, normalizarTexto } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { salvarPedido, type Resultado } from "../acoes";

export type ProdutoVenda = {
  id: string;
  nome: string;
  precoVenda: number;
};

/**
 * Venda de balcão: a pessoa foi lá, escolheu, pagou e levou.
 *
 * O fluxo de encomenda (orçamento → confirmado → produzindo → pronto →
 * entregue) está certo pra quem combina hoje e busca sábado. Mas essa venda
 * aqui **já acabou** quando ela vai registrar — passar por cinco status seria
 * atrito puro na venda mais comum dela.
 *
 * Então esta tela grava direto como ENTREGUE e já paga. Por baixo é o mesmo
 * `salvarPedido` das encomendas, então o custo continua sendo congelado e o
 * financeiro lançado igual — muda só o caminho até lá.
 */
export function VendaAgora({ produtos }: { produtos: ProdutoVenda[] }) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarPedido,
    { ok: false },
  );

  const [busca, setBusca] = useState("");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [recebidoEditado, setRecebidoEditado] = useState<string | null>(null);

  const escolhidos = produtos.filter((p) => (quantidades[p.id] ?? 0) > 0);

  const total = escolhidos.reduce(
    (soma, p) => soma + p.precoVenda * (quantidades[p.id] ?? 0),
    0,
  );

  /**
   * O campo de recebido acompanha o total até ela mexer nele.
   * Depois disso é dela — desconto de cliente fiel é regra da casa, não erro.
   */
  const recebido = recebidoEditado === null ? total : lerNumeroBR(recebidoEditado);

  const visiveis = useMemo(() => {
    if (!busca.trim()) return produtos;
    const alvo = normalizarTexto(busca);
    return produtos.filter((p) => normalizarTexto(p.nome).includes(alvo));
  }, [produtos, busca]);

  function mudar(id: string, delta: number) {
    setQuantidades((atual) => {
      const nova = Math.max(0, (atual[id] ?? 0) + delta);
      return { ...atual, [id]: nova };
    });
  }

  useEffect(() => {
    if (estado.ok) {
      toast.success("Venda registrada.");
      router.push("/vendas");
    }
  }, [estado, router]);

  /**
   * O que ela de fato cobrou.
   *
   * Digitar MAIS que o total é o caso da nota de R$ 50 numa venda de R$ 42,50 —
   * ela recebeu 50 e devolveu troco. A venda continua sendo de 42,50, então o
   * excedente não pode virar receita nem, pior, erro na cara dela.
   *
   * Digitar MENOS é desconto de cliente fiel, que é regra da casa dela — esse
   * fica registrado, porque some do lucro e ela precisa enxergar.
   */
  const cobrado = Math.min(recebido, total);
  const desconto = total - cobrado;
  const troco = Math.max(0, recebido - total);

  const payload = JSON.stringify({
    status: "ENTREGUE",
    canal: "LOJA",
    // Sem data de entrega: ela levou agora. O financeiro usa a data do pedido.
    dataEntrega: null,
    desconto,
    taxaEntrega: 0,
    // Já pagou tudo — é o que define "venda à vista" pro financeiro
    sinalPago: cobrado,
    itens: escolhidos.map((p) => ({
      produtoId: p.id,
      quantidade: quantidades[p.id],
      precoUnitario: p.precoVenda,
    })),
  });

  if (produtos.length === 0) {
    return (
      <Alert>
        <TriangleAlert className="size-4" />
        <AlertDescription>
          Você ainda não tem produtos cadastrados. Cadastre em{" "}
          <strong>Produtos e preços</strong> pra poder vender.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={acao} className="space-y-4 pb-32">
      <input type="hidden" name="payload" value={payload} />

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar doce..."
        className="h-11"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {visiveis.map((produto) => {
          const quantos = quantidades[produto.id] ?? 0;

          return (
            <Card
              key={produto.id}
              className={cn(
                "transition-colors",
                quantos > 0 && "border-primary/40 bg-accent/30",
              )}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => mudar(produto.id, 1)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium">{produto.nome}</p>
                  <p className="text-muted-foreground num text-xs">
                    {formatarMoeda(produto.precoVenda)}
                  </p>
                </button>

                {quantos > 0 ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9"
                      onClick={() => mudar(produto.id, -1)}
                      aria-label={`Tirar um ${produto.nome}`}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="num w-7 text-center text-sm font-semibold">
                      {quantos}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9"
                      onClick={() => mudar(produto.id, 1)}
                      aria-label={`Mais um ${produto.nome}`}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={() => mudar(produto.id, 1)}
                    aria-label={`Adicionar ${produto.nome}`}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Nenhum doce com esse nome.
        </p>
      ) : null}

      {estado.erro ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      {/* Barra fixa: o total e o botão ficam sempre à mão, sem rolar */}
      {escolhidos.length > 0 ? (
        <div className="bg-card/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur md:left-64">
          <div className="mx-auto max-w-4xl space-y-3 p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs">
                  {escolhidos.reduce((n, p) => n + quantidades[p.id], 0)}{" "}
                  {escolhidos.reduce((n, p) => n + quantidades[p.id], 0) === 1
                    ? "doce"
                    : "doces"}
                </p>
                <p className="num text-2xl font-semibold">
                  {formatarMoeda(total)}
                </p>
              </div>

              <div className="w-36">
                <Label htmlFor="recebido" className="text-xs">
                  Recebeu
                </Label>
                <Input
                  id="recebido"
                  value={recebidoEditado ?? String(total).replace(".", ",")}
                  onChange={(e) => setRecebidoEditado(e.target.value)}
                  inputMode="decimal"
                  className="no-spinner num h-11 text-right"
                />
              </div>
            </div>

            {desconto > 0 ? (
              <p className="text-muted-foreground text-xs">
                Desconto de {formatarMoeda(desconto)} — vai ficar registrado.
              </p>
            ) : null}

            {troco > 0 ? (
              <p className="text-sm font-medium">
                Troco:{" "}
                <span className="num text-warning">{formatarMoeda(troco)}</span>
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={enviando || recebido <= 0}
              className="h-12 w-full text-base"
            >
              {enviando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Registrar venda
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
