"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { formatarData, formatarDataRelativa, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

import {
  alternarPagamento,
  excluirLancamento,
  salvarLancamento,
  type Resultado,
} from "./acoes";

export type LancamentoDaLista = {
  id: string;
  tipo: "RECEITA" | "DESPESA";
  descricao: string;
  categoria: string | null;
  categoriaId: string | null;
  valor: number;
  dataVencimento: string;
  status: "PENDENTE" | "PAGO" | "CANCELADO";
  formaPagamento: string | null;
  observacao: string | null;
  veioDeCompra: boolean;
};

type Categoria = { id: string; nome: string; tipo: "RECEITA" | "DESPESA" };

type Filtro = "pendentes" | "mes" | "todos";

export function PainelLancamentos({
  lancamentos,
  categorias,
}: {
  lancamentos: LancamentoDaLista[];
  categorias: Categoria[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<"RECEITA" | "DESPESA">("DESPESA");

  const visiveis = useMemo(() => {
    if (filtro === "pendentes") {
      return lancamentos.filter((l) => l.status === "PENDENTE");
    }
    if (filtro === "mes") {
      return lancamentos.filter((l) => l.status === "PAGO");
    }
    return lancamentos;
  }, [lancamentos, filtro]);

  const pendentes = lancamentos.filter((l) => l.status === "PENDENTE").length;

  function abrir(tipo: "RECEITA" | "DESPESA") {
    setTipoNovo(tipo);
    setDialogoAberto(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Contas</CardTitle>
          <p className="text-muted-foreground text-sm">
            A pagar, a receber e o que já foi quitado.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => abrir("RECEITA")}>
            <Plus className="size-4" />
            Entrada
          </Button>
          <Button variant="outline" size="sm" onClick={() => abrir("DESPESA")}>
            <Plus className="size-4" />
            Saída
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Chip ativo={filtro === "pendentes"} onClick={() => setFiltro("pendentes")}>
            Em aberto{pendentes > 0 ? ` (${pendentes})` : ""}
          </Chip>
          <Chip ativo={filtro === "mes"} onClick={() => setFiltro("mes")}>
            Já quitadas
          </Chip>
          <Chip ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>
            Todas
          </Chip>
        </div>

        {visiveis.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {filtro === "pendentes"
              ? "Nenhuma conta em aberto. Tudo em dia!"
              : "Nada por aqui ainda."}
          </p>
        ) : (
          <ul className="divide-y">
            {visiveis.map((l) => (
              <LinhaLancamento key={l.id} lancamento={l} />
            ))}
          </ul>
        )}
      </CardContent>

      <DialogoLancamento
        aberto={dialogoAberto}
        onOpenChange={setDialogoAberto}
        tipo={tipoNovo}
        categorias={categorias.filter((c) => c.tipo === tipoNovo)}
      />
    </Card>
  );
}

function LinhaLancamento({ lancamento }: { lancamento: LancamentoDaLista }) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();

  const ehReceita = lancamento.tipo === "RECEITA";
  const pago = lancamento.status === "PAGO";
  const vencimento = new Date(lancamento.dataVencimento);
  const vencida = !pago && vencimento < new Date();

  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", pago && "text-muted-foreground")}>
          {lancamento.descricao}
        </p>
        <p className="text-muted-foreground text-xs">
          {lancamento.categoria ? `${lancamento.categoria} · ` : ""}
          {pago ? (
            "quitada"
          ) : (
            <span className={vencida ? "text-danger font-medium" : undefined}>
              vence {formatarDataRelativa(vencimento)} (
              {formatarData(vencimento)})
            </span>
          )}
        </p>
      </div>

      <span
        className={cn(
          "num shrink-0 text-sm font-semibold",
          ehReceita ? "text-success" : "text-foreground",
        )}
      >
        {ehReceita ? "+" : "−"} {formatarMoeda(lancamento.valor)}
      </span>

      <div className="flex shrink-0">
        <Button
          variant="ghost"
          size="icon"
          disabled={processando}
          aria-label={pago ? "Voltar para em aberto" : "Marcar como quitada"}
          onClick={() =>
            iniciar(async () => {
              await alternarPagamento(lancamento.id, !pago);
              toast.success(pago ? "Voltou para em aberto." : "Marcada como quitada.");
              router.refresh();
            })
          }
          className={pago ? "text-muted-foreground" : "text-success"}
        >
          {processando ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : pago ? (
            <Undo2 className="size-4" />
          ) : (
            <Check className="size-4" />
          )}
        </Button>

        {!lancamento.veioDeCompra ? (
          <Button
            variant="ghost"
            size="icon"
            disabled={processando}
            aria-label="Apagar lançamento"
            onClick={() =>
              iniciar(async () => {
                const r = await excluirLancamento(lancamento.id);
                if (r.ok) {
                  toast.success("Lançamento apagado.");
                  router.refresh();
                } else {
                  toast.error(r.erro ?? "Não consegui apagar.");
                }
              })
            }
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function DialogoLancamento({
  aberto,
  onOpenChange,
  tipo,
  categorias,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "RECEITA" | "DESPESA";
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarLancamento,
    { ok: false },
  );

  useEffect(() => {
    if (estado.ok) {
      toast.success("Lançamento salvo.");
      onOpenChange(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const hoje = new Date().toISOString().slice(0, 10);
  const ehReceita = tipo === "RECEITA";

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ehReceita ? "Nova entrada" : "Nova saída"}
          </DialogTitle>
          <DialogDescription>
            {ehReceita
              ? "Dinheiro que entrou ou vai entrar."
              : "Conta que você pagou ou tem que pagar."}
          </DialogDescription>
        </DialogHeader>

        {aberto ? (
          <form key={tipo} action={acao} className="space-y-4">
            <input type="hidden" name="tipo" value={tipo} />

            <div className="space-y-2">
              <Label htmlFor="descricao">O que é</Label>
              <Input
                id="descricao"
                name="descricao"
                placeholder={ehReceita ? "Ex.: Bolo da Dona Maria" : "Ex.: Conta de luz"}
                required
                autoFocus
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">R$</span>
                  <Input
                    id="valor"
                    name="valor"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    required
                    className="no-spinner h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataVencimento">
                  {ehReceita ? "Quando recebe" : "Quando vence"}
                </Label>
                <Input
                  id="dataVencimento"
                  name="dataVencimento"
                  type="date"
                  defaultValue={hoje}
                  required
                  className="h-11"
                />
              </div>
            </div>

            {categorias.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="categoriaId">Categoria</Label>
                <Select name="categoriaId">
                  <SelectTrigger id="categoriaId" className="h-11 w-full">
                    <SelectValue placeholder="Escolher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="observacao">
                Observação{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Textarea id="observacao" name="observacao" rows={2} />
            </div>

            <div className="bg-muted/40 flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="jaPago" className="text-sm">
                {ehReceita ? "Já recebi" : "Já paguei"}
              </Label>
              <Switch id="jaPago" name="jaPago" defaultChecked />
            </div>

            {estado.erro ? (
              <Alert variant="destructive">
                <AlertDescription>{estado.erro}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        ativo
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-accent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
