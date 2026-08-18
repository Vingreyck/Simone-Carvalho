import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { FormularioProducao } from "../formulario-producao";

export const dynamic = "force-dynamic";

export default async function PaginaNovaProducao() {
  const receitas = await prisma.receita.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      rendimentoQuantidade: true,
      rendimentoUnidade: true,
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/producao">
          <ArrowLeft className="size-4" />
          Produção
        </Link>
      </Button>

      <CabecalhoPagina
        titulo="Registrar produção"
        descricao="O estoque baixa sozinho, sempre pelo lote que vence primeiro."
      />

      <FormularioProducao
        receitas={receitas.map((r) => ({
          id: r.id,
          nome: r.nome,
          rendimentoQuantidade: Number(r.rendimentoQuantidade),
          rendimentoUnidade: r.rendimentoUnidade,
        }))}
      />
    </div>
  );
}
