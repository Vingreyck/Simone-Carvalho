"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";

export type Resultado = { ok: boolean; erro?: string; id?: string };

const esquema = z.object({
  id: z.string().nullish(),
  nome: z.string().trim().min(2, "Dê um nome à câmera.").max(60),
  local: z.string().trim().max(60).nullish(),
  tipo: z.enum(["GO2RTC", "HLS", "MJPEG", "IFRAME"]),
  url: z
    .string()
    .trim()
    .min(1, "Informe o endereço.")
    .max(300)
    .refine((u) => /^https?:\/\//i.test(u), {
      message:
        "O endereço precisa começar com https:// (ou http:// se for na rede local).",
    }),
  streamId: z.string().trim().max(60).nullish(),
  ordem: z.coerce.number().int().min(0).max(99).default(0),
});

/**
 * Cadastra uma câmera.
 *
 * Repare que o sistema NUNCA guarda usuário e senha da câmera: no caminho
 * recomendado, quem fala RTSP com ela é o go2rtc, que roda na loja. Aqui fica
 * só o endereço público do go2rtc — se este banco vazar, ninguém ganha acesso
 * às câmeras.
 */
export async function salvarCamera(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const bruto = Object.fromEntries(formData.entries());
  const dados = esquema.safeParse({
    ...bruto,
    streamId: bruto.streamId || null,
    local: bruto.local || null,
    ordem: bruto.ordem || 0,
  });

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { id, ...resto } = dados.data;

  // Guarda sem a barra final pra montar as URLs sem "//" no meio
  const limpo = { ...resto, url: resto.url.replace(/\/+$/, "") };

  if (limpo.tipo === "GO2RTC" && !limpo.streamId) {
    return {
      ok: false,
      erro:
        "Pra go2rtc, informe o nome do stream — é o nome que você deu à câmera " +
        "no arquivo go2rtc.yaml (ex.: balcao).",
    };
  }

  if (id) {
    await prisma.camera.update({ where: { id }, data: limpo });
  } else {
    await prisma.camera.create({ data: limpo });
  }

  revalidatePath("/cameras");
  return { ok: true };
}

export async function alternarAtivoCamera(
  id: string,
  ativo: boolean,
): Promise<Resultado> {
  await exigirSessao();

  await prisma.camera.update({ where: { id }, data: { ativo } });
  revalidatePath("/cameras");
  return { ok: true };
}

export async function excluirCamera(id: string): Promise<Resultado> {
  await exigirSessao();

  await prisma.camera.delete({ where: { id } });
  revalidatePath("/cameras");
  return { ok: true };
}
