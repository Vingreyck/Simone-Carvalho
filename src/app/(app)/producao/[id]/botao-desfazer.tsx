"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Undo2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { excluirProducao } from "../acoes";

export function BotaoDesfazerProducao({ id }: { id: string }) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive mx-auto flex"
        >
          <Undo2 className="size-4" />
          Desfazer esta produção
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desfazer a produção?</AlertDialogTitle>
          <AlertDialogDescription>
            Os ingredientes voltam pro estoque, nos mesmos lotes de onde saíram.
            Use isso se registrou errado ou pela quantidade errada.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={processando}
            onClick={() =>
              iniciar(async () => {
                const r = await excluirProducao(id);

                if (r.ok) {
                  toast.success("Produção desfeita e estoque devolvido.");
                  router.push("/producao");
                } else {
                  toast.error(r.erro ?? "Não consegui desfazer.");
                }
              })
            }
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {processando ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Desfazendo...
              </>
            ) : (
              "Desfazer"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
