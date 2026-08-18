"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  analisarPreco,
  arredondarPrecoComercial,
  calcularPrecoSugerido,
  type ConfigPrecificacao,
} from "@/lib/precificacao";
import { formatarMoeda, formatarPorcentagem, lerNumeroBR } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { definirPrecoVenda } from "../acoes";

export function PainelPreco({
  produtoId,
  custoIngredientes,
  custoEmbalagem,
  tempoTotalMin,
  precoAtual,
  margemAlvo,
  config,
}: {
  produtoId: string;
  custoIngredientes: number;
  custoEmbalagem: number;
  tempoTotalMin: number;
  precoAtual: number;
  margemAlvo: number | null;
  config: ConfigPrecificacao;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();

  const sugestao = useMemo(
    () =>
      calcularPrecoSugerido(
        {
          custoIngredientes,
          custoEmbalagem,
          tempoPreparoMin: tempoTotalMin,
          margemAlvo,
        },
        config,
      ),
    [custoIngredientes, custoEmbalagem, tempoTotalMin, margemAlvo, config],
  );

  const sugeridoRedondo = arredondarPrecoComercial(sugestao.precoSugerido);

  /**
   * O lucro tem que ser calculado NO PREÇO ARREDONDADO, não pela margem nominal.
   * Arredondar R$ 31,96 pra R$ 32,90 sobra um pouco mais que os 30% pedidos —
   * mostrar "30%" aqui e "31,5%" no simulador logo abaixo, pro mesmo preço,
   * faria ela desconfiar da conta.
   */
  const analiseSugerido = useMemo(
    () =>
      analisarPreco(sugeridoRedondo, sugestao.custoDireto, config, margemAlvo),
    [sugeridoRedondo, sugestao.custoDireto, config, margemAlvo],
  );

  // O simulador começa no preço que ela já pratica, ou no sugerido se não houver
  const [simulado, setSimulado] = useState(
    String(precoAtual > 0 ? precoAtual : sugeridoRedondo.toNumber()),
  );

  const analise = useMemo(
    () =>
      analisarPreco(
        lerNumeroBR(simulado),
        sugestao.custoDireto,
        config,
        margemAlvo,
      ),
    [simulado, sugestao.custoDireto, config, margemAlvo],
  );

  function usarPreco(valor: number) {
    iniciar(async () => {
      const r = await definirPrecoVenda(produtoId, valor);

      if (r.ok) {
        toast.success(`Preço definido: ${formatarMoeda(valor)}`);
        router.refresh();
      } else {
        toast.error(r.erro ?? "Não consegui salvar.");
      }
    });
  }

  if (sugestao.impossivel) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="size-4" />
        <AlertDescription>
          Os percentuais dos Ajustes somam{" "}
          {sugestao.percentuaisSobreVenda.toFixed(1)}% — 100% ou mais do preço de
          venda. Nenhum preço fecha essa conta. Reduza a margem ou os custos nos
          Ajustes.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ quanto custa fazer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quanto custa fazer</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <Linha rotulo="Ingredientes" valor={sugestao.custoIngredientes} />
            {custoEmbalagem > 0 ? (
              <Linha rotulo="Embalagem" valor={sugestao.custoEmbalagem} />
            ) : null}
            {tempoTotalMin > 0 ? (
              <Linha
                rotulo={`Seu trabalho (${Math.round(tempoTotalMin)} min)`}
                valor={sugestao.custoMaoDeObra}
              />
            ) : null}

            <li className="flex justify-between border-t pt-2 font-semibold">
              <span>Sai do seu bolso</span>
              <span className="num">{formatarMoeda(sugestao.custoDireto)}</span>
            </li>
          </ul>

          {tempoTotalMin > 0 && Number(config.valorHoraMaoDeObra) <= 0 ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Seu trabalho está valendo R$ 0 porque a hora não foi definida nos
              Ajustes.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* -------------------------------------------------- preço sugerido */}
      <Card className="border-gold-hairline from-accent/40 to-card bg-gradient-to-br">
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
            <Sparkles className="size-3.5" />
            Venda por pelo menos
          </p>

          <p className="num text-primary mt-1 text-4xl font-semibold">
            {formatarMoeda(sugeridoRedondo)}
          </p>

          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-xs">
            Assim, depois de pagar ingredientes, seu trabalho, taxa da maquininha
            e a parte dos custos fixos, sobram{" "}
            <strong className="text-foreground">
              {formatarMoeda(analiseSugerido.lucro)}
            </strong>{" "}
            de lucro ({formatarPorcentagem(analiseSugerido.margemReal, 1)}).
          </p>

          {precoAtual !== sugeridoRedondo.toNumber() ? (
            <Button
              onClick={() => usarPreco(sugeridoRedondo.toNumber())}
              disabled={salvando}
              className="mt-4"
            >
              {salvando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Usar este preço
                </>
              )}
            </Button>
          ) : (
            <p className="text-success mt-4 flex items-center justify-center gap-1.5 text-sm font-medium">
              <Check className="size-4" />
              É o preço que você já usa
            </p>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------- simulador */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">E se eu vender por...</CardTitle>
          <p className="text-muted-foreground text-sm">
            Mexa no valor e veja o que sobra pra você.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="simulado" className="text-xs">
                Preço de venda
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">R$</span>
                <Input
                  id="simulado"
                  value={simulado}
                  onChange={(e) => setSimulado(e.target.value)}
                  inputMode="decimal"
                  className="no-spinner h-11 w-32 text-lg"
                />
              </div>
            </div>

            {lerNumeroBR(simulado) !== precoAtual ? (
              <Button
                variant="outline"
                onClick={() => usarPreco(lerNumeroBR(simulado))}
                disabled={salvando || lerNumeroBR(simulado) <= 0}
                className="mb-0.5"
              >
                Usar este
              </Button>
            ) : null}
          </div>

          <div
            className={cn(
              "space-y-2 rounded-lg border p-4",
              analise.situacao === "prejuizo" || analise.situacao === "sem-lucro"
                ? "bg-danger-soft/40 border-danger/25"
                : analise.situacao === "abaixo-da-meta"
                  ? "bg-warning-soft/40 border-warning/25"
                  : "bg-success-soft/40 border-success/25",
            )}
          >
            <ul className="space-y-1.5 text-sm">
              <Linha
                rotulo="Você recebe"
                valor={analise.precoVenda}
                className="font-medium"
              />
              <Linha
                rotulo="− Custo de fazer"
                valor={analise.custoDireto.negated()}
              />
              {analise.descontosSobreVenda.greaterThan(0) ? (
                <Linha
                  rotulo="− Taxas e impostos"
                  valor={analise.descontosSobreVenda.negated()}
                />
              ) : null}
              {analise.contribuicaoCustosFixos.greaterThan(0) ? (
                <Linha
                  rotulo="− Parte dos custos fixos"
                  valor={analise.contribuicaoCustosFixos.negated()}
                />
              ) : null}

              <li className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">
                  {analise.lucro.lessThan(0) ? "Você perde" : "Sobra pra você"}
                </span>
                <span
                  className={cn(
                    "num text-lg font-semibold",
                    analise.lucro.lessThan(0) ? "text-danger" : "text-success",
                  )}
                >
                  {formatarMoeda(analise.lucro.abs())}
                </span>
              </li>
            </ul>

            <p className="text-muted-foreground text-xs">
              Margem real: {formatarPorcentagem(analise.margemReal, 1)}
              {margemAlvo !== null || Number(config.margemLucroPadrao) > 0
                ? ` · sua meta é ${formatarPorcentagem(margemAlvo ?? config.margemLucroPadrao, 0)}`
                : ""}
            </p>
          </div>

          {analise.situacao === "prejuizo" ? (
            <Alert variant="destructive">
              <TriangleAlert className="size-4" />
              <AlertDescription>
                Por esse preço você está <strong>pagando pra trabalhar</strong>.
                Cada unidade vendida tira {formatarMoeda(analise.lucro.abs())} do
                seu bolso.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  className,
}: {
  rotulo: string;
  valor: { toString(): string };
  className?: string;
}) {
  return (
    <li className={cn("text-muted-foreground flex justify-between", className)}>
      <span>{rotulo}</span>
      <span className="num text-foreground">{formatarMoeda(valor.toString())}</span>
    </li>
  );
}
