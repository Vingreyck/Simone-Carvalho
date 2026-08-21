import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { carregarOpcoesDoEditor } from "@/server/opcoes-receita";
import { iaEstaConfigurada } from "@/lib/ia/cliente";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { EditorReceita } from "../editor-receita";

export const dynamic = "force-dynamic";

export default async function PaginaNovaReceita() {
  const { insumos, receitas, frequentes } = await carregarOpcoesDoEditor();

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/receitas">
          <ArrowLeft className="size-4" />
          Fichas técnicas
        </Link>
      </Button>

      <CabecalhoPagina
        titulo="Nova ficha técnica"
        descricao="Monte a receita e veja o custo aparecer enquanto você digita."
      />

      <EditorReceita
        insumos={insumos}
        receitas={receitas}
        iaConfigurada={iaEstaConfigurada()}
        frequentes={frequentes}
      />
    </div>
  );
}
