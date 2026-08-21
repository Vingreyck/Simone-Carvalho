"use client";

import { useState } from "react";
import { VideoOff } from "lucide-react";

import type { TipoCamera } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { urlDeExibicao } from "@/lib/cameras";

export type CameraParaTocar = {
  id: string;
  nome: string;
  local: string | null;
  tipo: TipoCamera;
  url: string;
  streamId: string | null;
};

export function PlayerCamera({
  camera,
  className,
}: {
  camera: CameraParaTocar;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const src = urlDeExibicao(camera);

  if (falhou) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex flex-col items-center justify-center gap-2 p-4 text-center",
          className,
        )}
      >
        <VideoOff className="size-8 opacity-50" />
        <p className="text-sm font-medium">Sem imagem</p>
        <p className="text-xs">
          A câmera pode estar desligada, ou o computador da loja fora do ar.
        </p>
      </div>
    );
  }

  // MJPEG é só uma imagem que se atualiza sozinha — nem precisa de player
  if (camera.tipo === "MJPEG") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`Câmera ${camera.nome}`}
        onError={() => setFalhou(true)}
        className={cn("bg-black object-contain", className)}
      />
    );
  }

  if (camera.tipo === "HLS") {
    return (
      <video
        src={src}
        autoPlay
        muted
        playsInline
        controls
        onError={() => setFalhou(true)}
        className={cn("bg-black object-contain", className)}
      />
    );
  }

  return (
    <iframe
      src={src}
      title={`Câmera ${camera.nome}`}
      allow="autoplay; fullscreen; picture-in-picture"
      onError={() => setFalhou(true)}
      className={cn("border-0 bg-black", className)}
    />
  );
}
