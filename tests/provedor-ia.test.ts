import { afterEach, describe, expect, it, vi } from "vitest";

import {
  iaEstaConfigurada,
  provedorAtivo,
  traduzirErro,
  IaIndisponivelError,
} from "@/lib/ia/cliente";

/**
 * Qual provedor entra em campo — e o que acontece quando nenhum entra.
 *
 * Isso é o interruptor do recurso inteiro: se `iaEstaConfigurada()` mentir, ou
 * os botões de foto somem com a chave configurada, ou aparecem sem chave e
 * quebram na cara dela.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Zera as três chaves — o ambiente da máquina não pode influenciar o teste */
function semChaves() {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("GOOGLE_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
}

describe("escolha do provedor", () => {
  it("sem chave nenhuma, a IA fica desligada", () => {
    semChaves();

    expect(provedorAtivo()).toBeNull();
    expect(iaEstaConfigurada()).toBe(false);
  });

  it("com GEMINI_API_KEY, usa o Gemini", () => {
    semChaves();
    vi.stubEnv("GEMINI_API_KEY", "chave-de-teste");

    expect(provedorAtivo()).toBe("gemini");
    expect(iaEstaConfigurada()).toBe(true);
  });

  it("GOOGLE_API_KEY também vale — é o nome que o SDK do Google usa", () => {
    semChaves();
    vi.stubEnv("GOOGLE_API_KEY", "chave-de-teste");

    expect(provedorAtivo()).toBe("gemini");
  });

  it("com ANTHROPIC_API_KEY sozinha, usa a Claude", () => {
    semChaves();
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");

    expect(provedorAtivo()).toBe("claude");
  });

  it("com as duas chaves, o gratuito ganha", () => {
    semChaves();
    vi.stubEnv("GEMINI_API_KEY", "chave-de-teste");
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");

    expect(provedorAtivo()).toBe("gemini");
  });
});

describe("erro virando recado pra ela", () => {
  it("limite de uso diz pra esperar, não pra desistir", () => {
    const recado = traduzirErro({ status: 429 });

    expect(recado).toMatch(/limite de uso/i);
    expect(recado).toMatch(/na mão/i);
  });

  it("chave inválida é problema do Vinícius, não dela", () => {
    expect(traduzirErro({ status: 401 })).toMatch(/Vinícius/);
    expect(traduzirErro({ status: 403 })).toMatch(/Vinícius/);
  });

  it("serviço fora do ar não vira culpa da foto", () => {
    expect(traduzirErro({ status: 503 })).toMatch(/fora do ar/i);
  });

  it("sem chave, o recado é que dá pra digitar normalmente", () => {
    expect(traduzirErro(new IaIndisponivelError())).toMatch(/na mão/i);
  });

  it("erro que ninguém previu ainda sugere foto mais nítida", () => {
    expect(traduzirErro(new Error("qualquer coisa"))).toMatch(/nítida/i);
  });
});
