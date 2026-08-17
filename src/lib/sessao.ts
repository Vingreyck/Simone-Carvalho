import { SignJWT, jwtVerify } from "jose";

/**
 * Assinatura e leitura do token de sessão.
 *
 * Fica separado do `auth.ts` de propósito: o middleware roda no Edge Runtime,
 * onde não existe bcrypt nem acesso ao banco. Aqui só tem `jose`, que roda
 * nos dois lados.
 */

export const COOKIE_SESSAO = "doceria_sessao";
const DURACAO_DIAS = 30;

export type DadosSessao = {
  usuarioId: string;
  nome: string;
  email: string;
};

function chave(): Uint8Array {
  const segredo = process.env.AUTH_SECRET;

  if (!segredo || segredo.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres). " +
        'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    );
  }

  return new TextEncoder().encode(segredo);
}

export async function assinarSessao(dados: DadosSessao): Promise<string> {
  return new SignJWT({ nome: dados.nome, email: dados.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(dados.usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(chave());
}

export async function lerToken(token: string): Promise<DadosSessao | null> {
  try {
    const { payload } = await jwtVerify(token, chave(), {
      algorithms: ["HS256"],
    });

    if (!payload.sub) return null;

    return {
      usuarioId: payload.sub,
      nome: String(payload.nome ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    // Token expirado, adulterado ou assinado com outro segredo → sem sessão.
    return null;
  }
}

export const MAX_AGE_SESSAO = DURACAO_DIAS * 24 * 60 * 60;
