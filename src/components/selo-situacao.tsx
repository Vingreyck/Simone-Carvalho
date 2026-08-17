import { cn } from "@/lib/utils";
import type { SituacaoEstoque, SituacaoValidade } from "@/lib/estoque";

/**
 * Selos de estado. Cor + texto sempre juntos — quem não distingue bem cor
 * (ou está no sol, olhando o celular) continua entendendo pela palavra.
 */

const BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const ESTOQUE: Record<SituacaoEstoque, { texto: string; classe: string }> = {
  "sem-estoque": {
    texto: "Acabou",
    classe: "bg-danger-soft text-danger border border-danger/25",
  },
  critico: {
    texto: "Crítico",
    classe: "bg-danger-soft text-danger border border-danger/25",
  },
  baixo: {
    texto: "Acabando",
    classe: "bg-warning-soft text-warning border border-warning/25",
  },
  ok: {
    texto: "Ok",
    classe: "bg-success-soft text-success border border-success/25",
  },
};

export function SeloEstoque({
  situacao,
  className,
}: {
  situacao: SituacaoEstoque;
  className?: string;
}) {
  const { texto, classe } = ESTOQUE[situacao];
  return <span className={cn(BASE, classe, className)}>{texto}</span>;
}

const VALIDADE: Record<SituacaoValidade, { texto: string; classe: string }> = {
  vencido: {
    texto: "Vencido",
    classe: "bg-danger-soft text-danger border border-danger/25",
  },
  vencendo: {
    texto: "Vence logo",
    classe: "bg-warning-soft text-warning border border-warning/25",
  },
  ok: { texto: "No prazo", classe: "bg-muted text-muted-foreground border" },
};

export function SeloValidade({
  situacao,
  className,
}: {
  situacao: SituacaoValidade;
  className?: string;
}) {
  const { texto, classe } = VALIDADE[situacao];
  return <span className={cn(BASE, classe, className)}>{texto}</span>;
}

/** Alta/queda de preço de insumo. Subir é ruim aqui — por isso vermelho no positivo. */
export function SeloVariacao({
  percentual,
  className,
}: {
  percentual: number;
  className?: string;
}) {
  if (!Number.isFinite(percentual) || Math.abs(percentual) < 0.5) return null;

  const subiu = percentual > 0;

  return (
    <span
      className={cn(
        BASE,
        subiu
          ? "bg-danger-soft text-danger border-danger/25 border"
          : "bg-success-soft text-success border-success/25 border",
        className,
      )}
    >
      {subiu ? "▲" : "▼"} {Math.abs(percentual).toFixed(0)}%
    </span>
  );
}
