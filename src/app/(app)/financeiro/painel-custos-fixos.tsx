"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, House, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatarMoeda } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  excluirCustoFixo,
  gerarContasDoMes,
  salvarCustoFixo,
  type Resultado,
} from "./acoes";

export type CustoFixo = {
  id: string;
  nome: string;
  valor: number;
  diaVencimento: number | null;
};

/**
 * As contas que ela paga todo mês independentemente de vender ou não.
 *
 * Cadastrar aqui não é burocracia: a soma vira o percentual de custos fixos
 * que entra no preço de venda de cada doce. É o que fecha o ciclo entre a
 * conta de luz e o preço do bolo.
 */
export function PainelCustosFixos({ custos }: { custos: CustoFixo[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [gerando, iniciarGeracao] = useTransition();
  const [excluindo, iniciarExclusao] = useTransition();

  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarCustoFixo,
    { ok: false },
  );

  // O formulário fica aberto de propósito depois de salvar: ela normalmente
  // cadastra luz, água, gás e aluguel de uma vez só.
  useEffect(() => {
    if (estado.ok) {
      toast.success("Conta fixa salva. O preço dos produtos foi recalculado.");
      formRef.current?.reset();
      router.refresh();
    }
  }, [estado, router]);

  const total = custos.reduce((t, c) => t + c.valor, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <House className="text-primary size-4" />
            Contas de todo mês
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Gás, luz, água, aluguel. A soma entra no preço de cada doce.
          </p>
        </div>

        {!mostrarForm ? (
          <Button variant="outline" size="sm" onClick={() => setMostrarForm(true)}>
            <Plus className="size-4" />
            Adicionar
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {custos.length > 0 ? (
          <>
            <ul className="divide-y">
              {custos.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    {c.diaVencimento ? (
                      <p className="text-muted-foreground text-xs">
                        vence todo dia {c.diaVencimento}
                      </p>
                    ) : null}
                  </div>

                  <span className="num shrink-0 text-sm font-medium">
                    {formatarMoeda(c.valor)}
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={excluindo}
                    aria-label={`Remover ${c.nome}`}
                    onClick={() =>
                      iniciarExclusao(async () => {
                        await excluirCustoFixo(c.id);
                        toast.success("Conta removida.");
                        router.refresh();
                      })
                    }
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <span className="text-sm font-medium">
                Total por mês:{" "}
                <span className="num">{formatarMoeda(total)}</span>
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={gerando}
                onClick={() =>
                  iniciarGeracao(async () => {
                    const mes = new Date().toISOString().slice(0, 7);
                    const r = await gerarContasDoMes(mes);

                    if (r.ok) {
                      toast.success(r.erro ?? "Contas do mês lançadas.");
                      router.refresh();
                    } else {
                      toast.error(r.erro ?? "Não consegui gerar.");
                    }
                  })
                }
              >
                {gerando ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CalendarPlus className="size-4" />
                )}
                Lançar as contas deste mês
              </Button>
            </div>
          </>
        ) : !mostrarForm ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nenhuma conta fixa cadastrada. Sem elas, o preço dos seus doces não
            cobre gás, luz e aluguel.
          </p>
        ) : null}

        {mostrarForm ? (
          <form
            ref={formRef}
            action={acao}
            className="bg-muted/40 space-y-3 rounded-lg border p-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[9rem] flex-1 space-y-1.5">
                <Label htmlFor="nomeCusto" className="text-xs">
                  Conta
                </Label>
                <Input
                  id="nomeCusto"
                  name="nome"
                  placeholder="Ex.: Energia elétrica"
                  required
                  className="h-10"
                />
              </div>

              <div className="w-28 space-y-1.5">
                <Label htmlFor="valorCusto" className="text-xs">
                  Valor
                </Label>
                <Input
                  id="valorCusto"
                  name="valor"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="180,00"
                  required
                  className="no-spinner h-10"
                />
              </div>

              <div className="w-24 space-y-1.5">
                <Label htmlFor="diaVencimento" className="text-xs">
                  Dia
                </Label>
                <Input
                  id="diaVencimento"
                  name="diaVencimento"
                  type="number"
                  min="1"
                  max="31"
                  inputMode="numeric"
                  placeholder="10"
                  className="no-spinner h-10"
                />
              </div>
            </div>

            {estado.erro ? (
              <Alert variant="destructive">
                <AlertDescription>{estado.erro}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMostrarForm(false)}
              >
                Fechar
              </Button>
              <Button type="submit" size="sm" disabled={enviando}>
                {enviando ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar conta"
                )}
              </Button>
            </div>

            <p className="text-muted-foreground text-xs">
              Pra virar percentual no preço, preencha também quanto você fatura
              por mês nos Ajustes.
            </p>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
