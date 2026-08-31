import "server-only";

import { extrair, type ConteudoIa, type TipoDeImagem } from "./cliente";
import {
  CupomSchema,
  PedidoExtraidoSchema,
  ReceitaExtraidaSchema,
  RotuloSchema,
  type Cupom,
  type PedidoExtraido,
  type ReceitaExtraida,
  type Rotulo,
} from "./esquemas";

/**
 * As três leituras automáticas.
 *
 * Regra que vale pras três: **a IA nunca grava nada**. Ela devolve uma proposta
 * que abre preenchida numa tela de conferência. Um "1,5 kg" lido como "15 kg"
 * corromperia o custo médio, que corromperia o preço de todo produto que usa
 * aquele insumo — e ela não teria como descobrir por quê.
 *
 * As instruções abaixo valem pra qualquer provedor: quem troca Gemini por
 * Claude não mexe em nada deste arquivo.
 */

/** Instrução comum: é melhor deixar em branco do que chutar. */
const NA_DUVIDA_DEIXE_VAZIO =
  "Se algum dado não estiver visível ou você não tiver certeza, use null ou 0. " +
  "NUNCA invente ou estime um valor — quem confere é uma pessoa, e um número " +
  "chutado passa despercebido mais fácil que um campo vazio.";

export async function lerCupomFiscal(
  imagemBase64: string,
  tipoDeImagem: TipoDeImagem,
): Promise<Cupom> {
  return extrair({
    esquema: CupomSchema,
    aoFalhar: "Não consegui entender o cupom.",
    sistema:
      "Você lê cupons fiscais e notas de compra de uma doceria brasileira e " +
      "extrai os itens comprados.\n\n" +
      "Regras:\n" +
      "- Transcreva a descrição EXATAMENTE como está no cupom, com as " +
      "abreviações do mercado (ex.: 'ACUC REFINADO UNIAO 1KG'). Não traduza " +
      "nem normalize — quem confere precisa reconhecer a linha.\n" +
      "- Em nomeLimpo, escreva o mesmo produto como uma confeiteira o chamaria: " +
      "'ACUC REFINADO UNIAO 1KG' vira 'Açúcar refinado'. SEM marca, SEM peso, " +
      "sem caixa alta. É o nome que pode virar um item permanente no cadastro " +
      "dela, então escreva como ela escreveria.\n" +
      "- Separe quantidade de embalagens do tamanho de cada uma: '2x SACO " +
      "FARINHA 5KG' é quantidade 2, tamanhoEmbalagem 5, unidade 'kg'.\n" +
      "- Quando a linha não indicar tamanho de embalagem, use tamanhoEmbalagem 1 " +
      "e a unidade que fizer sentido ('un' para itens contados).\n" +
      "- A unidade DEVE ser uma destas, sem abreviar: kg, g, l, ml, un, dúzia. " +
      "Traduza a abreviação do cupom para uma delas — 'DZ' vira 'dúzia', 'UND' " +
      "e 'PCT' viram 'un'. Qualquer outra coisa o sistema não sabe converter.\n" +
      "- valorTotal é o total daquela linha (já multiplicado pela quantidade), " +
      "não o preço unitário.\n" +
      "- Ignore linhas que não são produto: desconto, troco, subtotal, tributos, " +
      "formas de pagamento.\n" +
      "- Data no formato AAAA-MM-DD.\n\n" +
      NA_DUVIDA_DEIXE_VAZIO,
    conteudo: [
      { tipo: "imagem", base64: imagemBase64, tipoDeImagem },
      { tipo: "texto", texto: "Extraia os itens deste cupom." },
    ],
  });
}

export async function lerReceita(
  entrada:
    | { tipo: "texto"; texto: string }
    | { tipo: "imagem"; base64: string; tipoDeImagem: TipoDeImagem },
): Promise<ReceitaExtraida> {
  const conteudo: ConteudoIa[] =
    entrada.tipo === "texto"
      ? [
          {
            tipo: "texto",
            texto: `Transforme esta receita em ficha técnica:\n\n${entrada.texto}`,
          },
        ]
      : [
          {
            tipo: "imagem",
            base64: entrada.base64,
            tipoDeImagem: entrada.tipoDeImagem,
          },
          { tipo: "texto", texto: "Transforme esta receita em ficha técnica." },
        ];

  return extrair({
    esquema: ReceitaExtraidaSchema,
    aoFalhar: "Não consegui entender a receita.",
    // Caderno é letra de mão, com fração e abreviação — aqui vale pensar mais
    esforco: entrada.tipo === "imagem" ? "medio" : "baixo",
    sistema:
      "Você lê receitas de confeitaria e as transforma em ficha técnica.\n\n" +
      "Regras:\n" +
      "- Mantenha as unidades como a confeiteira escreveu. Se ela disse " +
      "'2 xícaras', a unidade é 'xícara' — NÃO converta para gramas. O sistema " +
      "já sabe converter, e cada insumo tem a própria equivalência.\n" +
      "- Unidades aceitas: g, kg, ml, l, un, xícara, colher de sopa, " +
      "colher de chá, lata, pitada.\n" +
      "- Fração vira decimal: 'meia xícara' = 0.5, '1 e 1/2' = 1.5.\n" +
      "- O rendimento é quanto a receita inteira produz: '1 bolo', " +
      "'30 brigadeiros', '800 g de recheio'. Se não estiver escrito, use 1 e a " +
      "unidade que fizer sentido.\n" +
      "- Ovo é contado em unidades ('un'), não em gramas.\n" +
      "- No modo de preparo, transcreva os passos; não invente etapa que não " +
      "está escrita.\n\n" +
      NA_DUVIDA_DEIXE_VAZIO,
    conteudo,
  });
}

