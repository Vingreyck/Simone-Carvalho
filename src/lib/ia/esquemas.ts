import { z } from "zod";

/**
 * O que a IA tem permissão de devolver.
 *
 * Estes esquemas não são só tipagem: eles são o contrato que impede a IA de
 * inventar campo, e o Zod rejeita qualquer coisa fora do formato antes de
 * chegar perto do banco. Nada aqui é gravado direto — tudo passa por uma tela
 * de conferência.
 */

export const ItemDoCupomSchema = z.object({
  /** Como está escrito no cupom, sem "traduzir" — é o que ela vai conferir */
  descricao: z.string(),
  /** Quantas embalagens (2 sacos, 3 latas) */
  quantidade: z.number(),
  /** Quanto vem em cada uma (5, no caso de "saco de 5 kg"). 1 se não disser. */
  tamanhoEmbalagem: z.number(),
  /** kg, g, l, ml, un — em minúsculo */
  unidade: z.string(),
  /** Total pago naquela linha, já multiplicado pela quantidade */
  valorTotal: z.number(),
});

export const CupomSchema = z.object({
  /** Nome do mercado/fornecedor, como aparece no cupom */
  fornecedor: z.string().nullable(),
  /** AAAA-MM-DD */
  data: z.string().nullable(),
  /** Número da nota, se aparecer */
  notaFiscal: z.string().nullable(),
  itens: z.array(ItemDoCupomSchema),
  /** Total do cupom, pra conferir contra a soma dos itens */
  valorTotal: z.number().nullable(),
});

export type ItemDoCupom = z.infer<typeof ItemDoCupomSchema>;
export type Cupom = z.infer<typeof CupomSchema>;

export const IngredienteSchema = z.object({
  /** Nome do ingrediente como ela escreveu */
  nome: z.string(),
  quantidade: z.number(),
  /** g, kg, ml, l, un, xícara, colher de sopa, colher de chá, lata, pitada */
  unidade: z.string(),
  observacao: z.string().nullable(),
});

export const ReceitaExtraidaSchema = z.object({
  nome: z.string(),
  /** Quanto rende (1 bolo, 30 brigadeiros, 800 g de recheio) */
  rendimentoQuantidade: z.number(),
  rendimentoUnidade: z.string(),
  /** Minutos; 0 se não disser */
  tempoPreparoMin: z.number(),
  ingredientes: z.array(IngredienteSchema),
  modoPreparo: z.string().nullable(),
});

export type IngredienteExtraido = z.infer<typeof IngredienteSchema>;
export type ReceitaExtraida = z.infer<typeof ReceitaExtraidaSchema>;

export const ItemDoPedidoSchema = z.object({
  /** Produto como a cliente pediu ("bolo de chocolate 2kg") */
  descricao: z.string(),
  quantidade: z.number(),
  /** Preço combinado na conversa; null se não foi falado */
  precoUnitario: z.number().nullable(),
  observacao: z.string().nullable(),
});

export const PedidoExtraidoSchema = z.object({
  cliente: z.string().nullable(),
  telefone: z.string().nullable(),
  /** AAAA-MM-DD; null se não foi combinado */
  dataEntrega: z.string().nullable(),
  enderecoEntrega: z.string().nullable(),
  itens: z.array(ItemDoPedidoSchema),
  /** Sinal/entrada que a cliente já pagou, se mencionado */
  sinalPago: z.number().nullable(),
  /** Recados: "sem lactose", "escrever Parabéns Ana" */
  observacao: z.string().nullable(),
});

export type ItemDoPedidoExtraido = z.infer<typeof ItemDoPedidoSchema>;
export type PedidoExtraido = z.infer<typeof PedidoExtraidoSchema>;
