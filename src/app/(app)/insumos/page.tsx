import { prisma } from "@/lib/db";
import { iaEstaConfigurada } from "@/lib/ia/cliente";
import { situacaoEstoque } from "@/lib/estoque";

import {
  ListaInsumos,
  type Filtro,
  type InsumoDaLista,
} from "./lista-insumos";

export const dynamic = "force-dynamic";

const FILTROS_DA_URL: Filtro[] = [
  "todos",
  "acabando",
  "sem-preco",
  "sem-alergeno",
  "arquivados",
];

export default async function PaginaInsumos({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro } = await searchParams;

  const [insumos, saldos] = await Promise.all([
    prisma.insumo.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        unidadeBase: true,
        estoqueMinimo: true,
        custoMedio: true,
        custoUltimaCompra: true,
        perecivel: true,
        marcaPreferida: true,
        observacao: true,
        alergenos: true,
        alergenosTraco: true,
        alergenosRevisados: true,
        ativo: true,
      },
    }),
    // Uma consulta agregada só, em vez de carregar todos os lotes de cada insumo
    prisma.insumoLote.groupBy({
      by: ["insumoId"],
      _sum: { quantidadeRestante: true },
    }),
  ]);

  const saldoPorInsumo = new Map(
    saldos.map((s) => [s.insumoId, Number(s._sum.quantidadeRestante ?? 0)]),
  );

  const lista: InsumoDaLista[] = insumos.map((insumo) => {
    const saldo = saldoPorInsumo.get(insumo.id) ?? 0;
    const minimo = Number(insumo.estoqueMinimo);

    return {
      id: insumo.id,
      nome: insumo.nome,
      categoria: insumo.categoria,
      unidadeBase: insumo.unidadeBase,
      estoqueMinimo: minimo,
      custoMedio: Number(insumo.custoMedio),
      custoUltimaCompra:
        insumo.custoUltimaCompra === null
          ? null
          : Number(insumo.custoUltimaCompra),
      perecivel: insumo.perecivel,
      marcaPreferida: insumo.marcaPreferida,
      observacao: insumo.observacao,
      alergenos: insumo.alergenos,
      alergenosTraco: insumo.alergenosTraco,
      alergenosRevisados: insumo.alergenosRevisados,
      ativo: insumo.ativo,
      saldo,
      situacao: situacaoEstoque(saldo, minimo),
    };
  });

  return (
    <ListaInsumos
      insumos={lista}
      iaConfigurada={iaEstaConfigurada()}
      filtroInicial={
        FILTROS_DA_URL.includes(filtro as Filtro) ? (filtro as Filtro) : "todos"
      }
    />
  );
}
