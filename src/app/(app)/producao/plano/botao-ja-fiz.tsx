"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { registrarDoPlano } from "./acoes-plano";

/**
 * Fecha o ciclo em um toque: ela fez, o estoque baixa.
 *
 * Pergunta antes porque a baixa mexe no estoque de verdade e não tem desfazer
 * de um clique — mas a pergunta já traz a resposta pronta, então ainda são dois
 * toques em vez de uma tela inteira.
 */
export function BotaoJaFiz({
  receitaId,
  vezes,
  produtoId,
  produtoNome,
  quantidade,
}: {
  receitaId: string;
  vezes: number;
  /** Serve pra tirar da lista o pedido que só tinha este doce */
  produtoId: string;
  produtoNome: string;
  quantidade: number;
}) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setAberto(true)}
      >
        <Check className="size-4" />
        Já fiz
      </Button>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Fez {quantidade.toLocaleString("pt-BR")}x {produtoNome}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Vou dar baixa nos ingredientes que essa produção gastou, sempre do
            lote que vence primeiro. Se fez só uma parte, registre em Produção
            com a quantidade certa.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={processando}
            onClick={(e) => {
              e.preventDefault();
              iniciar(async () => {
                const r = await registrarDoPlano(receitaId, vezes, produtoId);
                if (r.ok) {
                  toast.success("Produção registrada e estoque baixado.");
                  setAberto(false);
                  router.refresh();
                } else {
                  toast.error(r.erro ?? "Não consegui registrar.");
                }
              });
            }}
          >
            {processando ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Registrando...
              </>
            ) : (
              "Sim, dar baixa"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
