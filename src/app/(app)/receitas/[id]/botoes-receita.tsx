"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, LoaderCircle, Trash2 } from "lucide-react";
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

import { alternarAtivoReceita, excluirReceita } from "../acoes";

export function BotoesReceita({
  id,
  ativo,
  temDependentes,
}: {
  id: string;
  ativo: boolean;
  temDependentes: boolean;
}) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();

  function arquivar() {
    iniciar(async () => {
      await alternarAtivoReceita(id, !ativo);
      toast.success(ativo ? "Ficha arquivada." : "Ficha reativada.");
      router.refresh();
    });
  }

  function apagar() {
    iniciar(async () => {
      const r = await excluirReceita(id);

      if (r.ok) {
        toast.success("Ficha apagada.");
        router.push("/receitas");
      } else {
        toast.error(r.erro ?? "Não consegui apagar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 pt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={arquivar}
        disabled={processando}
        className="text-muted-foreground"
      >
        {ativo ? (
          <>
            <Archive className="size-4" />
            Arquivar
          </>
        ) : (
          <>
            <ArchiveRestore className="size-4" />
            Reativar
          </>
        )}
      </Button>

      {/* Com dependentes, apagar quebraria o custo de outras receitas/produtos */}
      {!temDependentes ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Apagar
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar esta ficha técnica?</AlertDialogTitle>
              <AlertDialogDescription>
                A receita e os ingredientes dela somem de vez. Se quiser só tirar
                da lista sem perder, use <strong>Arquivar</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={apagar}
                disabled={processando}
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
      ) : null}
    </div>
  );
}
