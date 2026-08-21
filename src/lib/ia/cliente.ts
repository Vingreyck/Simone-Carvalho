import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Cliente da IA.
 *
 * Só é criado quando alguém realmente usa uma função de IA — assim o sistema
 * inteiro continua funcionando sem a chave configurada. Foto do cupom, ficha
 * por foto e leitura do WhatsApp são atalhos: se faltarem, ela digita como
 * sempre digitou.
 */

let clienteCache: Anthropic | null = null;

export class IaIndisponivelError extends Error {
  constructor() {
    super(
      "O atalho com inteligência artificial não está configurado. " +
        "Você pode preencher na mão normalmente.",
    );
    this.name = "IaIndisponivelError";
  }
}

export function iaEstaConfigurada(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function cliente(): Anthropic {
  if (!iaEstaConfigurada()) throw new IaIndisponivelError();

  clienteCache ??= new Anthropic();
  return clienteCache;
}

/** Modelo usado em todas as extrações. */
export const MODELO = "claude-opus-5";

/**
 * Erros da API viram mensagem que ela entende.
 *
 * Ninguém na cozinha precisa saber o que é 429 — precisa saber se tenta de
 * novo ou se digita na mão.
 */
export function traduzirErro(erro: unknown): string {
  if (erro instanceof IaIndisponivelError) return erro.message;

  if (erro instanceof Anthropic.RateLimitError) {
    return "O serviço está ocupado agora. Espere um minuto e tente de novo — ou preencha na mão.";
  }

  if (erro instanceof Anthropic.AuthenticationError) {
    return "A chave do serviço de leitura automática está inválida. Avise o Vinícius.";
  }

  if (erro instanceof Anthropic.APIConnectionError) {
    return "Não consegui falar com o serviço de leitura. Confira sua internet.";
  }

  if (erro instanceof Anthropic.APIError) {
    return "O serviço de leitura automática falhou. Tente de novo ou preencha na mão.";
  }

  return "Não consegui ler. Tente uma foto mais nítida, ou preencha na mão.";
}

/** Tipos de imagem que a API aceita. */
export const TIPOS_DE_IMAGEM = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type TipoDeImagem = (typeof TIPOS_DE_IMAGEM)[number];

export function ehTipoDeImagemValido(tipo: string): tipo is TipoDeImagem {
  return (TIPOS_DE_IMAGEM as readonly string[]).includes(tipo);
}

/**
 * Limite de tamanho da foto.
 *
 * Foto de celular moderno passa fácil de 5 MB, e imagem grande custa mais
 * token sem melhorar a leitura. O navegador reduz antes de enviar; isso aqui
 * é a rede de segurança do lado do servidor.
 */
export const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024;
