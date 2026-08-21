import type { TipoCamera } from "@/generated/prisma/enums";

export type CameraExibivel = {
  tipo: TipoCamera;
  url: string;
  streamId: string | null;
};

/**
 * Monta o endereço que o navegador vai abrir pra cada tipo de câmera.
 *
 * No go2rtc a gente usa o player dele (`stream.html`) de propósito: ele negocia
 * WebRTC e cai pra MSE sozinho quando a rede não deixa passar UDP — que é
 * exatamente o caso do Cloudflare Tunnel. Reimplementar essa negociação aqui
 * daria mais código e menos robustez.
 */
export function urlDeExibicao(camera: CameraExibivel): string {
  if (camera.tipo !== "GO2RTC") return camera.url;

  // A barra final já é removida ao salvar, mas o dado pode ter vindo de antes
  const base = camera.url.replace(/\/+$/, "");
  const src = encodeURIComponent(camera.streamId ?? "");

  return `${base}/stream.html?src=${src}&mode=webrtc,mse`;
}
