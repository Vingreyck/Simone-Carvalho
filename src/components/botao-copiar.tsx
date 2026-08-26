"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Copia um texto pra área de transferência.
 *
 * O aviso de alergênico e o orçamento acabam num lugar fora do sistema — a
 * etiqueta impressa, o WhatsApp. Redigitar à mão é onde o erro entra.
 */
export function BotaoCopiar({
  texto,
  rotulo = "Copiar",
  icone,
}: {
  texto: string;
  rotulo?: string;
  icone?: ReactNode;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Copiado.");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copiar}
      className="shrink-0"
    >
      {copiado ? <Check className="size-4" /> : icone}
      {copiado ? "Copiado" : rotulo}
    </Button>
  );
}
