import "server-only";

import type { z } from "zod";

/**
 * A camada de IA.
 *
 * Só é acionada quando alguém realmente usa um atalho — assim o sistema inteiro
 * continua funcionando sem chave nenhuma. Foto do cupom, ficha por foto e
 * leitura do WhatsApp são atalhos: se faltarem, ela digita como sempre digitou.
 *
 * Existem dois provedores atrás da mesma porta. Quem escolhe é a variável de
 * ambiente que estiver preenchida — o resto do sistema não sabe (nem precisa
 * saber) qual está em uso. Os textos das instruções e os esquemas de validação
 * vivem num lugar só, em `extracoes.ts` e `esquemas.ts`; aqui embaixo muda
 * apenas o transporte.
 */

export class IaIndisponivelError extends Error {
  constructor() {
    super(
      "O atalho com inteligência artificial não está configurado. " +
        "Você pode preencher na mão normalmente.",
    );
    this.name = "IaIndisponivelError";
  }
}

export type Provedor = "gemini" | "claude";

/**
 * Qual provedor usar.
 *
 * O Gemini vem primeiro porque tem camada gratuita: se as duas chaves
 * estiverem configuradas, o padrão é não gastar.
 */
export function provedorAtivo(): Provedor | null {
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

export function iaEstaConfigurada(): boolean {
  return provedorAtivo() !== null;
}

/** Um pedaço do que é enviado pra leitura: texto ou foto. */
export type ConteudoIa =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagem"; base64: string; tipoDeImagem: TipoDeImagem };

export type PedidoIa<T> = {
  /** As regras de leitura — o que o modelo deve e não deve fazer */
  sistema: string;
  conteudo: ConteudoIa[];
  /** O contrato: nada que não caiba aqui chega perto do banco */
  esquema: z.ZodType<T>;
  /** Mensagem pra ela quando a resposta não veio no formato */
  aoFalhar: string;
  /**
   * Quanto o modelo deve "pensar" antes de responder.
   *
   * Cupom impresso é leitura direta. Receita em caderno é letra de mão, com
   * fração e abreviação — ali vale pagar mais atenção, porque número errado
   * aqui vira preço errado lá na frente.
   */
  esforco?: "baixo" | "medio";
};

/**
 * Manda ler e devolve já validado.
 *
 * Os provedores ficam em import dinâmico porque só um dos dois SDKs vai ser
 * usado numa instalação — não faz sentido carregar os dois.
 */
export async function extrair<T>(pedido: PedidoIa<T>): Promise<T> {
  const provedor = provedorAtivo();
  if (!provedor) throw new IaIndisponivelError();

  if (provedor === "gemini") {
    const { extrairComGemini } = await import("./provedor-gemini");
    return extrairComGemini(pedido);
  }

  const { extrairComClaude } = await import("./provedor-claude");
  return extrairComClaude(pedido);
}

/**
 * Erros da API viram mensagem que ela entende.
 *
 * Ninguém na cozinha precisa saber o que é 429 — precisa saber se tenta de
 * novo, se espera, ou se digita na mão.
 */
export function traduzirErro(erro: unknown): string {
  if (erro instanceof IaIndisponivelError) return erro.message;

  const status = statusHttp(erro);

  if (status === 429) {
    return (
      "A leitura automática atingiu o limite de uso por agora. " +
      "Tente de novo daqui a pouco — ou preencha na mão."
    );
  }

  if (status === 401 || status === 403) {
    return "A chave do serviço de leitura automática está inválida. Avise o Vinícius.";
  }

  if (status === 400) {
    return "O serviço não aceitou o pedido de leitura. Avise o Vinícius.";
  }

  if (status !== null && status >= 500) {
    return "O serviço de leitura automática está fora do ar. Tente mais tarde ou preencha na mão.";
  }

  if (erro instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(erro.message)) {
    return "Não consegui falar com o serviço de leitura. Confira sua internet.";
  }

  return "Não consegui ler. Tente uma foto mais nítida, ou preencha na mão.";
}

/**
 * O código HTTP, venha ele de qual SDK vier.
 *
 * Os dois guardam o número em campos diferentes (`status` no Google,
 * `status` também no Anthropic, mas por caminhos distintos), e nenhum dos dois
 * vale um import estático aqui só pra checar um `instanceof`.
 */
function statusHttp(erro: unknown): number | null {
  if (typeof erro !== "object" || erro === null) return null;

  const candidato = erro as { status?: unknown; statusCode?: unknown };
  const valor = candidato.status ?? candidato.statusCode;

  return typeof valor === "number" ? valor : null;
}

/** Tipos de imagem aceitos pelos dois provedores. */
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
