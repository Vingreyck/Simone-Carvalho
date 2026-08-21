import { formatarData, formatarMoeda } from "./format";

/**
 * Monta o texto do orçamento pronto pra colar no WhatsApp.
 *
 * Responder cliente é o que ela mais faz no dia. Digitar o mesmo formato dez
 * vezes por dia é onde o tempo some — e é onde erro de conta aparece, porque
 * ela soma de cabeça enquanto conversa.
 *
 * Usa a formatação do WhatsApp: *negrito* entre asteriscos.
 */

export type ItemDoOrcamento = {
  nome: string;
  quantidade: number;
  precoUnitario: number;
  observacao?: string | null;
};

export type DadosDoOrcamento = {
  nomeDaDoceria: string;
  cliente?: string | null;
  itens: ItemDoOrcamento[];
  desconto?: number;
  taxaEntrega?: number;
  sinalPago?: number;
  dataEntrega?: Date | string | null;
  observacao?: string | null;
};

export function montarOrcamento(dados: DadosDoOrcamento): string {
  const linhas: string[] = [`*${dados.nomeDaDoceria}*`, ""];

  linhas.push(
    dados.cliente ? `Orçamento para ${dados.cliente}:` : "Seu orçamento:",
    "",
  );

  let subtotal = 0;

  for (const item of dados.itens) {
    const totalDoItem = item.precoUnitario * item.quantidade;
    subtotal += totalDoItem;

    // "2x Bolo" só quando é mais de um — "1x" polui sem informar
    const quantidade = item.quantidade === 1 ? "" : `${item.quantidade}x `;
    linhas.push(`• ${quantidade}${item.nome} — ${formatarMoeda(totalDoItem)}`);

    if (item.observacao) linhas.push(`  _${item.observacao}_`);
  }

  const desconto = dados.desconto ?? 0;
  const entrega = dados.taxaEntrega ?? 0;
  const total = subtotal - desconto + entrega;

  linhas.push("");

  // Só detalha o subtotal quando há desconto ou entrega — senão repetiria o total
  if (desconto > 0 || entrega > 0) {
    linhas.push(`Subtotal: ${formatarMoeda(subtotal)}`);
    if (desconto > 0) linhas.push(`Desconto: −${formatarMoeda(desconto)}`);
    if (entrega > 0) linhas.push(`Entrega: ${formatarMoeda(entrega)}`);
  }

  linhas.push(`*Total: ${formatarMoeda(total)}*`);

  const sinal = dados.sinalPago ?? 0;
  if (sinal > 0) {
    linhas.push("");
    linhas.push(`Já recebido: ${formatarMoeda(sinal)}`);
    const falta = total - sinal;
    if (falta > 0) linhas.push(`*Falta: ${formatarMoeda(falta)}*`);
  }

  if (dados.dataEntrega) {
    linhas.push("");
    linhas.push(`📅 Entrega: ${formatarData(dados.dataEntrega)}`);
  }

  if (dados.observacao) {
    linhas.push("");
    linhas.push(dados.observacao);
  }

  return linhas.join("\n");
}

/**
 * Link que abre o WhatsApp já com o texto digitado.
 * Sem telefone, abre o seletor de contato do próprio WhatsApp.
 */
export function linkDoWhatsApp(texto: string, telefone?: string | null): string {
  const mensagem = encodeURIComponent(texto);
  const numero = telefone?.replace(/\D/g, "");

  if (!numero) return `https://wa.me/?text=${mensagem}`;

  // Número brasileiro sem DDI precisa do 55 na frente
  const comDdi = numero.length <= 11 ? `55${numero}` : numero;
  return `https://wa.me/${comDdi}?text=${mensagem}`;
}
