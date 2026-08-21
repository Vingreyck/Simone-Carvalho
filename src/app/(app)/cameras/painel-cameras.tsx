"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Expand,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

import { excluirCamera } from "./acoes";
import { DialogoCamera } from "./dialogo-camera";
import { PlayerCamera, type CameraParaTocar } from "./player-camera";

export type CameraDaLista = CameraParaTocar & {
  ordem: number;
  ativo: boolean;
};

export function PainelCameras({ cameras }: { cameras: CameraDaLista[] }) {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<CameraDaLista | null>(null);
  const [emTelaCheia, setEmTelaCheia] = useState<CameraDaLista | null>(null);

  const ativas = cameras.filter((c) => c.ativo);

  function abrirNova() {
    setEmEdicao(null);
    setDialogoAberto(true);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina
        titulo="Câmeras"
        descricao="A loja ao vivo, de onde você estiver."
        acao={
          cameras.length > 0 ? (
            <Button onClick={abrirNova}>
              <Plus className="size-4" />
              Nova câmera
            </Button>
          ) : null
        }
      />

      {cameras.length === 0 ? (
        <EstadoVazio
          icone={Video}
          titulo="Nenhuma câmera configurada"
          descricao="Quando as câmeras estiverem instaladas, cadastre aqui pra ver a loja ao vivo pelo celular. O passo a passo da instalação está em docs/SETUP-CAMERAS.md."
          acao={
            <Button onClick={abrirNova}>
              <Plus className="size-4" />
              Cadastrar câmera
            </Button>
          }
        />
      ) : (
        <>
          <div
            className={cn(
              "grid gap-3",
              ativas.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
            )}
          >
            {ativas.map((camera) => (
              <Card key={camera.id} className="overflow-hidden py-0">
                <div className="relative">
                  <PlayerCamera
                    camera={camera}
                    className="aspect-video w-full"
                  />

                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setEmTelaCheia(camera)}
                    aria-label={`Ver ${camera.nome} em tela cheia`}
                    className="absolute top-2 right-2 opacity-80 hover:opacity-100"
                  >
                    <Expand className="size-4" />
                  </Button>
                </div>

                <CardContent className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{camera.nome}</p>
                    {camera.local ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {camera.local}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${camera.nome}`}
                    onClick={() => {
                      setEmEdicao(camera);
                      setDialogoAberto(true);
                    }}
                    className="text-muted-foreground shrink-0"
                  >
                    <Pencil className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {cameras.length > ativas.length ? (
            <ListaDesativadas
              cameras={cameras.filter((c) => !c.ativo)}
              onEditar={(c) => {
                setEmEdicao(c);
                setDialogoAberto(true);
              }}
            />
          ) : null}
        </>
      )}

      <DialogoCamera
        aberto={dialogoAberto}
        onOpenChange={setDialogoAberto}
        camera={emEdicao}
      />

      {/* --------------------------------------------------- tela cheia */}
      <Dialog
        open={emTelaCheia !== null}
        onOpenChange={(aberto) => !aberto && setEmTelaCheia(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-[96vw] gap-0 border-0 bg-black p-0 sm:max-w-5xl"
        >
          <DialogTitle className="sr-only">
            {emTelaCheia?.nome ?? "Câmera"}
          </DialogTitle>

          {emTelaCheia ? (
            <div className="relative">
              <PlayerCamera
                camera={emTelaCheia}
                className="aspect-video w-full"
              />

              <div className="absolute top-2 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                {emTelaCheia.nome}
              </div>

              <Button
                size="icon"
                variant="secondary"
                onClick={() => setEmTelaCheia(null)}
                aria-label="Fechar"
                className="absolute top-2 right-2"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListaDesativadas({
  cameras,
  onEditar,
}: {
  cameras: CameraDaLista[];
  onEditar: (c: CameraDaLista) => void;
}) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();

  return (
    <section className="mt-6">
      <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
        Desligadas
      </h3>

      <ul className="divide-y rounded-lg border">
        {cameras.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.nome}</p>
              {c.local ? (
                <p className="text-muted-foreground truncate text-xs">
                  {c.local}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${c.nome}`}
                onClick={() => onEditar(c)}
                className="text-muted-foreground"
              >
                <Pencil className="size-4" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Apagar ${c.nome}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apagar {c.nome}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Some o cadastro desta câmera do sistema. A câmera em si e as
                      gravações dela não são afetadas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={processando}
                      onClick={() =>
                        iniciar(async () => {
                          await excluirCamera(c.id);
                          toast.success("Câmera apagada.");
                          router.refresh();
                        })
                      }
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {processando ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        "Apagar"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
