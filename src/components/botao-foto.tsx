"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Botão de tirar/escolher foto.
 *
 * Reduz a imagem no próprio celular antes de enviar. Foto de celular moderno
 * passa de 5 MB e demoraria pra subir no 4G da loja — e resolução maior que
 * ~1600px não melhora a leitura do cupom, só custa tempo e token.
 */

const LADO_MAXIMO = 1600;
const QUALIDADE = 0.85;

async function reduzir(arquivo: File): Promise<File> {
  // Formato que o canvas não sabe reencodar volta como veio
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return arquivo;

  const bitmap = await createImageBitmap(arquivo);
  const maiorLado = Math.max(bitmap.width, bitmap.height);

  if (maiorLado <= LADO_MAXIMO) {
    bitmap.close();
    return arquivo;
  }

  const escala = LADO_MAXIMO / maiorLado;
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return arquivo;
  }

  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALIDADE),
  );

  if (!blob) return arquivo;

  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

export function BotaoFoto({
  onFoto,
  processando,
  rotulo = "Tirar foto",
  className,
}: {
  onFoto: (arquivo: File) => void;
  processando?: boolean;
  rotulo?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparando, setPreparando] = useState(false);

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setPreparando(true);
    try {
      onFoto(await reduzir(arquivo));
    } finally {
      setPreparando(false);
      // Permite escolher a mesma foto de novo se a leitura falhar
      evento.target.value = "";
    }
  }

  const ocupado = preparando || processando;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // `capture` abre a câmera direto no celular; no notebook vira seletor
        capture="environment"
        onChange={aoEscolher}
        className="hidden"
      />

      <Button
        type="button"
        variant="outline"
        disabled={ocupado}
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {ocupado ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Lendo...
          </>
        ) : (
          <>
            <Camera className="size-4" />
            {rotulo}
          </>
        )}
      </Button>
    </>
  );
}
