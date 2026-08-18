import Link from "next/link";
import { CookingPot, Plus } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatarData, formatarMoeda } from "@/lib/format";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PaginaProducao() {
  const [producoes, temReceita] = await Promise.all([
    prisma.producao.findMany({
      orderBy: { data: "desc" },
      take: 100,
      include: {
        receita: { select: { nome: true, rendimentoUnidade: true } },
      },
    }),
    prisma.receita.count({ where: { ativo: true } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Produção"
        descricao="Registre o que fez e o estoque baixa sozinho."
        acao={
          temReceita > 0 ? (
            <Button asChild>
              <Link href="/producao/nova">
                <Plus className="size-4" />
                Registrar produção
              </Link>
            </Button>
          ) : null
        }
      />

      {temReceita === 0 ? (
        <EstadoVazio
          icone={CookingPot}
          titulo="Cadastre uma ficha técnica primeiro"
          descricao="A produção usa a ficha pra saber quais ingredientes tirar do estoque."
          acao={
            <Button asChild>
              <Link href="/receitas/nova">Criar ficha técnica</Link>
            </Button>
          }
        />
      ) : producoes.length === 0 ? (
        <EstadoVazio
          icone={CookingPot}
          titulo="Nenhuma produção registrada"
          descricao="Toda vez que você produzir, registre aqui. O estoque desce sozinho e você passa a saber o custo real de cada fornada."
          acao={
            <Button asChild>
              <Link href="/producao/nova">
                <Plus className="size-4" />
                Registrar produção
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {producoes.map((p) => (
            <Link key={p.id} href={`/producao/${p.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.receita.nome}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        #{p.numero}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground num mt-0.5 text-xs">
                      {formatarData(p.data)} · {Number(p.quantidade)}{" "}
                      {Number(p.quantidade) === 1 ? "receita" : "receitas"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="num font-semibold">
                      {formatarMoeda(p.custoTotal)}
                    </p>
                    <p className="text-muted-foreground text-xs">custo real</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
