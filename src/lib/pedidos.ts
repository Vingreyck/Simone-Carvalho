import type { CanalVenda, StatusPedido } from "@/generated/prisma/enums";

/**
 * Vocabulário dos pedidos.
 *
 * A ordem do fluxo importa: é ela que define qual botão aparece como próximo
 * passo na tela do pedido.
 */

export const FLUXO: StatusPedido[] = [
  "ORCAMENTO",
  "CONFIRMADO",
  "EM_PRODUCAO",
  "PRONTO",
  "ENTREGUE",
];

export const ROTULO_STATUS: Record<StatusPedido, string> = {
  ORCAMENTO: "Orçamento",
  CONFIRMADO: "Confirmado",
  EM_PRODUCAO: "Produzindo",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

/** O que ela lê no botão que avança o pedido. */
export const ACAO_PROXIMO: Partial<Record<StatusPedido, string>> = {
  ORCAMENTO: "Cliente confirmou",
  CONFIRMADO: "Comecei a fazer",
  EM_PRODUCAO: "Está pronto",
  PRONTO: "Entreguei",
};

export const CLASSE_STATUS: Record<StatusPedido, string> = {
  ORCAMENTO: "bg-muted text-muted-foreground border",
  CONFIRMADO: "bg-info-soft text-info border border-info/25",
  EM_PRODUCAO: "bg-warning-soft text-warning border border-warning/25",
  PRONTO: "bg-accent text-accent-foreground border border-primary/25",
  ENTREGUE: "bg-success-soft text-success border border-success/25",
  CANCELADO: "bg-danger-soft text-danger border border-danger/25",
};

export function proximoStatus(atual: StatusPedido): StatusPedido | null {
  const i = FLUXO.indexOf(atual);
  if (i < 0 || i >= FLUXO.length - 1) return null;
  return FLUXO[i + 1]!;
}

export const ROTULO_CANAL: Record<CanalVenda, string> = {
  LOJA: "Na loja",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  INDICACAO: "Indicação",
  OUTRO: "Outro",
};

export const CANAIS: CanalVenda[] = [
  "WHATSAPP",
  "LOJA",
  "INSTAGRAM",
  "INDICACAO",
  "OUTRO",
];

/** Pedido que ainda vai acontecer — o que aparece na agenda. */
export function estaEmAberto(status: StatusPedido): boolean {
  return status !== "ENTREGUE" && status !== "CANCELADO";
}
