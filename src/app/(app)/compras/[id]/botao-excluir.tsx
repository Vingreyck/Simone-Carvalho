"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
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

import { excluirCompra } from "../acoes";

export function BotaoExcluirCompra({
  id,
  podeExcluir,
}: {
  id: string;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [excluindo, iniciar] = useTransition();

  if (!podeExcluir) {
    return (
      <p className="text-muted-foreground text-center text-xs">
        Esta compra já teve insumo usado na produção, então não pode ser apagada.
        Se veio algo errado, registre uma perda no estoque.
      </p>
    );
  }

  function confirmar() {
    iniciar(async () => {
      const resultado = await excluirCompra(id);

      if (resultado.ok) {
        toast.success("Compra apagada e estoque desfeito.");
        router.push("/compras");
      } else {
        toast.error(resultado.erro ?? "Não consegui apagar.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive mx-auto flex"
        >
          <Trash2 className="size-4" />
          Apagar esta compra
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar a compra?</AlertDialogTitle>
          <AlertDialogDescription>
            O estoque que ela gerou vai sair, o preço dos insumos volta ao valor
            anterior e a conta no financeiro é removida. Não dá pra desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmar}
            disabled={excluindo}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {excluindo ? (
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
  );
}
