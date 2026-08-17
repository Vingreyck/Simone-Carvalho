"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { conferirSenha, exigirSessao, gerarHashSenha } from "@/lib/auth";

export type Resultado = { ok: boolean; erro?: string };

const esquemaPrecificacao = z.object({
  valorHoraMaoDeObra: z.coerce.number().min(0, "Não pode ser negativo."),
  percentualCustosFixos: z.coerce.number().min(0).max(99, "Máximo 99%."),
  percentualImpostos: z.coerce.number().min(0).max(99, "Máximo 99%."),
  percentualTaxaCartao: z.coerce.number().min(0).max(99, "Máximo 99%."),
  margemLucroPadrao: z.coerce.number().min(0).max(99, "Máximo 99%."),
  faturamentoMedioMensal: z.coerce.number().min(0),
  alertaVariacaoPreco: z.coerce.number().min(0).max(100),
  diasAlertaValidade: z.coerce.number().int().min(0).max(365),
});

export async function salvarPrecificacao(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquemaPrecificacao.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const soma =
    dados.data.percentualCustosFixos +
    dados.data.percentualImpostos +
    dados.data.percentualTaxaCartao +
    dados.data.margemLucroPadrao;

  // Sem essa guarda, a divisão do markup daria zero ou negativo e nenhum preço
  // fecharia a conta — melhor barrar aqui e explicar.
  if (soma >= 100) {
    return {
      ok: false,
      erro:
        `Custos fixos + impostos + cartão + margem somam ${soma.toFixed(1)}%. ` +
        "Como todos incidem sobre o preço de venda, a soma precisa ficar abaixo " +
        "de 100% — senão nenhum preço fecha a conta.",
    };
  }

  await prisma.configPrecificacao.upsert({
    where: { id: "default" },
    update: dados.data,
    create: { id: "default", ...dados.data },
  });

  revalidatePath("/ajustes");
  revalidatePath("/produtos");
  revalidatePath("/");

  return { ok: true };
}

const esquemaNegocio = z.object({
  nomeFantasia: z.string().trim().min(1, "Informe o nome.").max(80),
  telefone: z.string().trim().max(30).nullish(),
  whatsapp: z.string().trim().max(30).nullish(),
  instagram: z.string().trim().max(60).nullish(),
  endereco: z.string().trim().max(200).nullish(),
  cnpj: z.string().trim().max(20).nullish(),
});

export async function salvarNegocio(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquemaNegocio.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.configNegocio.upsert({
    where: { id: "default" },
    update: dados.data,
    create: { id: "default", ...dados.data },
  });

  revalidatePath("/ajustes");
  return { ok: true };
}

const esquemaSenha = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual."),
    senhaNova: z
      .string()
      .min(8, "A senha nova precisa ter pelo menos 8 caracteres."),
    confirmacao: z.string().min(1, "Repita a senha nova."),
  })
  .refine((d) => d.senhaNova === d.confirmacao, {
    message: "A confirmação não bate com a senha nova.",
    path: ["confirmacao"],
  });

export async function trocarSenha(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const sessao = await exigirSessao();

  const dados = esquemaSenha.safeParse(Object.fromEntries(formData.entries()));

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { senhaHash: true },
  });

  if (!usuario) return { ok: false, erro: "Usuária não encontrada." };

  if (!(await conferirSenha(dados.data.senhaAtual, usuario.senhaHash))) {
    return { ok: false, erro: "A senha atual está errada." };
  }

  await prisma.usuario.update({
    where: { id: sessao.usuarioId },
    data: { senhaHash: await gerarHashSenha(dados.data.senhaNova) },
  });

  return { ok: true };
}
