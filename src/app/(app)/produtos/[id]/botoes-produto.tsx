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

import { alternarAtivoProduto, excluirProduto } from "../acoes";

export function BotoesProduto({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();

  return (
    <div className="flex flex-wrap justify-center gap-2 pt-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={processando}
        onClick={() =>
          iniciar(async () => {
            await alternarAtivoProduto(id, !ativo);
            toast.success(ativo ? "Produto arquivado." : "Produto reativado.");
            router.refresh();
          })
        }
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
            <AlertDialogTitle>Apagar este produto?</AlertDialogTitle>
            <AlertDialogDescription>
              A ficha técnica continua existindo — some só o produto e o preço
              dele. Se quiser só tirar da lista, use <strong>Arquivar</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={processando}
              onClick={() =>
                iniciar(async () => {
                  const r = await excluirProduto(id);

                  if (r.ok) {
                    toast.success("Produto apagado.");
                    router.push("/produtos");
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
    </div>
  );
}
