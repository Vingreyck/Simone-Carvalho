import { describe, expect, it } from "vitest";

import { HORAS_ENTRE_EXECUCOES, manutencaoVencida } from "@/lib/manutencao";

describe("manutencaoVencida", () => {
  const agora = new Date(2026, 7, 31, 9, 0);

  function horasAtras(horas: number) {
    return new Date(agora.getTime() - horas * 3_600_000);
  }

  it("nunca rodou: roda agora", () => {
    expect(manutencaoVencida(null, agora)).toBe(true);
    expect(manutencaoVencida(undefined, agora)).toBe(true);
  });

  /*
    Ela abre o painel várias vezes por dia. Se a rotina disparasse a cada
    abertura, seria uma rajada de escrita no banco pra não fazer nada.
  */
  it("rodou há pouco: não roda de novo", () => {
    expect(manutencaoVencida(horasAtras(1), agora)).toBe(false);
    expect(manutencaoVencida(horasAtras(HORAS_ENTRE_EXECUCOES - 1), agora)).toBe(
      false,
    );
  });

  it("passou o intervalo: roda", () => {
    expect(manutencaoVencida(horasAtras(HORAS_ENTRE_EXECUCOES), agora)).toBe(
      true,
    );
    expect(manutencaoVencida(horasAtras(48), agora)).toBe(true);
  });

  /*
    Meio dia precisa ser curto o bastante pra a virada de mês ser percebida no
    mesmo dia — é quando as contas fixas são geradas.
  */
  it("o intervalo cabe duas vezes num dia", () => {
    expect(HORAS_ENTRE_EXECUCOES).toBeLessThanOrEqual(12);
  });
});
