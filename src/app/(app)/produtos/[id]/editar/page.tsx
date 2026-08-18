import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { carregarReceitasParaProduto } from "@/server/opcoes-produto";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { EditorProduto } from "../../editor-produto";

export const dynamic = "force-dynamic";

export default async function PaginaEditarProduto({
  params,
}: PageProps<"/produtos/[id]/editar">) {
  const { id } = await params;

  const [produto, receitas] = await Promise.all([
    prisma.produto.findUnique({ where: { id } }),
    carregarReceitasParaProduto(),
  ]);

  if (!produto) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href={`/produtos/${id}`}>
          <ArrowLeft className="size-4" />
          {produto.nome}
        </Link>
      </Button>

      <CabecalhoPagina titulo="Editar produto" />

      <EditorProduto
        receitas={receitas}
        produto={{
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao,
          categoria: produto.categoria,
          receitaId: produto.receitaId,
          consumoDaReceita: Number(produto.consumoDaReceita),
          custoEmbalagem: Number(produto.custoEmbalagem),
          tempoExtraMin: produto.tempoExtraMin,
          precoVenda: Number(produto.precoVenda),
          margemAlvo:
            produto.margemAlvo === null ? null : Number(produto.margemAlvo),
        }}
      />
    </div>
  );
}
