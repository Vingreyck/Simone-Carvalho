import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

import {
  chaveDoMes,
  janelaDeMesesFechados,
  mediaDeFaturamento,
  somarPorMes,
} from "@/lib/faturamento";

function mes(chave: string, total: number) {
  return { mes: chave, total: new Decimal(total) };
}

describe("mediaDeFaturamento", () => {
  it("tira a média dos meses com venda", () => {
    const media = mediaDeFaturamento([
      mes("2026-05", 4000),
      mes("2026-06", 5000),
      mes("2026-07", 6000),
    ]);

    expect(media?.toString()).toBe("5000");
  });

  it("não confia em um mês só", () => {
    expect(mediaDeFaturamento([mes("2026-07", 5000)])).toBeNull();
  });

  it("não devolve nada quando não há venda nenhuma", () => {
    expect(mediaDeFaturamento([])).toBeNull();
    expect(mediaDeFaturamento([mes("2026-06", 0), mes("2026-07", 0)])).toBeNull();
  });

  /*
    Mês zerado quase nunca quer dizer "não vendeu": quer dizer que ela não
    lançou. Se entrasse na conta, a média cairia pela metade, o percentual de
    custos fixos dobraria e o preço sugerido de tudo subiria sem motivo.
  */
  it("ignora mês zerado em vez de cortar a média pela metade", () => {
    const media = mediaDeFaturamento([
      mes("2026-05", 4000),
      mes("2026-06", 0),
      mes("2026-07", 6000),
    ]);

    expect(media?.toString()).toBe("5000");
  });
});

describe("janelaDeMesesFechados", () => {
  /*
    O mês corrente tem só os dias que já passaram. Entrar na média puxaria o
    faturamento pra baixo todo dia 1º — e o preço não pode oscilar por causa do
    calendário.
  */
  it("termina no primeiro dia do mês corrente", () => {
    const { inicio, fim } = janelaDeMesesFechados(new Date(2026, 7, 31), 3);

    expect(fim).toEqual(new Date(2026, 7, 1));
    expect(inicio).toEqual(new Date(2026, 4, 1));
  });

  it("atravessa a virada de ano", () => {
    const { inicio, fim } = janelaDeMesesFechados(new Date(2026, 0, 15), 3);

    expect(fim).toEqual(new Date(2026, 0, 1));
    expect(inicio).toEqual(new Date(2025, 9, 1));
  });
});

describe("somarPorMes", () => {
  it("agrupa e soma, do mais antigo pro mais novo", () => {
    const meses = somarPorMes([
      { data: new Date(2026, 6, 10), valor: "100.50" },
      { data: new Date(2026, 5, 3), valor: "80" },
      { data: new Date(2026, 6, 28), valor: "19.50" },
    ]);

    expect(meses.map((m) => m.mes)).toEqual(["2026-06", "2026-07"]);
    expect(meses[1]!.total.toString()).toBe("120");
  });

  it("soma centavos sem erro de float", () => {
    const meses = somarPorMes([
      { data: new Date(2026, 6, 1), valor: "0.1" },
      { data: new Date(2026, 6, 2), valor: "0.2" },
    ]);

    expect(meses[0]!.total.toString()).toBe("0.3");
  });
});

describe("chaveDoMes", () => {
  it("põe zero à esquerda", () => {
    expect(chaveDoMes(new Date(2026, 0, 9))).toBe("2026-01");
    expect(chaveDoMes(new Date(2026, 11, 31))).toBe("2026-12");
  });
});
