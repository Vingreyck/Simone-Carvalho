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

const FUSO = "America/Sao_Paulo";

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
