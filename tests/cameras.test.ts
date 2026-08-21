import { describe, expect, it } from "vitest";

import { urlDeExibicao } from "@/lib/cameras";

describe("urlDeExibicao — go2rtc", () => {
  it("monta o endereço do player com o stream certo", () => {
    expect(
      urlDeExibicao({
        tipo: "GO2RTC",
        url: "https://cameras.doceria.com",
        streamId: "balcao",
      }),
    ).toBe("https://cameras.doceria.com/stream.html?src=balcao&mode=webrtc,mse");
  });

  it("pede WebRTC com queda pra MSE — o túnel do Cloudflare não passa UDP", () => {
    const url = urlDeExibicao({
      tipo: "GO2RTC",
      url: "https://x.com",
      streamId: "a",
    });

    expect(url).toContain("mode=webrtc,mse");
  });

  it("não gera barra dupla se o endereço vier com barra no fim", () => {
    expect(
      urlDeExibicao({
        tipo: "GO2RTC",
        url: "https://cameras.doceria.com/",
        streamId: "salao",
      }),
    ).toBe("https://cameras.doceria.com/stream.html?src=salao&mode=webrtc,mse");
  });

  it("escapa nome de stream com caractere especial", () => {
    // Sem escapar, um "&" no nome quebraria o resto dos parâmetros
    expect(
      urlDeExibicao({
        tipo: "GO2RTC",
        url: "https://x.com",
        streamId: "cozinha&fundos",
      }),
    ).toContain("src=cozinha%26fundos");
  });

  it("stream vazio não quebra a montagem", () => {
    expect(
      urlDeExibicao({ tipo: "GO2RTC", url: "https://x.com", streamId: null }),
    ).toBe("https://x.com/stream.html?src=&mode=webrtc,mse");
  });
});

describe("urlDeExibicao — outros tipos", () => {
  it("usa o endereço como veio", () => {
    for (const tipo of ["HLS", "MJPEG", "IFRAME"] as const) {
      expect(
        urlDeExibicao({ tipo, url: "https://loja.com/video", streamId: null }),
      ).toBe("https://loja.com/video");
    }
  });

  it("não mexe na querystring de um HLS", () => {
    expect(
      urlDeExibicao({
        tipo: "HLS",
        url: "https://dvr.local/live.m3u8?token=abc",
        streamId: null,
      }),
    ).toBe("https://dvr.local/live.m3u8?token=abc");
  });
});
