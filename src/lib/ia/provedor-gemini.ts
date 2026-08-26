import "server-only";

import { GoogleGenAI } from "@google/genai";

import { paraEsquemaGemini } from "./esquema-gemini";
import { IaIndisponivelError, type PedidoIa } from "./cliente";

/**
 * Leitura pelo Gemini (Google AI Studio).
 *
 * É o provedor padrão porque tem camada gratuita com folga de sobra pro volume
 * dela — algumas dezenas de leituras por mês contra um teto diário na casa das
 * centenas.
 *
 * ⚠️ Na camada gratuita o Google usa o conteúdo enviado pra melhorar os
 * produtos dele, e revisores humanos podem ler. Isso está documentado na página
 * de preços do Gemini. Vale pra foto de cupom e de receita; a leitura de
 * conversa do WhatsApp leva nome e telefone de cliente junto, então essa é a
 * que merece a decisão consciente de quem configura.
 */

/**
 * Modelo com camada gratuita, visão e saída estruturada.
 *
 * Flash e não Pro de propósito: as três leituras são extração, não raciocínio
 * longo — e o Pro não tem camada gratuita.
 */
export const MODELO_GEMINI = "gemini-3.7-flash";

let clienteCache: GoogleGenAI | null = null;

function cliente(): GoogleGenAI {
  const chave = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!chave) throw new IaIndisponivelError();

  clienteCache ??= new GoogleGenAI({ apiKey: chave });
  return clienteCache;
}

export async function extrairComGemini<T>({
  sistema,
  conteudo,
  esquema,
  aoFalhar,
  esforco = "baixo",
}: PedidoIa<T>): Promise<T> {
  const resposta = await cliente().interactions.create({
    model: MODELO_GEMINI,
    system_instruction: sistema,
    input: conteudo.map((parte) =>
      parte.tipo === "texto"
        ? { type: "text" as const, text: parte.texto }
        : {
            type: "image" as const,
            data: parte.base64,
            mime_type: parte.tipoDeImagem,
          },
    ),
    generation_config: {
      max_output_tokens: 8000,
      thinking_level: esforco === "medio" ? "medium" : "low",
    },
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: paraEsquemaGemini(esquema),
    },
  });

  const texto = resposta.output_text;
  if (!texto) throw new Error(aoFalhar);

  // O schema é só o pedido; quem garante o formato é o Zod, aqui.
  const resultado = esquema.safeParse(seguroJson(texto, aoFalhar));
  if (!resultado.success) throw new Error(aoFalhar);

  return resultado.data;
}

function seguroJson(texto: string, aoFalhar: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(aoFalhar);
  }
}
