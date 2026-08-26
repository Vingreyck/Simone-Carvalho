"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, TriangleAlert } from "lucide-react";

import type { AvisoDeAlta } from "@/server/impacto";
import { formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "O chocolate subiu — e isso mexeu no seu preço."
 *
 * Este aviso é o motivo de o sistema existir. Ela não tem como perceber sozinha
 * que a alta de um saco de farinha jogou três produtos abaixo do custo — o
 * prejuízo aparece meses depois, no bolso, sem explicação.
 *
 * Aparece logo depois de salvar a compra porque é o instante em que o sistema
 * descobre. E é só aviso: nenhum preço muda sozinho. Reprecificar é decisão
 * dela — tem cliente fiel envolvido, e isso o sistema não sabe pesar.
 */
export function DialogoAlta({
  aviso,
  aberto,
  onFechar,
}: {
  aviso: AvisoDeAlta;
  aberto: boolean;
  onFechar: () => void;
}) {
  const graves = aviso.produtos.filter((p) => p.virouPrejuizo);
  const outros = aviso.produtos.filter((p) => !p.virouPrejuizo);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="text-warning size-5" />
            {aviso.subiram.length === 1
              ? `${aviso.subiram[0].nome} subiu ${aviso.subiram[0].variacao.toFixed(0)}%`
              : "Alguns insumos subiram de preço"}
          </DialogTitle>
          <DialogDescription>
            A compra foi salva. Só que ela mexeu no custo de{" "}
            {aviso.produtos.length === 1
              ? "um produto"
              : `${aviso.produtos.length} produtos`}
            .
          </DialogDescription>
        </DialogHeader>

        {aviso.subiram.length > 1 ? (
          <ul className="space-y-1 text-sm">
            {aviso.subiram.map((s) => (
              <li key={s.nome} className="flex justify-between gap-3">
                <span className="truncate">{s.nome}</span>
                <span className="text-warning num shrink-0 font-medium">
                  +{s.variacao.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {graves.length > 0 ? (
          <div className="border-danger/40 bg-danger/10 space-y-3 rounded-lg border p-3">
            <p className="text-danger flex items-center gap-2 text-sm font-semibold">
              <TriangleAlert className="size-4 shrink-0" />
              {graves.length === 1
                ? "Este produto passou a dar prejuízo"
                : `${graves.length} produtos passaram a dar prejuízo`}
            </p>
            {graves.map((p) => (
              <LinhaProduto key={p.id} produto={p} grave />
            ))}
          </div>
        ) : null}

        {outros.length > 0 ? (
          <div className="space-y-3">
            {graves.length > 0 ? (
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Ficaram mais caros, mas ainda dão lucro
              </p>
            ) : null}
            {outros.map((p) => (
              <LinhaProduto key={p.id} produto={p} />
            ))}
          </div>
        ) : null}

        <p className="text-muted-foreground text-xs">
          Nenhum preço foi alterado. Quem decide se vai repassar é você.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onFechar}>
            Depois eu vejo
          </Button>
          <Button asChild onClick={onFechar}>
            <Link href="/produtos">
              Rever preços
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinhaProduto({
  produto,
  grave = false,
}: {
  produto: AvisoDeAlta["produtos"][number];
  grave?: boolean;
}) {
  const alta = produto.custoDepois - produto.custoAntes;

  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {produto.nome}
        </p>
        <span
          className={cn(
            "num shrink-0 text-xs font-medium",
            grave ? "text-danger" : "text-warning",
          )}
        >
          +{formatarMoeda(alta)}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Custa fazer</dt>
          <dd className="num font-medium">{formatarMoeda(produto.custoDepois)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Você vende por</dt>
          <dd
            className={cn("num font-medium", grave && "text-danger")}
          >
            {formatarMoeda(produto.precoVenda)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Devia ser</dt>
          <dd className="num text-success font-medium">
            {formatarMoeda(produto.precoSugerido)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
