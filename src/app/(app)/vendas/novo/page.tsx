import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { carregarOpcoesDoPedido } from "@/server/opcoes-pedido";
import { iaEstaConfigurada } from "@/lib/ia/cliente";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { EditorPedido } from "../editor-pedido";

export const dynamic = "force-dynamic";

export default async function PaginaNovoPedido() {
  const { produtos, clientes } = await carregarOpcoesDoPedido();

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/vendas">
          <ArrowLeft className="size-4" />
          Vendas
        </Link>
      </Button>

      <CabecalhoPagina
        titulo="Novo pedido"
        descricao="Começa como orçamento. Quando a cliente confirmar, vira conta a receber no financeiro."
      />

      <EditorPedido
        produtos={produtos}
        clientes={clientes}
        iaConfigurada={iaEstaConfigurada()}
      />
    </div>
  );
}
