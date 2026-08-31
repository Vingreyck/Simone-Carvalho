/**
 * A mediana aparece em dois lugares deste sistema, sempre pelo mesmo motivo:
 * os dados dela têm ponto fora da curva com significado.
 *
 * Um lote comprado em promoção perto do vencimento; um insumo que ela comprou
 * uma vez há um ano e depois passou a comprar toda semana. A média deixa esses
 * casos mandarem no resultado; a mediana não.
 *
 * Fica num arquivo só porque a escolha é a mesma decisão — se um dia virar
 * média num lugar, tem que virar no outro de propósito, não por descuido.
 */
export function mediana(numeros: number[]): number | null {
  if (numeros.length === 0) return null;

  const ordenados = [...numeros].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);

  return ordenados.length % 2 === 1
    ? ordenados[meio]!
    : (ordenados[meio - 1]! + ordenados[meio]!) / 2;
}
