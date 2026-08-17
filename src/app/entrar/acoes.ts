"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { conferirSenha, iniciarSessao } from "@/lib/auth";

const esquema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail."),
  senha: z.string().min(1, "Informe a senha."),
  // `formData.get` devolve null (não undefined) quando o campo não existe,
  // então precisa ser nullish — só `optional()` rejeitaria o login normal.
  voltar: z.string().nullish(),
});

export type EstadoLogin = { erro?: string };

/**
 * A mensagem de erro é sempre a mesma ("e-mail ou senha incorretos") de
 * propósito: dizer "esse e-mail não existe" entregaria pra um curioso quais
 * contas são válidas.
 */
export async function entrar(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const dados = esquema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
    voltar: formData.get("voltar"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { email, senha, voltar } = dados.data;

  const usuario = await prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!usuario || !usuario.ativo) {
    // Gasta o mesmo tempo de um bcrypt real pra não dar pra descobrir, pelo
    // tempo de resposta, se o e-mail existe.
    await conferirSenha(senha, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return { erro: "E-mail ou senha incorretos." };
  }

  if (!(await conferirSenha(senha, usuario.senhaHash))) {
    return { erro: "E-mail ou senha incorretos." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLogin: new Date() },
  });

  await iniciarSessao({
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
  });

  // Só aceita caminho interno — impede redirecionar pra site de fora
  const destino = voltar?.startsWith("/") && !voltar.startsWith("//") ? voltar : "/";
  redirect(destino);
}

export async function sair() {
  const { encerrarSessao } = await import("@/lib/auth");
  await encerrarSessao();
  redirect("/entrar");
}
