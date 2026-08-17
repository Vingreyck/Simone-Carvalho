import { Decimal } from "decimal.js";

/** Tudo que aparece na tela passa por aqui — o sistema fala português. */

type Numerico = Decimal | number | string | null | undefined;

function paraDecimal(valor: Numerico): Decimal {
  if (valor === null || valor === undefined || valor === "") return new Decimal(0);
  return new Decimal(valor.toString());
}

/** R$ 1.234,56 — para preços, totais, faturamento. */
export function formatarMoeda(valor: Numerico): string {
  return paraDecimal(valor).toNumber().toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * R$ 0,0056 — para custo por grama/ml, onde arredondar pra 2 casas viraria
 * "R$ 0,01" e destruiria o cálculo da ficha técnica.
 */
export function formatarMoedaPrecisa(valor: Numerico, casas = 4): string {
  return paraDecimal(valor).toNumber().toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: casas,
  });
}

/** 1.234,5 — números soltos. */
export function formatarNumero(valor: Numerico, casasMax = 2): string {
  return paraDecimal(valor).toNumber().toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casasMax,
  });
}

/** 32,5% */
export function formatarPorcentagem(valor: Numerico, casas = 1): string {
  return `${formatarNumero(paraDecimal(valor), casas)}%`;
}

/**
 * Lê o que ela digitou aceitando os dois formatos: "1.234,56" e "1234.56".
 * Campo de dinheiro em pt-BR é fonte clássica de bug — centraliza aqui.
 */
export function lerNumeroBR(texto: string | number | null | undefined): number {
  if (texto === null || texto === undefined || texto === "") return 0;
  if (typeof texto === "number") return texto;

  // Tira "R$", espa\u00e7o e qualquer outro enfeite \u2014 sobra s\u00f3 d\u00edgito, v\u00edrgula, ponto e sinal
  const limpo = texto.trim().replace(/[^\d,.-]/g, "");
  if (!limpo) return 0;

  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");

  let normalizado = limpo;
  if (temVirgula && temPonto) {
    // "1.234,56" → ponto é separador de milhar
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    normalizado = limpo.replace(",", ".");
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Deixa o texto comparável: sem acento, minúsculo, sem espaço sobrando.
 * Usado na busca — ela vai digitar "acucar" e tem que achar "Açúcar".
 */
export function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const FUSO = "America/Sao_Paulo";

/**
 * Lê "2026-08-17" de um `<input type="date">` como aquele dia no fuso local.
 *
 * `new Date("2026-08-17")` seria meia-noite UTC — que no Brasil (UTC-3) ainda é
 * dia 16 às 21h. A compra lançada hoje apareceria como sendo de ontem. Ancorar
 * ao MEIO-DIA local também deixa a data imune a horário de verão.
 */
export function lerDataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);

  if (!ano || !mes || !dia) {
    throw new Error(`Data inválida: "${iso}". Use o formato AAAA-MM-DD.`);
  }

  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

/** 17/08/2026 */
export function formatarData(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO });
}

/** 17/08/2026 14:30 */
export function formatarDataHora(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  return d.toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias" — usado nos alertas. */
export function formatarDataRelativa(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);

  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);

  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias > 1) return `em ${dias} dias`;
  return `há ${Math.abs(dias)} dias`;
}

/** 1h 30min — tempo de preparo. */
export function formatarMinutos(minutos: number | null | undefined): string {
  if (!minutos || minutos <= 0) return "—";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
