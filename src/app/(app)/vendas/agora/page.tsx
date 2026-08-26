import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { produtosMaisVendidos } from "@/server/frequentes";
import { Button } from "@/components/ui/button";

import { VendaAgora, type ProdutoVenda } from "./venda-agora";

export const metadata = { title: "Venda agora" };

export default async function VendaAgoraPage() {
  const [produtos, maisVendidos] = await Promise.all([
    prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, precoVenda: true },
    }),
    produtosMaisVendidos(),
  ]);

  const lista: ProdutoVenda[] = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    precoVenda: Number(p.precoVenda),
  }));

  // O que mais sai fica no topo — ela não devia rolar a lista pra vender o
  // brigadeiro de sempre com a cliente esperando na porta.
  const posicao = new Map(maisVendidos.map((id, i) => [id, i]));
  lista.sort((a, b) => {
    const pa = posicao.get(a.id) ?? 999;
    const pb = posicao.get(b.id) ?? 999;
    return pa !== pb ? pa - pb : a.nome.localeCompare(b.nome, "pt-BR");
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/vendas" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Venda agora</h1>
          <p className="text-muted-foreground text-sm">
            Pra quem veio, escolheu e levou. Toque nos doces e registre.
          </p>
        </div>
      </div>

      <VendaAgora produtos={lista} />
    </div>
  );
}
