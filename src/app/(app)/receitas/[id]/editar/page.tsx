import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { carregarOpcoesDoEditor } from "@/server/opcoes-receita";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { EditorReceita } from "../../editor-receita";

export const dynamic = "force-dynamic";

export default async function PaginaEditarReceita({
  params,
}: PageProps<"/receitas/[id]/editar">) {
  const { id } = await params;

  const [receita, opcoes] = await Promise.all([
    prisma.receita.findUnique({
      where: { id },
      include: { itens: { orderBy: { ordem: "asc" } } },
    }),
    carregarOpcoesDoEditor(id),
  ]);

  if (!receita) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href={`/receitas/${id}`}>
          <ArrowLeft className="size-4" />
          {receita.nome}
        </Link>
      </Button>

      <CabecalhoPagina titulo="Editar ficha técnica" />

      <EditorReceita
        insumos={opcoes.insumos}
        receitas={opcoes.receitas}
        receita={{
          id: receita.id,
          nome: receita.nome,
          descricao: receita.descricao,
          categoria: receita.categoria,
          rendimentoQuantidade: Number(receita.rendimentoQuantidade),
          rendimentoUnidade: receita.rendimentoUnidade,
          tempoPreparoMin: receita.tempoPreparoMin,
          modoPreparo: receita.modoPreparo,
          observacao: receita.observacao,
          itens: receita.itens.map((i) => ({
            insumoId: i.insumoId,
            subReceitaId: i.subReceitaId,
            quantidade: Number(i.quantidade),
            unidade: i.unidade,
            observacao: i.observacao,
          })),
        }}
      />
    </div>
  );
}