/**
 * Foto do rótulo → alergênicos.
 *
 * Isso é transcrição, não interpretação: a embalagem é obrigada por lei a
 * trazer a frase pronta ("ALÉRGICOS: CONTÉM LEITE, SOJA"), e a IA só copia.
 * Por isso é confiável o suficiente pra um campo que existe por causa de
 * alergia — diferente de deduzir alergênico pelo nome do produto, que eu me
 * recusei a fazer no seed.
 */
export async function lerRotulo(
  imagemBase64: string,
  tipoDeImagem: TipoDeImagem,
): Promise<Rotulo> {
  return extrair({
    esquema: RotuloSchema,
    aoFalhar: "Não consegui ler o rótulo.",
    // Medido no mesmo rótulo: "medio" levou 100 s, "baixo" levou 30 s e leu
    // exatamente igual. A frase de alergênico é impressa e padronizada por lei
    // — é transcrição, não raciocínio. Esperar 100 s faria ela desistir.
    esforco: "baixo",
    sistema:
      "Você lê o rótulo de embalagens de alimentos brasileiras e extrai a " +
      "declaração de alergênicos exigida pela RDC 26/2015 da ANVISA.\n\n" +
      "Regras:\n" +
      "- Procure as frases 'ALÉRGICOS: CONTÉM ...' e 'ALÉRGICOS: PODE CONTER ...'. " +
      "Elas costumam ficar logo depois da lista de ingredientes, em negrito e " +
      "caixa alta.\n" +
      "- TRANSCREVA o que está escrito. NÃO deduza pelo nome do produto: se o " +
      "rótulo não declara, não invente. Um alergênico deduzido errado vira " +
      "aviso errado numa etiqueta que alguém alérgico vai ler.\n" +
      "- Separe cada alimento num item da lista, em minúsculo e sem 'e derivados' " +
      "('leite', 'soja', 'trigo').\n" +
      "- Glúten: se o rótulo disser 'contém glúten' ou citar trigo, centeio, " +
      "cevada ou aveia, devolva 'glúten'.\n" +
      "- Se a foto não mostrar a parte dos alergênicos, marque achouAviso como " +
      "false e devolva as listas vazias. É melhor ela tirar outra foto do que " +
      "receber uma resposta chutada.\n" +
      "- Em 'frase', copie a declaração exatamente como está escrita.\n\n" +
      NA_DUVIDA_DEIXE_VAZIO,
    conteudo: [
      { tipo: "imagem", base64: imagemBase64, tipoDeImagem },
      { tipo: "texto", texto: "Quais alergênicos este rótulo declara?" },
    ],
  });
}

export async function lerPedidoDaConversa(
  conversa: string,
  hoje: string,
): Promise<PedidoExtraido> {
  return extrair({
    esquema: PedidoExtraidoSchema,
    aoFalhar: "Não consegui entender a conversa.",
    sistema:
      "Você lê conversas de WhatsApp entre uma confeiteira e as clientes dela, " +
      "e extrai o pedido combinado.\n\n" +
      `Hoje é ${hoje}.\n\n` +
      "Regras:\n" +
      "- Resolva datas relativas: 'sábado', 'dia 20', 'semana que vem' viram " +
      "AAAA-MM-DD. Se a data for ambígua, prefira null a chutar.\n" +
      "- Descreva o item como a cliente pediu ('bolo de chocolate 2kg'), sem " +
      "tentar casar com o catálogo — isso é feito depois.\n" +
      "- Só preencha precoUnitario se o valor foi combinado na conversa.\n" +
      "- sinalPago é o que a cliente JÁ pagou ('mandei o pix de 50'). Não " +
      "confunda com o total.\n" +
      "- Recados sobre o produto (sem lactose, escrever um nome, cor) vão em " +
      "observacao — do item quando for específico, do pedido quando for geral.\n" +
      "- Não trate como pedido o que ficou em aberto: se a cliente perguntou " +
      "preço e não confirmou, não invente item.\n\n" +
      NA_DUVIDA_DEIXE_VAZIO,
    conteudo: [
      { tipo: "texto", texto: `Extraia o pedido desta conversa:\n\n${conversa}` },
    ],
  });
}
