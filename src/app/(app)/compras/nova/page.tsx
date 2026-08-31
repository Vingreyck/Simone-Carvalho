import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { iaEstaConfigurada } from "@/lib/ia/cliente";
import { insumosMaisUsados } from "@/server/frequentes";
import { prazosDeValidadePorInsumo } from "@/server/validade";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { FormularioCompra, type InsumoDoFormulario } from "./formulario-compra";

export const dynamic = "force-dynamic";

export default async function PaginaNovaCompra() {
  const [insumos, fornecedores, frequentes, prazos] = await Promise.all([
    prisma.insumo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        unidadeBase: true,
        perecivel: true,
        equivalencias: {
          select: { nome: true, quantidadeBase: true },
          orderBy: { nome: "asc" },
        },
      },
    }),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    insumosMaisUsados(),
    prazosDeValidadePorInsumo(),
  ]);

  const lista: InsumoDoFormulario[] = insumos.map((i) => ({
    id: i.id,
    nome: i.nome,
    categoria: i.categoria,
    unidadeBase: i.unidadeBase,
    perecivel: i.perecivel,
    prazoValidadeDias: prazos[i.id] ?? null,
    equivalencias: i.equivalencias.map((e) => ({
      nome: e.nome,
      quantidadeBase: Number(e.quantidadeBase),
    })),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/compras">
          <ArrowLeft className="size-4" />
          Compras
        </Link>
      </Button>

      <CabecalhoPagina
        titulo="Lançar compra"
        descricao="Digite do jeito que está na embalagem. O sistema converte e atualiza o preço dos insumos sozinho."
      />

      <FormularioCompra
        insumos={lista}
        fornecedores={fornecedores}
        iaConfigurada={iaEstaConfigurada()}
        frequentes={frequentes}
      />
    </div>
  );
}
