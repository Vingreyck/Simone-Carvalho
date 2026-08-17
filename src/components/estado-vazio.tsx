import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Tela vazia que ensina em vez de só dizer "nenhum registro".
 * Ela nunca usou sistema — a primeira tela de cada módulo precisa explicar
 * o que fazer ali.
 */
export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="bg-accent text-primary rounded-full p-4">
          <Icone className="size-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="font-semibold">{titulo}</h3>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            {descricao}
          </p>
        </div>

        {acao}
      </CardContent>
    </Card>
  );
}
