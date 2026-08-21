"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, MessageCircle, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

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

import { lerPedidoDoWhatsApp, type PedidoLido } from "./acoes-ia";

/**
 * Cola a conversa, sai o pedido.
 *
 * No WhatsApp dá pra selecionar as mensagens e copiar — ou usar "Exportar
 * conversa". A IA resolve as datas relativas ("sábado", "dia 20") e separa o
 * que foi combinado do que ficou em aberto.
 */
export function AtalhoWhatsApp({
  onPreencher,
}: {
  onPreencher: (p: PedidoLido) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [conversa, setConversa] = useState("");
  const [processando, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  function ler() {
    iniciar(async () => {
      const resultado = await lerPedidoDoWhatsApp(conversa);

      if (!resultado.ok || !resultado.itens) {
        toast.error(resultado.erro ?? "Não consegui entender a conversa.");
        return;
      }

      if (resultado.itens.length === 0) {
        toast.error(
          "Não achei nenhum pedido fechado nessa conversa. Se ela só perguntou preço, ainda não é pedido.",
        );
        return;
      }

      onPreencher(resultado);
      setAberto(false);
      setConversa("");

      toast.success(
        `Li ${resultado.itens.length} ${resultado.itens.length === 1 ? "item" : "itens"}. Confira antes de salvar.`,
      );

      const partes: string[] = [];

      const semCasar = resultado.itens.filter((i) => !i.produtoId).length;
      if (semCasar > 0) {
        partes.push(
          `${semCasar} ${semCasar === 1 ? "item não bateu" : "itens não bateram"} com nenhum produto — escolha na mão.`,
        );
      }

      if (!resultado.dataEntrega) {
        partes.push("A data de entrega não ficou clara na conversa.");
      }

      setAviso(partes.length > 0 ? partes.join(" ") : null);
    });
  }

  return (
    <>
      <Card className="border-gold-hairline bg-accent/20">
        <CardContent className="py-4">
          <p className="text-muted-foreground mb-3 text-sm font-medium">
            O pedido veio pelo WhatsApp?
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={() => setAberto(true)}
            className="bg-card"
          >
            <MessageCircle className="size-4" />
            Colar a conversa
          </Button>

          <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-xs">
            <Sparkles className="mt-0.5 size-3 shrink-0" />
            Monta o pedido abaixo. Nada é salvo até você conferir.
          </p>
        </CardContent>
      </Card>

      {aviso ? (
        <Alert className="border-warning/30 bg-warning-soft/40">
          <TriangleAlert className="text-warning size-4" />
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Colar conversa do WhatsApp</DialogTitle>
            <DialogDescription>
              Selecione as mensagens no WhatsApp, copie e cole aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={conversa}
              onChange={(e) => setConversa(e.target.value)}
              rows={9}
              autoFocus
              placeholder={
                "Maria: oi Simone, queria encomendar um bolo de chocolate de 2kg\nEu: oi Maria! Fica R$ 180\nMaria: fechado! pode ser pra sábado?\nEu: pode sim\nMaria: ah, e sem lactose por favor\nMaria: mandei 50 de sinal no pix"
              }
            />
            <p className="text-muted-foreground text-xs">
              Pode colar a conversa inteira — o que não for pedido é ignorado.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={ler}
              disabled={processando || !conversa.trim()}
            >
              {processando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Lendo...
                </>
              ) : (
                "Montar pedido"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
