import { CircleAlert, Copy, TriangleAlert } from "lucide-react";

import type { AvisoAlergenico } from "@/lib/alergenos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotaoCopiar } from "@/components/botao-copiar";

/**
 * O aviso de alergênico da ficha técnica, pronto pra colar na etiqueta.
 *
 * Duas decisões que valem explicar:
 *
 * 1. Quando algum insumo ainda não foi conferido, o aviso aparece com a
 *    ressalva junto — não escondido num canto. Uma lista curta parece
 *    tranquilizadora, e é justamente aí que mora o perigo.
 *
 * 2. "Não contém nada" só é afirmado quando TODO insumo foi conferido. Antes
 *    disso o texto é "nada encontrado até agora", que é a verdade.
 */
export function AvisoAlergenicoCard({ aviso }: { aviso: AvisoAlergenico }) {
  const temAlgo = aviso.contem.length > 0 || aviso.podeConter.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aviso de alergênicos</CardTitle>
        <p className="text-muted-foreground text-sm">
          Exigido por lei (ANVISA) em qualquer doce que sai embalado.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {temAlgo ? (
          <div className="bg-muted/50 rounded-lg border p-3">
            <p className="text-sm leading-relaxed font-semibold tracking-wide uppercase">
              {aviso.texto}
            </p>
          </div>
        ) : aviso.completo ? (
          <p className="text-success text-sm font-medium">
            Nenhum alergênico nesta receita.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Nada encontrado até agora — mas ainda faltam insumos por conferir.
          </p>
        )}

        {!aviso.completo ? (
          <div className="border-warning/40 bg-warning/10 flex gap-2.5 rounded-lg border p-3">
            <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="text-warning font-medium">
                Este aviso pode estar incompleto.
              </p>
              <p className="text-muted-foreground mt-1">
                {aviso.insumosSemRevisao.length === 1
                  ? "Ainda não conferi o rótulo de "
                  : "Ainda não conferi o rótulo de "}
                <strong className="text-foreground">
                  {aviso.insumosSemRevisao.join(", ")}
                </strong>
                . Abra cada um em Insumos e marque o que está na embalagem.
              </p>
            </div>
          </div>
        ) : null}

        {temAlgo ? (
          <div className="flex items-start justify-between gap-3">
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              Na etiqueta, a lei pede em negrito, caixa alta e cor que contraste,
              logo depois dos ingredientes.
            </p>
            <BotaoCopiar texto={aviso.texto} rotulo="Copiar" icone={<Copy />} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
