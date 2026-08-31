import { z } from "zod";

/**
 * O que a IA tem permissão de devolver.
 *
 * Estes esquemas não são só tipagem: eles são o contrato que impede a IA de
 * inventar campo, e o Zod rejeita qualquer coisa fora do formato antes de
 * chegar perto do banco. Nada aqui é gravado direto — tudo passa por uma tela
 * de conferência.
 */

export const ItemDaNotaSchema = z.object({
  /** Como está escrito na nota, sem "traduzir" — é o que ela vai conferir */
  descricao: z.string(),
  /**
   * O mesmo produto com nome de gente ("Açúcar refinado").
   *
   * Só é usado quando o item não existe no cadastro dela e o sistema vai criar
   * o insumo — o nome da nota ("ACUC REFINADO UNIAO 1KG") viraria um item feio
   * e permanente na lista.
   */
  nomeLimpo: z.string(),
  /** Quantas embalagens (2 sacos, 3 latas) */
  quantidade: z.number(),
  /** Quanto vem em cada uma (5, no caso de "saco de 5 kg"). 1 se não disser. */
  tamanhoEmbalagem: z.number(),
  /** kg, g, l, ml, un — em minúsculo */
  unidade: z.string(),
  /** Total pago naquela linha, já multiplicado pela quantidade */
  valorTotal: z.number(),
  /**
   * Se serve pra fazer doce.
   *
   * Nota de supermercado mistura a compra da casa com a da doceria: fósforo,
   * esponja e detergente vêm na mesma nota que a farinha. Sem esta marca, o
   * sistema cadastraria "Esponja de limpeza" como insumo de confeitaria.
   */
  ehIngrediente: z.boolean(),
});

export const NotaSchema = z.object({
  /** Nome do mercado/fornecedor, como aparece na nota */
  fornecedor: z.string().nullable(),
  /** AAAA-MM-DD */
  data: z.string().nullable(),
  /** Número da nota, se aparecer */
  notaFiscal: z.string().nullable(),
  itens: z.array(ItemDaNotaSchema),
  /** Total da nota, pra conferir contra a soma dos itens */
  valorTotal: z.number().nullable(),
});

export type ItemDaNota = z.infer<typeof ItemDaNotaSchema>;
export type Nota = z.infer<typeof NotaSchema>;

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

/**
 * Leitura do rótulo de um insumo.
 *
 * A IA aqui só TRANSCREVE o que está escrito na embalagem — não deduz. "Leite
 * condensado deve ter leite" é dedução; "está escrito ALÉRGICOS: CONTÉM LEITE"
 * é leitura. Só a segunda é confiável o bastante pra virar aviso de alergia.
 */
export const RotuloSchema = z.object({
  /** O que aparece depois de "ALÉRGICOS: CONTÉM" no rótulo */
  contem: z.array(z.string()),
  /** O que aparece depois de "ALÉRGICOS: PODE CONTER" */
  podeConter: z.array(z.string()),
  /** A frase de alergênicos como está escrita, pra ela conferir contra a foto */
  frase: z.string().nullable(),
  /** false quando a foto não mostra a parte de alergênicos da embalagem */
  achouAviso: z.boolean(),
});

export type Rotulo = z.infer<typeof RotuloSchema>;

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
