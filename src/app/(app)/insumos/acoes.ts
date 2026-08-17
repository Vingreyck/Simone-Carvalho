"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { normalizarUnidade } from "@/lib/unidades";
import { CATEGORIAS, UNIDADES } from "@/lib/constantes";

export type Resultado = { ok: boolean; erro?: string; id?: string };

const esquemaInsumo = z.object({
  id: z.string().nullish(),
  nome: z
    .string()
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 letras.")
    .max(80, "Nome muito longo."),
  categoria: z.enum(CATEGORIAS as [string, ...string[]]),
  unidadeBase: z.enum(UNIDADES as [string, ...string[]]),
  estoqueMinimo: z.coerce.number().min(0, "Não pode ser negativo.").default(0),
  perecivel: z.coerce.boolean().default(false),
  marcaPreferida: z.string().trim().max(80).nullish(),
  observacao: z.string().trim().max(500).nullish(),
});

/**
 * Cria ou edita um insumo.
 *
 * A unidade base só pode mudar enquanto não houver estoque nem uso em receita:
 * trocar de "gramas" pra "unidades" com 5.000 g em estoque transformaria o saldo
 * em 5.000 ovos e bagunçaria todo custo já calculado.
 */
export async function salvarInsumo(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquemaInsumo.safeParse({
    id: formData.get("id"),
    nome: formData.get("nome"),
    categoria: formData.get("categoria"),
    unidadeBase: formData.get("unidadeBase"),
    estoqueMinimo: formData.get("estoqueMinimo") || 0,
    perecivel: formData.get("perecivel") === "on",
    marcaPreferida: formData.get("marcaPreferida"),
    observacao: formData.get("observacao"),
  });

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { id, nome, ...resto } = dados.data;

  try {
    if (id) {
      const atual = await prisma.insumo.findUnique({
        where: { id },
        select: {
          unidadeBase: true,
          _count: { select: { lotes: true, receitaItens: true } },
        },
      });

      if (!atual) return { ok: false, erro: "Insumo não encontrado." };

      const trocouUnidade = atual.unidadeBase !== resto.unidadeBase;
      const temHistorico =
        atual._count.lotes > 0 || atual._count.receitaItens > 0;

      if (trocouUnidade && temHistorico) {
        return {
          ok: false,
          erro:
            "Não dá pra trocar a unidade deste insumo: ele já tem estoque ou está " +
            "em alguma receita. Crie um insumo novo com a unidade certa.",
        };
      }

      await prisma.insumo.update({
        where: { id },
        data: {
          nome,
          ...resto,
          categoria: resto.categoria as never,
          unidadeBase: resto.unidadeBase as never,
        },
      });

      revalidatePath("/insumos");
      revalidatePath(`/insumos/${id}`);
      return { ok: true, id };
    }

    const criado = await prisma.insumo.create({
      data: {
        nome,
        ...resto,
        categoria: resto.categoria as never,
        unidadeBase: resto.unidadeBase as never,
      },
      select: { id: true },
    });

    revalidatePath("/insumos");
    return { ok: true, id: criado.id };
  } catch (erro) {
    if (erroDeNomeDuplicado(erro)) {
      return { ok: false, erro: `Já existe um insumo chamado "${nome}".` };
    }
    throw erro;
  }
}

const esquemaEquivalencia = z.object({
  insumoId: z.string().min(1),
  nome: z
    .string()
    .trim()
    .min(1, "Dê um nome à medida (ex.: xícara).")
    .max(40),
  quantidadeBase: z.coerce
    .number()
    .positive("A quantidade precisa ser maior que zero."),
});

/** Cadastra "1 xícara = 120 g" para um insumo. */
export async function salvarEquivalencia(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSessao();

  const dados = esquemaEquivalencia.safeParse({
    insumoId: formData.get("insumoId"),
    nome: formData.get("nome"),
    quantidadeBase: formData.get("quantidadeBase"),
  });

  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { insumoId, nome, quantidadeBase } = dados.data;

  // Evita "Xícara" e "xicara" virarem duas medidas diferentes
  const jaExiste = await prisma.insumoEquivalencia.findMany({
    where: { insumoId },
    select: { id: true, nome: true },
  });

  const conflito = jaExiste.find(
    (e) => normalizarUnidade(e.nome) === normalizarUnidade(nome),
  );

  if (conflito) {
    await prisma.insumoEquivalencia.update({
      where: { id: conflito.id },
      data: { quantidadeBase },
    });
  } else {
    await prisma.insumoEquivalencia.create({
      data: { insumoId, nome, quantidadeBase },
    });
  }

  revalidatePath(`/insumos/${insumoId}`);
  return { ok: true };
}

export async function excluirEquivalencia(
  id: string,
  insumoId: string,
): Promise<Resultado> {
  await exigirSessao();

  await prisma.insumoEquivalencia.delete({ where: { id } });
  revalidatePath(`/insumos/${insumoId}`);
  return { ok: true };
}

/**
 * Arquiva em vez de apagar. Insumo com histórico de compra não pode sumir —
 * o custo das produções antigas ficaria órfão.
 */
export async function alternarAtivoInsumo(
  id: string,
  ativo: boolean,
): Promise<Resultado> {
  await exigirSessao();

  await prisma.insumo.update({ where: { id }, data: { ativo } });

  revalidatePath("/insumos");
  revalidatePath(`/insumos/${id}`);
  return { ok: true };
}

function erroDeNomeDuplicado(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "code" in erro &&
    (erro as { code?: string }).code === "P2002"
  );
}
