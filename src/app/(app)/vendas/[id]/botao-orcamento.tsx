"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import {
  linkDoWhatsApp,
  montarOrcamento,
  type ItemDoOrcamento,
} from "@/lib/orcamento";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Gera o texto do pedido pronto pra mandar pra cliente.
 *
 * O texto fica visível e editável antes de enviar — ela pode acrescentar um
 * recado. O botão do WhatsApp abre a conversa já com tudo digitado.
 */
export function BotaoOrcamento({
  nomeDaDoceria,
  cliente,
  telefone,
  itens,
  desconto,
  taxaEntrega,
  sinalPago,
  dataEntrega,
}: {
  nomeDaDoceria: string;
  cliente: string | null;
  telefone: string | null;
  itens: ItemDoOrcamento[];
  desconto: number;
  taxaEntrega: number;
  sinalPago: number;
  dataEntrega: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [texto, setTexto] = useState(() =>
    montarOrcamento({
      nomeDaDoceria,
      cliente,
      itens,
      desconto,
      taxaEntrega,
      sinalPago,
      dataEntrega,
    }),
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Copiado! Agora é só colar no WhatsApp.");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11">
          <MessageCircle className="size-4" />
          Mandar pra cliente
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mensagem pra cliente</DialogTitle>
          <DialogDescription>
            Pode editar antes de mandar. Os asteriscos viram negrito no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={14}
          className="border-input bg-card focus-visible:ring-ring w-full rounded-lg border p-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={copiar}>
            {copiado ? (
              <>
                <Check className="size-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copiar
              </>
            )}
          </Button>

          <Button asChild>
            <a
              href={linkDoWhatsApp(texto, telefone)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send className="size-4" />
              Abrir no WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
