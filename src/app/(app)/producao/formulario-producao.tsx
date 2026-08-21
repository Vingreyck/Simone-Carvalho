"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { formatarMoeda, lerNumeroBR } from "@/lib/format";
import { formatarQuantidade, type UnidadeBase } from "@/lib/unidades";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  preverProducao,
  registrarProducao,
  type Previsao,
  type Resultado,
  type UltimaProducao,
} from "./acoes";

export type ReceitaProducao = {
  id: string;
  nome: string;
  rendimentoQuantidade: number;
  rendimentoUnidade: string;
};

export function FormularioProducao({
  receitas,
  ultima,
}: {
  receitas: ReceitaProducao[];
  ultima: UltimaProducao | null;
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    registrarProducao,
    { ok: false },
  );

  const hoje = new Date().toISOString().slice(0, 10);

  const [receitaId, setReceitaId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [data, setData] = useState(hoje);
  const [observacao, setObservacao] = useState("");

  const [carregandoPrevisao, iniciarPrevisao] = useTransition();

  const receita = receitas.find((r) => r.id === receitaId);
  const vezes = lerNumeroBR(quantidade);

  /**
   * A prévia guarda a chave (receita + quantidade) que a gerou. Isso resolve
   * dois problemas de uma vez: não precisa limpar o estado dentro do efeito
   * (React não gosta), e nunca mostra o resultado da receita anterior enquanto
   * o novo cálculo ainda está vindo.
   */
  const chave = `${receitaId}|${vezes}`;
  const [resultado, setResultado] = useState<{
    chave: string;
    previsao: Previsao;
  } | null>(null);

  useEffect(() => {
    if (!receitaId || vezes <= 0) return;

    const chaveDaBusca = `${receitaId}|${vezes}`;

    iniciarPrevisao(async () => {
      setResultado({
        chave: chaveDaBusca,
        previsao: await preverProducao(receitaId, vezes),
      });
    });
  }, [receitaId, vezes]);

  const previsao = resultado?.chave === chave ? resultado.previsao : null;

  useEffect(() => {
    if (estado.ok) {
      toast.success("Produção registrada e estoque baixado.");
      router.push("/producao");
    }
  }, [estado, router]);

  const faltando = previsao?.linhas.filter((l) => !l.suficiente) ?? [];

  return (
    <form action={acao} className="space-y-5">
      <input type="hidden" name="receitaId" value={receitaId} />

      {/* Atalho pro caso mais comum: repetir o que fez da última vez */}
      {ultima && !receitaId ? (
        <Card className="border-gold-hairline bg-accent/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Fez o de sempre?</p>
              <p className="text-muted-foreground truncate text-xs">
                Da última vez: {ultima.quantidade}{" "}
                {ultima.quantidade === 1 ? "receita" : "receitas"} de{" "}
                {ultima.receitaNome}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="bg-card shrink-0"
              onClick={() => {
                setReceitaId(ultima.receitaId);
                setQuantidade(String(ultima.quantidade));
              }}
            >
              <RotateCcw className="size-4" />
              Repetir
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que você produziu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receita">Receita</Label>
            <Select value={receitaId} onValueChange={setReceitaId}>
              <SelectTrigger id="receita" className="h-11 w-full">
                <SelectValue placeholder="Escolher receita..." />
              </SelectTrigger>
              <SelectContent>
                {receitas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantas receitas você fez</Label>
              <Input
                id="quantidade"
                name="quantidade"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                inputMode="decimal"
                required
                className="no-spinner h-11"
              />
              {receita && vezes > 0 ? (
                <p className="text-muted-foreground text-xs">
                  Isso dá {(receita.rendimentoQuantidade * vezes).toLocaleString("pt-BR")}{" "}
                  {receita.rendimentoUnidade}. Meia receita? Escreva 0,5.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Meia receita? Escreva 0,5.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Quando</Label>
              <Input
                id="data"
                name="data"
                type="date"
                value={data}
                max={hoje}
                onChange={(e) => setData(e.target.value)}
                required
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">
              Observação{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="observacao"
              name="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex.: massa ficou mais firme que o normal"
            />
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------ o que vai sair */}
      {receitaId && vezes > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">O que vai sair do estoque</CardTitle>
            <p className="text-muted-foreground text-sm">
              Sempre do lote que vence primeiro.
            </p>
          </CardHeader>

          <CardContent>
            {carregandoPrevisao && !previsao ? (
              <p className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
                <LoaderCircle className="size-4 animate-spin" />
                Calculando...
              </p>
            ) : previsao?.erro ? (
              <Alert variant="destructive">
                <TriangleAlert className="size-4" />
                <AlertDescription>{previsao.erro}</AlertDescription>
              </Alert>
            ) : previsao && previsao.linhas.length > 0 ? (
              <>
                <ul className="divide-y">
                  {previsao.linhas.map((linha) => (
                    <li
                      key={linha.insumoId}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {linha.suficiente ? (
                          <Check className="text-success size-4 shrink-0" />
                        ) : (
                          <TriangleAlert className="text-danger size-4 shrink-0" />
                        )}
                        <span className="truncate text-sm">{linha.nome}</span>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="num text-sm font-medium">
                          {formatarQuantidade(
                            linha.precisa,
                            linha.unidadeBase as UnidadeBase,
                          )}
                        </p>
                        <p
                          className={cn(
                            "num text-xs",
                            linha.suficiente
                              ? "text-muted-foreground"
                              : "text-danger font-medium",
                          )}
                        >
                          tem{" "}
                          {formatarQuantidade(
                            linha.tem,
                            linha.unidadeBase as UnidadeBase,
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-muted-foreground text-sm">
                    Custo estimado desta fornada
                  </span>
                  <span className="num text-lg font-semibold">
                    {formatarMoeda(previsao.custoEstimado)}
                  </span>
                </div>

                {faltando.length > 0 ? (
                  <Alert variant="destructive" className="mt-4">
                    <TriangleAlert className="size-4" />
                    <AlertDescription>
                      Falta estoque de{" "}
                      <strong>{faltando.map((f) => f.nome).join(", ")}</strong>.
                      Lance a compra antes de registrar esta produção.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground py-4 text-sm">
                Esta receita não tem ingredientes cadastrados.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {estado.erro ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.push("/producao")}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={enviando || !previsao?.podeProduzir}
          className="h-11 sm:w-56"
        >
          {enviando ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Registrando...
            </>
          ) : (
            "Registrar produção"
          )}
        </Button>
      </div>
    </form>
  );
}
