"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, LoaderCircle, Search, TrashIcon } from "lucide-react";
import { toast } from "sonner";

import type { UnidadeBase } from "@/generated/prisma/enums";
import type { SituacaoEstoque } from "@/lib/estoque";
import { ROTULO_UNIDADE_BASE, formatarQuantidade, unidadesDisponiveis } from "@/lib/unidades";
import { formatarMoeda, normalizarTexto } from "@/lib/format";

import { SeloEstoque } from "@/components/selo-situacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ajustarEstoque, registrarPerda, type Resultado } from "./acoes";

export type ItemEstoque = {
  id: string;
  nome: string;
  unidadeBase: UnidadeBase;
  estoqueMinimo: number;
  saldo: number;
  valorEmEstoque: number;
  situacao: SituacaoEstoque;
  unidades: { nome: string; quantidadeBase: number }[];
};

type Acao = { tipo: "perda" | "ajuste"; item: ItemEstoque } | null;

export function PainelEstoque({ itens }: { itens: ItemEstoque[] }) {
  const [busca, setBusca] = useState("");
  const [acao, setAcao] = useState<Acao>(null);

  const visiveis = useMemo(() => {
    const termo = normalizarTexto(busca);
    if (!termo) return itens;
    return itens.filter((i) => normalizarTexto(i.nome).includes(termo));
  }, [itens, busca]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tudo que tem em estoque</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="relative mb-3">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar insumo..."
            className="h-11 pl-9"
          />
        </div>

        {visiveis.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nenhum insumo com esse nome.
          </p>
        ) : (
          <ul className="divide-y">
            {visiveis.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/insumos/${item.id}`}
                      className="hover:text-primary text-sm font-medium"
                    >
                      {item.nome}
                    </Link>
                    {/* Selo só quando há algo a dizer — "Ok" em toda linha vira ruído */}
                    {item.situacao !== "ok" ? (
                      <SeloEstoque situacao={item.situacao} />
                    ) : null}
                  </div>
                  <p className="text-muted-foreground num text-xs">
                    {formatarQuantidade(item.saldo, item.unidadeBase)}
                    {item.valorEmEstoque > 0
                      ? ` · ${formatarMoeda(item.valorEmEstoque)} parados`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAcao({ tipo: "ajuste", item })}
                  >
                    <ClipboardCheck className="size-4" />
                    <span className="hidden sm:inline">Conferir</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={item.saldo <= 0}
                    onClick={() => setAcao({ tipo: "perda", item })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <TrashIcon className="size-4" />
                    <span className="hidden sm:inline">Perda</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DialogoMovimento acao={acao} onFechar={() => setAcao(null)} />
    </Card>
  );
}

function DialogoMovimento({
  acao,
  onFechar,
}: {
  acao: Acao;
  onFechar: () => void;
}) {
  const router = useRouter();
  const ehPerda = acao?.tipo === "perda";

  const [estado, enviar, enviando] = useActionState<Resultado, FormData>(
    ehPerda ? registrarPerda : ajustarEstoque,
    { ok: false },
  );

  useEffect(() => {
    if (estado.ok) {
      toast.success(ehPerda ? "Perda registrada." : "Estoque conferido.");
      onFechar();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  if (!acao) return null;

  const { item } = acao;
  const unidadePadrao = ROTULO_UNIDADE_BASE[item.unidadeBase];
  const unidades = unidadesDisponiveis(item.unidadeBase, item.unidades);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ehPerda ? "Registrar perda" : "Conferir estoque"}
          </DialogTitle>
          <DialogDescription>
            {ehPerda
              ? `Quanto de ${item.nome} foi perdido? Sai do lote que vence primeiro.`
              : `Conte quanto tem de ${item.nome} de verdade. O sistema acerta a diferença.`}
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          <input type="hidden" name="insumoId" value={item.id} />

          <div className="bg-muted/40 rounded-lg border p-3 text-sm">
            <span className="text-muted-foreground">
              O sistema acha que tem:{" "}
            </span>
            <span className="num font-medium">
              {formatarQuantidade(item.saldo, item.unidadeBase)}
            </span>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="valor">
                {ehPerda ? "Quanto se perdeu" : "Quanto tem de verdade"}
              </Label>
              <Input
                id="valor"
                name={ehPerda ? "quantidade" : "saldoReal"}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                required
                autoFocus
                className="no-spinner h-11"
              />
            </div>

            <div className="w-32 space-y-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Select name="unidade" defaultValue={unidadePadrao}>
                <SelectTrigger id="unidade" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">
              Motivo{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="motivo"
              name="motivo"
              placeholder={ehPerda ? "Ex.: estragou na geladeira" : "Ex.: contagem do mês"}
              className="h-11"
            />
          </div>

          {estado.erro ? (
            <Alert variant="destructive">
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
