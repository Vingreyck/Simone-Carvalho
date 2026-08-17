"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { UnidadeBase } from "@/generated/prisma/enums";
import { ROTULO_UNIDADE_BASE } from "@/lib/unidades";
import { formatarNumero } from "@/lib/format";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  excluirEquivalencia,
  salvarEquivalencia,
  type Resultado,
} from "../acoes";

type Equivalencia = { id: string; nome: string; quantidadeBase: number };

/**
 * "1 xícara de farinha = 120 g".
 *
 * É o que deixa ela cadastrar receita do jeito que pensa, em vez de precisar
 * pesar tudo. Fica por insumo porque xícara de farinha e de açúcar não pesam igual.
 */
export function PainelEquivalencias({
  insumoId,
  unidadeBase,
  equivalencias,
}: {
  insumoId: string;
  unidadeBase: UnidadeBase;
  equivalencias: Equivalencia[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [mostrarForm, setMostrarForm] = useState(equivalencias.length === 0);
  const [excluindo, iniciarExclusao] = useTransition();

  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarEquivalencia,
    { ok: false },
  );

  useEffect(() => {
    if (estado.ok) {
      toast.success("Medida salva.");
      formRef.current?.reset();
      router.refresh();
    }
  }, [estado, router]);

  const unidade = ROTULO_UNIDADE_BASE[unidadeBase];

  function remover(id: string, nome: string) {
    iniciarExclusao(async () => {
      await excluirEquivalencia(id, insumoId);
      toast.success(`Medida "${nome}" removida.`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ruler className="text-primary size-4" />
            Suas medidas
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Pra você escrever a receita em xícara e colher, sem precisar pesar.
          </p>
        </div>

        {!mostrarForm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarForm(true)}
          >
            <Plus className="size-4" />
            Adicionar
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {equivalencias.length > 0 ? (
          <ul className="divide-y">
            {equivalencias.map((eq) => (
              <li
                key={eq.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0"
              >
                <span className="text-sm">
                  1 <strong>{eq.nome}</strong>
                  <span className="text-muted-foreground"> = </span>
                  <span className="num">
                    {formatarNumero(eq.quantidadeBase, 3)} {unidade}
                  </span>
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  disabled={excluindo}
                  onClick={() => remover(eq.id, eq.nome)}
                  aria-label={`Remover medida ${eq.nome}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {mostrarForm ? (
          <form
            ref={formRef}
            action={acao}
            className="bg-muted/40 space-y-3 rounded-lg border p-3"
          >
            <input type="hidden" name="insumoId" value={insumoId} />

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[8rem] flex-1 space-y-1.5">
                <Label htmlFor="nomeMedida" className="text-xs">
                  1 unidade de...
                </Label>
                <Input
                  id="nomeMedida"
                  name="nome"
                  placeholder="xícara"
                  required
                  className="h-10"
                />
              </div>

              <span className="pb-2.5 text-sm">=</span>

              <div className="min-w-[7rem] flex-1 space-y-1.5">
                <Label htmlFor="quantidadeBase" className="text-xs">
                  Quantos {unidade}
                </Label>
                <Input
                  id="quantidadeBase"
                  name="quantidadeBase"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="120"
                  required
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
              {equivalencias.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostrarForm(false)}
                >
                  Fechar
                </Button>
              ) : null}

              <Button type="submit" size="sm" disabled={enviando}>
                {enviando ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar medida"
                )}
              </Button>
            </div>

            <p className="text-muted-foreground text-xs">
              Dica: não precisa ser exato. Se errar, é só editar depois.
            </p>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
