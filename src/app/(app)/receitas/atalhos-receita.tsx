"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, PencilLine, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { BotaoFoto } from "@/components/botao-foto";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
  lerReceitaDaFoto,
  lerReceitaDoTexto,
  type ReceitaLida,
} from "./acoes-ia";

/**
 * Foto do caderno ou texto solto viram ficha técnica.
 *
 * As unidades vêm como ela escreveu ("2 xícaras"), não convertidas — a
 * equivalência por insumo que já existe no sistema faz a conversão depois. Isso
 * mantém a ficha legível pra ela e o cálculo exato pro sistema.
 */
export function AtalhosReceita({
  onPreencher,
}: {
  onPreencher: (r: ReceitaLida) => void;
}) {
  const [lendo, setLendo] = useState(false);
  const [processando, iniciar] = useTransition();
  const [textoAberto, setTextoAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  function aplicar(resultado: ReceitaLida) {
    if (!resultado.ok || !resultado.ingredientes) {
      toast.error(resultado.erro ?? "Não consegui ler a receita.");
      return false;
    }

    if (resultado.ingredientes.length === 0) {
      toast.error("Não achei ingredientes. Confira se a foto está legível.");
      return false;
    }

    onPreencher(resultado);

    const semCasar = resultado.ingredientes.filter((i) => !i.insumoId).length;
    const duvidosos = resultado.ingredientes.filter(
      (i) => i.insumoId && !i.confiante,
    ).length;

    toast.success(
      `Li ${resultado.ingredientes.length} ingredientes. Confira antes de salvar.`,
    );

    const partes: string[] = [];
    if (semCasar > 0) {
      partes.push(
        `${semCasar} ${semCasar === 1 ? "ingrediente não bateu" : "ingredientes não bateram"} com nenhum insumo cadastrado — escolha na mão ou cadastre o insumo primeiro.`,
      );
    }
    if (duvidosos > 0) {
      partes.push(
        `${duvidosos} ${duvidosos === 1 ? "veio" : "vieram"} com palpite incerto (marcado em amarelo).`,
      );
    }

    setAviso(partes.length > 0 ? partes.join(" ") : null);
    return true;
  }

  async function aoTirarFoto(arquivo: File) {
    setLendo(true);
    setAviso(null);

    try {
      const dados = new FormData();
      dados.set("foto", arquivo);
      aplicar(await lerReceitaDaFoto(dados));
    } finally {
      setLendo(false);
    }
  }

  function lerTexto() {
    iniciar(async () => {
      if (aplicar(await lerReceitaDoTexto(texto))) {
        setTextoAberto(false);
        setTexto("");
      }
    });
  }

  return (
    <>
      <Card className="border-gold-hairline bg-accent/20">
        <CardContent className="py-4">
          <p className="text-muted-foreground mb-3 text-sm font-medium">
            Já tem a receita escrita?
          </p>

          <div className="flex flex-wrap gap-2">
            <BotaoFoto
              onFoto={aoTirarFoto}
              processando={lendo}
              rotulo="Fotografar o caderno"
              className="bg-card"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => setTextoAberto(true)}
              className="bg-card"
            >
              <PencilLine className="size-4" />
              Escrever de um jeito solto
            </Button>
          </div>

          <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-xs">
            <Sparkles className="mt-0.5 size-3 shrink-0" />
            Preenche o formulário abaixo. Nada é salvo até você conferir.
          </p>
        </CardContent>
      </Card>

      {aviso ? (
        <Alert className="border-warning/30 bg-warning-soft/40">
          <TriangleAlert className="text-warning size-4" />
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={textoAberto} onOpenChange={setTextoAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Escreva a receita</DialogTitle>
            <DialogDescription>
              Do jeito que vier à cabeça — pode ser corrido, com xícara e colher.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              autoFocus
              placeholder={
                "Bolo de chocolate\n\n3 xícaras de farinha\n2 xícaras de açúcar\n1 xícara de chocolate em pó\n4 ovos\n1 xícara de óleo\n1 colher de sopa de fermento\n\nRende 1 bolo, 40 minutos\n\nMisture os secos, junte os líquidos, forno 180°"
              }
            />
            <p className="text-muted-foreground text-xs">
              Se puder, diga quanto rende e quanto tempo leva — entra no cálculo
              do preço.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTextoAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={lerTexto}
              disabled={processando || !texto.trim()}
            >
              {processando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Lendo...
                </>
              ) : (
                "Montar ficha"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
