import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { carregarReceitasParaProduto } from "@/server/opcoes-produto";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { EditorProduto } from "../editor-produto";

export const dynamic = "force-dynamic";

export default async function PaginaNovoProduto() {
  const receitas = await carregarReceitasParaProduto();

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/produtos">
          <ArrowLeft className="size-4" />
          Produtos
        </Link>
      </Button>

      <CabecalhoPagina
        titulo="Novo produto"
        descricao="Depois de criar, o sistema mostra por quanto vender."
      />

      <EditorProduto receitas={receitas} />
    </div>
  );
}
