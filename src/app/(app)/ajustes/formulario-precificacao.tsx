"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { formatarMoeda, lerNumeroBR } from "@/lib/format";
import { calcularPrecoSugerido } from "@/lib/precificacao";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { salvarPrecificacao, type Resultado } from "./acoes";

type Valores = {
  valorHoraMaoDeObra: number;
  percentualCustosFixos: number;
  percentualImpostos: number;
  percentualTaxaCartao: number;
  margemLucroPadrao: number;
  faturamentoMedioMensal: number;
  alertaVariacaoPreco: number;
  diasAlertaValidade: number;
};

export function FormularioPrecificacao({
  valores,
  faturamentoMedido,
}: {
  valores: Valores;
  /** Média das vendas registradas; null enquanto não houver histórico */
  faturamentoMedido: number | null;
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarPrecificacao,
    { ok: false },
  );

  const [campos, setCampos] = useState(valores);

  useEffect(() => {
    if (estado.ok) {
      toast.success("Ajustes salvos. Os preços já foram recalculados.");
      router.refresh();
    }
  }, [estado, router]);

  function mudar(campo: keyof Valores, valor: string) {
    setCampos((a) => ({ ...a, [campo]: lerNumeroBR(valor) }));
  }

  const soma =
    campos.percentualCustosFixos +
    campos.percentualImpostos +
    campos.percentualTaxaCartao +
    campos.margemLucroPadrao;

  const impossivel = soma >= 100;

  /**
   * Exemplo ao vivo com um custo redondo de R$ 20. Vendo o preço mudar
   * enquanto mexe nos percentuais, ela entende o efeito de cada um sem
   * precisar entender a fórmula.
   */
  const exemplo = impossivel
    ? null
    : calcularPrecoSugerido(
        { custoIngredientes: 20 },
        {
          valorHoraMaoDeObra: campos.valorHoraMaoDeObra,
          percentualCustosFixos: campos.percentualCustosFixos,
          percentualImpostos: campos.percentualImpostos,
          percentualTaxaCartao: campos.percentualTaxaCartao,
          margemLucroPadrao: campos.margemLucroPadrao,
        },
      );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="text-primary size-4" />
          Como calcular seus preços
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Estes números entram no preço sugerido de cada doce.
        </p>
      </CardHeader>

      <CardContent>
        <form action={acao} className="space-y-5">
          <Campo
            id="valorHoraMaoDeObra"
            rotulo="Quanto vale sua hora de trabalho"
            ajuda="O tempo de preparo de cada receita vira dinheiro por aqui. Se você não se pagar, o lucro é ilusão."
            prefixo="R$"
            valor={campos.valorHoraMaoDeObra}
            onChange={(v) => mudar("valorHoraMaoDeObra", v)}
          />

          <Campo
            id="percentualCustosFixos"
            rotulo="Custos fixos"
            ajuda="Quanto do seu faturamento vai pra gás, luz, água, aluguel e internet. Na dúvida, comece com 15%."
            sufixo="%"
            valor={campos.percentualCustosFixos}
            onChange={(v) => mudar("percentualCustosFixos", v)}
          />

          <Campo
            id="percentualTaxaCartao"
            rotulo="Taxa da maquininha"
            ajuda="O que a maquininha desconta de cada venda. Costuma ficar entre 3% e 5%."
            sufixo="%"
            valor={campos.percentualTaxaCartao}
            onChange={(v) => mudar("percentualTaxaCartao", v)}
          />

          <Campo
            id="percentualImpostos"
            rotulo="Impostos"
            ajuda="MEI paga valor fixo por mês (não é percentual), então deixe 0. Se for ME no Simples, use a alíquota da sua faixa."
            sufixo="%"
            valor={campos.percentualImpostos}
            onChange={(v) => mudar("percentualImpostos", v)}
          />

          <Campo
            id="margemLucroPadrao"
            rotulo="Lucro que você quer"
            ajuda="Quanto quer que sobre em cada venda, depois de pagar tudo. Entre 25% e 40% é o comum na confeitaria."
            sufixo="%"
            valor={campos.margemLucroPadrao}
            onChange={(v) => mudar("margemLucroPadrao", v)}
          />

          {/* ------------------------------------------------ exemplo ao vivo */}
          {impossivel ? (
            <Alert variant="destructive">
              <TriangleAlert className="size-4" />
              <AlertDescription>
                Somando tudo dá <strong>{soma.toFixed(1)}%</strong>. Como esses
                percentuais saem do preço de venda, a soma precisa ficar abaixo
                de 100% — senão nenhum preço fecha a conta.
              </AlertDescription>
            </Alert>
          ) : exemplo ? (
            <div className="bg-accent/50 border-gold-hairline space-y-1 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">
                Exemplo: um doce que gasta{" "}
                <strong className="text-foreground">R$ 20,00</strong> de
                ingredientes deveria ser vendido por
              </p>
              <p className="num text-primary text-3xl font-semibold">
                {formatarMoeda(exemplo.precoSugerido)}
              </p>
              <p className="text-muted-foreground text-xs">
                Desse valor, {formatarMoeda(exemplo.precoSugerido.times(soma - campos.margemLucroPadrao).dividedBy(100))} paga
                custos fixos e taxas, e{" "}
                <strong className="text-foreground">
                  {formatarMoeda(
                    exemplo.precoSugerido
                      .times(campos.margemLucroPadrao)
                      .dividedBy(100),
                  )}
                </strong>{" "}
                sobra pra você.
              </p>
            </div>
          ) : null}

          <div className="space-y-5 border-t pt-5">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Avisos
            </p>

            <Campo
              id="alertaVariacaoPreco"
              rotulo="Avisar quando um insumo subir mais que"
              ajuda="Você recebe um aviso e vê quais receitas ficaram mais caras."
              sufixo="%"
              valor={campos.alertaVariacaoPreco}
              onChange={(v) => mudar("alertaVariacaoPreco", v)}
            />

            <Campo
              id="diasAlertaValidade"
              rotulo="Avisar quando faltar para vencer"
              ajuda="Insumos com validade aparecem no painel com esta antecedência."
              sufixo="dias"
              valor={campos.diasAlertaValidade}
              onChange={(v) => mudar("diasAlertaValidade", v)}
            />

            {/*
              Enquanto não há histórico, esse número é o único que existe pra
              ratear os custos fixos. Assim que há, o sistema para de perguntar
              e passa a medir — e diz isso na cara dela, porque um campo que
              parece valer e não vale mais é pior do que campo nenhum.

              O valor digitado NÃO é sobrescrito: se fosse, a correção dela
              sumiria sozinha na próxima manutenção.
            */}
            {faturamentoMedido !== null ? (
              <div className="space-y-1.5">
                {/*
                  Sem o campo na tela, o valor precisa viajar assim mesmo: o
                  formulário salva a configuração inteira de uma vez, e um
                  campo ausente viraria zero — apagando a estimativa que volta a
                  valer se ela ficar meses sem lançar venda.
                */}
                <input
                  type="hidden"
                  name="faturamentoMedioMensal"
                  value={campos.faturamentoMedioMensal}
                />
                <Label>Quanto você fatura por mês</Label>
                <p className="num text-xl font-semibold">
                  {formatarMoeda(faturamentoMedido)}
                </p>
                <p className="text-muted-foreground text-xs">
                  Calculado pelas suas vendas dos últimos meses fechados. É este
                  valor que o sistema usa pra dividir os custos fixos entre os
                  doces — você não precisa mais estimar.
                </p>
              </div>
            ) : (
              <Campo
                id="faturamentoMedioMensal"
                rotulo="Quanto você fatura por mês, mais ou menos"
                ajuda="Serve pra calcular o percentual de custos fixos. Assim que você tiver alguns meses de vendas lançadas, o sistema passa a calcular sozinho e não pergunta mais."
                prefixo="R$"
                valor={campos.faturamentoMedioMensal}
                onChange={(v) => mudar("faturamentoMedioMensal", v)}
              />
            )}
          </div>

          {estado.erro ? (
            <Alert variant="destructive">
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={enviando || impossivel}>
              {enviando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Campo({
  id,
  rotulo,
  ajuda,
  valor,
  onChange,
  prefixo,
  sufixo,
}: {
  id: string;
  rotulo: string;
  ajuda: string;
  valor: number;
  onChange: (valor: string) => void;
  prefixo?: string;
  sufixo?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>

      <div className="flex items-center gap-2">
        {prefixo ? (
          <span className="text-muted-foreground text-sm">{prefixo}</span>
        ) : null}

        <Input
          id={id}
          name={id}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="no-spinner h-11 max-w-32"
        />

        {sufixo ? (
          <span className="text-muted-foreground text-sm">{sufixo}</span>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">{ajuda}</p>
    </div>
  );
}
