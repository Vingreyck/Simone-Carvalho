"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, Check, LoaderCircle, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import type { StatusPedido } from "@/generated/prisma/enums";
import { ACAO_PROXIMO, proximoStatus } from "@/lib/pedidos";
import { formatarMoeda, lerNumeroBR } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { excluirPedido, mudarStatusPedido, registrarSinal } from "../acoes";

export function AcoesPedido({
  id,
  status,
  valorTotal,
  sinalPago,
  orcamento,
}: {
  id: string;
  status: StatusPedido;
  valorTotal: number;
  sinalPago: number;
  /** Botão de mandar o orçamento — vem pronto do servidor */
  orcamento?: React.ReactNode;
}) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [dialogoPagamento, setDialogoPagamento] = useState(false);
  const [valorRecebido, setValorRecebido] = useState("");

  const proximo = proximoStatus(status);
  const rotuloProximo = ACAO_PROXIMO[status];
  const falta = valorTotal - sinalPago;

  function avancar(novo: StatusPedido) {
    iniciar(async () => {
      const r = await mudarStatusPedido(id, novo);
      if (r.ok) {
        toast.success("Pedido atualizado.");
        router.refresh();
      } else {
        toast.error(r.erro ?? "Não consegui atualizar.");
      }
    });
  }

  function salvarRecebimento(valor: number) {
    iniciar(async () => {
      const r = await registrarSinal(id, valor);
      if (r.ok) {
        toast.success("Pagamento registrado.");
        setDialogoPagamento(false);
        setValorRecebido("");
        router.refresh();
      } else {
        toast.error(r.erro ?? "Não consegui registrar.");
      }
    });
  }

  return (
    <>
      <Card className="border-primary/25">
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          {proximo && rotuloProximo ? (
            <Button
              onClick={() => avancar(proximo)}
              disabled={processando}
              className="h-11 flex-1 sm:flex-none"
            >
              {processando ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {rotuloProximo}
              <ArrowRight className="size-4" />
            </Button>
          ) : null}

          {falta > 0 && status !== "CANCELADO" ? (
            <Button
              variant="outline"
              onClick={() => {
                setValorRecebido(String(falta));
                setDialogoPagamento(true);
              }}
              disabled={processando}
              className="h-11"
            >
              <Wallet className="size-4" />
              Recebi {formatarMoeda(falta)}
            </Button>
          ) : null}

          {orcamento}

          {status !== "CANCELADO" && status !== "ENTREGUE" ? (
            <Button
              variant="ghost"
              onClick={() => avancar("CANCELADO")}
              disabled={processando}
              className="text-muted-foreground hover:text-destructive"
            >
              <Ban className="size-4" />
              Cancelar pedido
            </Button>
          ) : null}

          {status === "CANCELADO" ? (
            <Button
              variant="outline"
              onClick={() => avancar("ORCAMENTO")}
              disabled={processando}
            >
              Reabrir pedido
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* --------------------------------------------------- pagamento */}
      <Dialog open={dialogoPagamento} onOpenChange={setDialogoPagamento}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Quanto a cliente já te pagou deste pedido, no total.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="valorRecebido">Valor recebido</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">R$</span>
              <Input
                id="valorRecebido"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                inputMode="decimal"
                autoFocus
                className="no-spinner h-11 text-lg"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Total do pedido: {formatarMoeda(valorTotal)}. Se ela pagou só o
              sinal, coloque o valor do sinal.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogoPagamento(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                salvarRecebimento(sinalPago + lerNumeroBR(valorRecebido) > valorTotal
                  ? valorTotal
                  : sinalPago + lerNumeroBR(valorRecebido))
              }
              disabled={processando || lerNumeroBR(valorRecebido) <= 0}
            >
              {processando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive mx-auto flex"
          >
            <Trash2 className="size-4" />
            Apagar pedido
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Some do histórico junto com os lançamentos que ele gerou no
              financeiro. Se foi só desistência da cliente, prefira{" "}
              <strong>Cancelar pedido</strong> — aí fica o registro.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={processando}
              onClick={() =>
                iniciar(async () => {
                  const r = await excluirPedido(id);
                  if (r.ok) {
                    toast.success("Pedido apagado.");
                    router.push("/vendas");
                  } else {
                    toast.error(r.erro ?? "Não consegui apagar.");
                  }
                })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Apagando...
                </>
              ) : (
                "Apagar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
