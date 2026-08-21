import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { MODELO, cliente, type TipoDeImagem } from "./cliente";
import {
  CupomSchema,
  PedidoExtraidoSchema,
  ReceitaExtraidaSchema,
  type Cupom,
  type PedidoExtraido,
  type ReceitaExtraida,
} from "./esquemas";

/**
 * As três leituras automáticas.
 *
 * Regra que vale pras três: **a IA nunca grava nada**. Ela devolve uma proposta
 * que abre preenchida numa tela de conferência. Um "1,5 kg" lido como "15 kg"
 * corromperia o custo médio, que corromperia o preço de todo produto que usa
 * aquele insumo — e ela não teria como descobrir por quê.
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
  const resposta = await cliente().messages.parse({
    model: MODELO,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system:
      "Você lê cupons fiscais e notas de compra de uma doceria brasileira e " +
      "extrai os itens comprados.\n\n" +
      "Regras:\n" +
      "- Transcreva a descrição EXATAMENTE como está no cupom, com as " +
      "abreviações do mercado (ex.: 'ACUC REFINADO UNIAO 1KG'). Não traduza " +
      "nem normalize — quem confere precisa reconhecer a linha.\n" +
      "- Separe quantidade de embalagens do tamanho de cada uma: '2x SACO " +
      "FARINHA 5KG' é quantidade 2, tamanhoEmbalagem 5, unidade 'kg'.\n" +
      "- Quando a linha não indicar tamanho de embalagem, use tamanhoEmbalagem 1 " +
      "e a unidade que fizer sentido ('un' para itens contados).\n" +
      "- valorTotal é o total daquela linha (já multiplicado pela quantidade), " +
      "não o preço unitário.\n" +
      "- Ignore linhas que não são produto: desconto, troco, subtotal, tributos, " +
      "formas de pagamento.\n" +
      "- Data no formato AAAA-MM-DD.\n\n" +
      NA_DUVIDA_DEIXE_VAZIO,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: tipoDeImagem,
              data: imagemBase64,
            },
          },
          {
            type: "text",
            text: "Extraia os itens deste cupom.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(CupomSchema) },
  });

  if (!resposta.parsed_output) {
    throw new Error("Não consegui entender o cupom.");
  }

  return resposta.parsed_output;
}

export async function lerReceita(
  entrada:
    | { tipo: "texto"; texto: string }
    | { tipo: "imagem"; base64: string; tipoDeImagem: TipoDeImagem },
): Promise<ReceitaExtraida> {
  const sistema =
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
    NA_DUVIDA_DEIXE_VAZIO;

  const conteudo =
    entrada.tipo === "texto"
      ? [
          {
            type: "text" as const,
            text: `Transforme esta receita em ficha técnica:\n\n${entrada.texto}`,
          },
        ]
      : [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: entrada.tipoDeImagem,
              data: entrada.base64,
            },
          },
          {
            type: "text" as const,
            text: "Transforme esta receita em ficha técnica.",
          },
        ];

  const resposta = await cliente().messages.parse({
    model: MODELO,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: sistema,
    messages: [{ role: "user", content: conteudo }],
    output_config: { format: zodOutputFormat(ReceitaExtraidaSchema) },
  });

  if (!resposta.parsed_output) {
    throw new Error("Não consegui entender a receita.");
  }

  return resposta.parsed_output;
}

export async function lerPedidoDaConversa(
  conversa: string,
  hoje: string,
): Promise<PedidoExtraido> {
  const resposta = await cliente().messages.parse({
    model: MODELO,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system:
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
    messages: [
      {
        role: "user",
        content: `Extraia o pedido desta conversa:\n\n${conversa}`,
      },
    ],
    output_config: { format: zodOutputFormat(PedidoExtraidoSchema) },
  });

  if (!resposta.parsed_output) {
    throw new Error("Não consegui entender a conversa.");
  }

  return resposta.parsed_output;
}
