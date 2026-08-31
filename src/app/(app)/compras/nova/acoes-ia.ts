"use server";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { lerCupomFiscal } from "@/lib/ia/extracoes";
import {
  TAMANHO_MAXIMO_IMAGEM,
  ehTipoDeImagemValido,
  traduzirErro,
} from "@/lib/ia/cliente";
import { CONFIANCA_ALTA, casarInsumo } from "@/lib/correspondencia";
import { normalizarTexto } from "@/lib/format";
import { normalizarUnidade } from "@/lib/unidades";
import type { UnidadeBase } from "@/generated/prisma/enums";

export type ItemLido = {
  /** Como veio escrito no cupom — fica visível pra ela conferir */
  descricao: string;
  insumoId: string | null;
  insumoNome: string | null;
  /** true quando o casamento é bom o bastante pra não precisar de atenção */
  confiante: boolean;
  quantidade: number;
  tamanhoEmbalagem: number;
  unidade: string;
  valorTotal: number;
  /**
   * Preenchido quando o item não existe no cadastro dela.
   *
   * O insumo NÃO é criado aqui — só quando ela confirmar a compra. Assim a
   * regra continua valendo: a IA propõe, ela decide, e uma foto lida errado
   * não deixa lixo no cadastro.
   */
  novoInsumo?: { nome: string; unidadeBase: UnidadeBase } | null;
};

/**
 * "kg" → gramas, "l" → mililitros, "dz" → unidades.
 *
 * A unidade base é a decisão mais difícil de desfazer num insumo (trocar depois
 * exige não ter estoque nem receita), então erra pro lado do que a embalagem
 * diz: quem compra em kg mede em grama.
 */
function unidadeBaseDe(unidade: string): UnidadeBase {
  const u = normalizarUnidade(unidade);

  if (["kg", "g", "grama", "quilo", "mg"].includes(u)) return "G";
  if (["l", "ml", "litro", "mililitro"].includes(u)) return "ML";
  return "UN";
}

export type CupomLido = {
  ok: boolean;
  erro?: string;
  fornecedor?: string | null;
  data?: string | null;
  notaFiscal?: string | null;
  itens?: ItemLido[];
  /** Total impresso no cupom — pra ela conferir contra a soma */
  valorTotalDoCupom?: number | null;
};

/**
 * Lê a foto do cupom e devolve uma PROPOSTA de compra.
 *
 * Não grava nada: o resultado abre no formulário normal, preenchido, e ela
 * confere antes de confirmar. Um "1,5 kg" lido como "15 kg" corromperia o custo
 * médio do insumo e, por tabela, o preço de todo produto que o usa.
 */
export async function lerCupom(formData: FormData): Promise<CupomLido> {
  await exigirSessao();

  const arquivo = formData.get("foto");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Nenhuma foto foi enviada." };
  }

  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
    return {
      ok: false,
      erro: "A foto ficou grande demais. Tente tirar de novo, mais de perto.",
    };
  }

  if (!ehTipoDeImagemValido(arquivo.type)) {
    return {
      ok: false,
      erro: "Formato de imagem não aceito. Use uma foto JPG ou PNG.",
    };
  }

  try {
    const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
    const cupom = await lerCupomFiscal(base64, arquivo.type);

    const [insumos, apelidos] = await Promise.all([
      prisma.insumo.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
      }),
      prisma.apelidoInsumo.findMany({ select: { texto: true, insumoId: true } }),
    ]);

    const mapaApelidos = new Map(apelidos.map((a) => [a.texto, a.insumoId]));

    const itens: ItemLido[] = cupom.itens.map((item) => {
      const casado = casarInsumo(item.descricao, insumos, mapaApelidos);

      return {
        descricao: item.descricao,
        insumoId: casado?.id ?? null,
        insumoNome: casado?.nome ?? null,
        confiante: (casado?.confianca ?? 0) >= CONFIANCA_ALTA,
        quantidade: item.quantidade,
        tamanhoEmbalagem: item.tamanhoEmbalagem,
        unidade: item.unidade,
        valorTotal: item.valorTotal,
        // Não casou com nada: propõe criar, com o nome limpo que a IA sugeriu
        novoInsumo: casado
          ? null
          : {
              nome: (item.nomeLimpo || item.descricao).trim(),
              unidadeBase: unidadeBaseDe(item.unidade),
            },
      };
    });

    return {
      ok: true,
      fornecedor: cupom.fornecedor,
      data: cupom.data,
      notaFiscal: cupom.notaFiscal,
      itens,
      valorTotalDoCupom: cupom.valorTotal,
    };
  } catch (erro) {
    return { ok: false, erro: traduzirErro(erro) };
  }
}

/**
 * Guarda como aquele fornecedor escreve o nome de um insumo.
 *
 * Chamado quando ela confirma a compra: cada linha que veio do cupom ensina o
 * sistema. Da próxima vez, aquele texto casa direto, sem depender de semelhança.
 */
export async function aprenderApelidos(
  pares: { descricao: string; insumoId: string }[],
): Promise<void> {
  await exigirSessao();

  for (const par of pares) {
    const texto = normalizarTexto(par.descricao);
    if (!texto) continue;

    await prisma.apelidoInsumo.upsert({
      where: { texto },
      update: { insumoId: par.insumoId, vezesUsado: { increment: 1 } },
      create: {
        texto,
        textoOriginal: par.descricao,
        insumoId: par.insumoId,
      },
    });
  }
}
