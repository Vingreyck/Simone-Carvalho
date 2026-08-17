import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { prisma } from "./db";
import {
  COOKIE_SESSAO,
  MAX_AGE_SESSAO,
  assinarSessao,
  lerToken,
  type DadosSessao,
} from "./sessao";

/**
 * Autenticação do sistema.
 *
 * É de uso pessoal da Simone, mas o cuidado é o mesmo de um sistema público:
 * senha com hash, cookie httpOnly (JavaScript da página não lê), SameSite=Lax
 * (protege contra CSRF) e Secure em produção.
 */

const CUSTO_BCRYPT = 12;

export async function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

export async function conferirSenha(
  senha: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export async function iniciarSessao(dados: DadosSessao): Promise<void> {
  const token = await assinarSessao(dados);
  const jar = await cookies();

  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SESSAO,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
}

/** Sessão atual, ou null. Não redireciona — use quando o acesso for opcional. */
export async function sessaoAtual(): Promise<DadosSessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  return lerToken(token);
}

/**
 * Sessão obrigatória. Manda pro login se não houver.
 * O middleware já barra antes, mas repetir aqui garante que uma Server Action
 * nunca rode sem dono — middleware não protege Server Actions sozinho.
 */
export async function exigirSessao(): Promise<DadosSessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  return sessao;
}

/**
 * Confere se a usuária ainda existe e está ativa no banco.
 * Use nos pontos sensíveis — o token sozinho continuaria válido por 30 dias
 * mesmo se a conta fosse desativada.
 */
export async function exigirUsuarioAtivo() {
  const sessao = await exigirSessao();

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { id: true, nome: true, email: true, ativo: true },
  });

  if (!usuario?.ativo) {
    await encerrarSessao();
    redirect("/entrar");
  }

  return usuario;
}
