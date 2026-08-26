import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { IaIndisponivelError, type PedidoIa } from "./cliente";

/**
 * Leitura pela Claude (Anthropic).
 *
 * Não é o padrão porque é paga, mas fica de pé: se a leitura do Gemini errar
 * demais em cupom amassado ou letra de mão, trocar de provedor é apagar uma
 * variável de ambiente e pôr a outra — nenhuma linha de instrução ou de
 * validação muda de lugar.
 *
 * Diferente da camada gratuita do Gemini, aqui o conteúdo enviado não é usado
 * pra treinar modelo. Pra leitura de conversa do WhatsApp, que leva nome e
 * telefone de cliente, essa diferença é o argumento a favor.
 */

export const MODELO_CLAUDE = "claude-opus-5";

let clienteCache: Anthropic | null = null;

function cliente(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new IaIndisponivelError();

  clienteCache ??= new Anthropic();
  return clienteCache;
}

export async function extrairComClaude<T>({
  sistema,
  conteudo,
  esquema,
  aoFalhar,
}: PedidoIa<T>): Promise<T> {
  const resposta = await cliente().messages.parse({
    model: MODELO_CLAUDE,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: sistema,
    messages: [
      {
        role: "user",
        content: conteudo.map((parte) =>
          parte.tipo === "texto"
            ? { type: "text" as const, text: parte.texto }
            : {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: parte.tipoDeImagem,
                  data: parte.base64,
                },
              },
        ),
      },
    ],
    output_config: { format: zodOutputFormat(esquema) },
  });

  if (!resposta.parsed_output) throw new Error(aoFalhar);

  return resposta.parsed_output as T;
}
