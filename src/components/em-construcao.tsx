import { Hammer } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Placeholder honesto para os módulos que ainda vão ser construídos.
 * Melhor mostrar o que vem do que deixar a tela em branco ou dar 404.
 */
export function EmConstrucao({
  fase,
  titulo,
  recursos,
}: {
  fase: string;
  titulo: string;
  recursos: string[];
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
        <div className="bg-accent text-primary rounded-full p-4">
          <Hammer className="size-7" />
        </div>

        <div className="space-y-2">
          <Badge variant="secondary">{fase}</Badge>
          <h2 className="text-xl font-semibold">{titulo}</h2>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            Esta parte ainda está sendo construída. Quando ficar pronta, você vai
            poder:
          </p>
        </div>

        <ul className="text-muted-foreground mx-auto max-w-sm space-y-1.5 text-left text-sm">
          {recursos.map((recurso) => (
            <li key={recurso} className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>{recurso}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
