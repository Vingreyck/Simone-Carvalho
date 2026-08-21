"use server";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { lerReceita } from "@/lib/ia/extracoes";
import {
  TAMANHO_MAXIMO_IMAGEM,
  ehTipoDeImagemValido,
  traduzirErro,
} from "@/lib/ia/cliente";
import { CONFIANCA_ALTA, casarInsumo } from "@/lib/correspondencia";

export type IngredienteLido = {
  /** Como ela escreveu na receita */
  descricao: string;
  insumoId: string | null;
  insumoNome: string | null;
  confiante: boolean;
  quantidade: number;
  unidade: string;
};

export type ReceitaLida = {
  ok: boolean;
  erro?: string;
  nome?: string;
  rendimentoQuantidade?: number;
  rendimentoUnidade?: string;
  tempoPreparoMin?: number;
  modoPreparo?: string | null;
  ingredientes?: IngredienteLido[];
};

async function montarResposta(
  extraida: Awaited<ReturnType<typeof lerReceita>>,
): Promise<ReceitaLida> {
  const insumos = await prisma.insumo.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
  });

  const ingredientes: IngredienteLido[] = extraida.ingredientes.map((ing) => {
    const casado = casarInsumo(ing.nome, insumos);

    return {
      descricao: ing.nome,
      insumoId: casado?.id ?? null,
      insumoNome: casado?.nome ?? null,
      confiante: (casado?.confianca ?? 0) >= CONFIANCA_ALTA,
      quantidade: ing.quantidade,
      unidade: ing.unidade,
    };
  });

  return {
    ok: true,
    nome: extraida.nome,
    rendimentoQuantidade: extraida.rendimentoQuantidade,
    rendimentoUnidade: extraida.rendimentoUnidade,
    tempoPreparoMin: extraida.tempoPreparoMin,
    modoPreparo: extraida.modoPreparo,
    ingredientes,
  };
}

/**
 * Lê a receita de uma foto do caderno.
 *
 * É o atalho que destrava a adoção: ela tem dezenas de receitas escritas à mão,
 * e digitar todas uma a uma é o tipo de tarefa que faz desistir do sistema
 * antes de ver valor.
 */
export async function lerReceitaDaFoto(formData: FormData): Promise<ReceitaLida> {
  await exigirSessao();

  const arquivo = formData.get("foto");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Nenhuma foto foi enviada." };
  }

  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
    return { ok: false, erro: "A foto ficou grande demais. Tente de novo." };
  }

  if (!ehTipoDeImagemValido(arquivo.type)) {
    return { ok: false, erro: "Formato de imagem não aceito. Use JPG ou PNG." };
  }

  try {
    const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
    const extraida = await lerReceita({
      tipo: "imagem",
      base64,
      tipoDeImagem: arquivo.type,
    });

    return montarResposta(extraida);
  } catch (erro) {
    return { ok: false, erro: traduzirErro(erro) };
  }
}

/** Mesmo caminho, mas a partir do que ela escreveu ou ditou. */
export async function lerReceitaDoTexto(texto: string): Promise<ReceitaLida> {
  await exigirSessao();

  if (!texto.trim()) {
    return { ok: false, erro: "Escreva a receita primeiro." };
  }

  try {
    return montarResposta(await lerReceita({ tipo: "texto", texto }));
  } catch (erro) {
    return { ok: false, erro: traduzirErro(erro) };
  }
}
