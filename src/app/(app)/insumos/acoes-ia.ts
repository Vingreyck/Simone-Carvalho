"use server";

import { exigirSessao } from "@/lib/auth";
import { lerRotulo } from "@/lib/ia/extracoes";
import {
  ehTipoDeImagemValido,
  traduzirErro,
  TAMANHO_MAXIMO_IMAGEM,
} from "@/lib/ia/cliente";
import { interpretarAlergeno } from "@/lib/alergenos";
import type { Alergeno } from "@/generated/prisma/enums";

export type LeituraDoRotulo = {
  ok: boolean;
  erro?: string;
  contem?: Alergeno[];
  podeConter?: Alergeno[];
  /** A frase como está na embalagem, pra ela conferir contra a foto */
  frase?: string | null;
  /** Palavras que a IA leu mas o sistema não reconheceu como alergênico */
  naoEntendi?: string[];
  achouAviso?: boolean;
};

/**
 * Foto do rótulo → alergênicos marcados no formulário.
 *
 * Como todas as leituras do sistema, **não grava nada**: devolve pro formulário
 * já marcado, e ela confere contra a foto antes de salvar.
 *
 * O que a IA não conseguir traduzir vem em `naoEntendi` em vez de sumir. Num
 * campo que existe por causa de alergia, sumir em silêncio é o pior desfecho
 * possível — ela precisa saber que sobrou coisa pra olhar.
 */
export async function lerRotuloDoInsumo(
  formData: FormData,
): Promise<LeituraDoRotulo> {
  await exigirSessao();

  const arquivo = formData.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Escolha uma foto do rótulo." };
  }

  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
    return { ok: false, erro: "A foto ficou grande demais. Tente de novo." };
  }

  if (!ehTipoDeImagemValido(arquivo.type)) {
    return { ok: false, erro: "Formato de imagem não aceito. Use JPG ou PNG." };
  }

  try {
    const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
    const rotulo = await lerRotulo(base64, arquivo.type);

    if (!rotulo.achouAviso) {
      return {
        ok: false,
        erro:
          "Não achei a parte dos alergênicos nesta foto. Ela costuma ficar " +
          "logo depois dos ingredientes, em letra maiúscula. Tente de novo " +
          "mais perto.",
      };
    }

    const naoEntendi: string[] = [];

    const traduzir = (lista: string[]): Alergeno[] => {
      const saida: Alergeno[] = [];
      for (const texto of lista) {
        const alergeno = interpretarAlergeno(texto);
        if (alergeno) saida.push(alergeno);
        else if (texto.trim()) naoEntendi.push(texto.trim());
      }
      return [...new Set(saida)];
    };

    return {
      ok: true,
      contem: traduzir(rotulo.contem),
      podeConter: traduzir(rotulo.podeConter),
      frase: rotulo.frase,
      naoEntendi: [...new Set(naoEntendi)],
      achouAviso: true,
    };
  } catch (erro) {
    return { ok: false, erro: traduzirErro(erro) };
  }
}
