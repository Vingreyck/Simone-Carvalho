"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Phone } from "lucide-react";

import type { CanalVenda, StatusPedido } from "@/generated/prisma/enums";
import {
  CLASSE_STATUS,
  ROTULO_CANAL,
  ROTULO_STATUS,
  estaEmAberto,
} from "@/lib/pedidos";
import { formatarData, formatarDataRelativa, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";

export type PedidoDaLista = {
  id: string;
  numero: number;
  cliente: string | null;
  telefone: string | null;
  dataPedido: string;
  dataEntrega: string | null;
  status: StatusPedido;
  canal: CanalVenda;
  valorTotal: number;
  sinalPago: number;
  quantidadeItens: number;
};

type Aba = "agenda" | "todos";

export function ListaPedidos({ pedidos }: { pedidos: PedidoDaLista[] }) {
  const [aba, setAba] = useState<Aba>("agenda");

  const emAberto = useMemo(
    () => pedidos.filter((p) => estaEmAberto(p.status)),
    [pedidos],
  );

  /**
   * A agenda agrupa por dia de entrega — é assim que ela pensa a semana:
   * "o que eu tenho que entregar amanhã?". Pedidos sem data combinada ficam
   * num grupo separado no fim, pra não sumirem.
   */
  const porDia = useMemo(() => {
    const grupos = new Map<string, PedidoDaLista[]>();
    const semData: PedidoDaLista[] = [];

    for (const pedido of emAberto) {
      if (!pedido.dataEntrega) {
        semData.push(pedido);
        continue;
      }

      const dia = pedido.dataEntrega.slice(0, 10);
      grupos.set(dia, [...(grupos.get(dia) ?? []), pedido]);
    }

    return {
      dias: [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)),
      semData,
    };
  }, [emAberto]);

  const lista = aba === "agenda" ? emAberto : pedidos;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip ativo={aba === "agenda"} onClick={() => setAba("agenda")}>
          Agenda de entregas{emAberto.length > 0 ? ` (${emAberto.length})` : ""}
        </Chip>
        <Chip ativo={aba === "todos"} onClick={() => setAba("todos")}>
          Todos os pedidos
        </Chip>
      </div>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {aba === "agenda"
              ? "Nenhuma entrega marcada. Tudo entregue!"
              : "Nenhum pedido."}
          </CardContent>
        </Card>
      ) : aba === "agenda" ? (
        <div className="space-y-5">
          {porDia.dias.map(([dia, doDia]) => (
            <section key={dia}>
              <div className="mb-2 flex items-baseline gap-2">
                <CalendarDays className="text-primary size-4" />
                <h3 className="font-semibold">
                  {formatarDataRelativa(`${dia}T12:00:00`)}
                </h3>
                <span className="text-muted-foreground text-xs">
                  {formatarData(`${dia}T12:00:00`)}
                </span>
              </div>

              <div className="space-y-2">
                {doDia.map((p) => (
                  <LinhaPedido key={p.id} pedido={p} />
                ))}
              </div>
            </section>
          ))}

          {porDia.semData.length > 0 ? (
            <section>
              <h3 className="text-muted-foreground mb-2 text-sm font-semibold">
                Sem data combinada
              </h3>
              <div className="space-y-2">
                {porDia.semData.map((p) => (
                  <LinhaPedido key={p.id} pedido={p} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((p) => (
            <LinhaPedido key={p.id} pedido={p} mostrarData />
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaPedido({
  pedido,
  mostrarData,
}: {
  pedido: PedidoDaLista;
  mostrarData?: boolean;
}) {
  const falta = pedido.valorTotal - pedido.sinalPago;
  const atrasado =
    estaEmAberto(pedido.status) &&
    pedido.dataEntrega !== null &&
    new Date(pedido.dataEntrega) < new Date(new Date().toDateString());

  return (
    <Link href={`/vendas/${pedido.id}`}>
      <Card
        className={cn(
          "transition-colors",
          atrasado ? "border-danger/40" : "hover:border-primary/40",
        )}
      >
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {pedido.cliente ?? "Venda avulsa"}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                  CLASSE_STATUS[pedido.status],
                )}
              >
                {ROTULO_STATUS[pedido.status]}
              </span>
              {atrasado ? (
                <span className="bg-danger-soft text-danger border-danger/25 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                  atrasado
                </span>
              ) : null}
            </div>

            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
              <span>#{pedido.numero}</span>
              <span>·</span>
              <span>
                {pedido.quantidadeItens}{" "}
                {pedido.quantidadeItens === 1 ? "item" : "itens"}
              </span>
              <span>·</span>
              <span>{ROTULO_CANAL[pedido.canal]}</span>

              {mostrarData && pedido.dataEntrega ? (
                <>
                  <span>·</span>
                  <span>entrega {formatarData(pedido.dataEntrega)}</span>
                </>
              ) : null}

              {pedido.telefone ? (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3" />
                    {pedido.telefone}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="num font-semibold">
              {formatarMoeda(pedido.valorTotal)}
            </p>
            {pedido.sinalPago > 0 && falta > 0 ? (
              <p className="text-muted-foreground num text-xs">
                falta {formatarMoeda(falta)}
              </p>
            ) : pedido.sinalPago > 0 ? (
              <p className="text-success num text-xs">pago</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        ativo
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-accent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
