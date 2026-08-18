"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatarMoeda } from "@/lib/format";

export type PontoDoCaixa = {
  mes: string;
  entrou: number;
  saiu: number;
  sobrou: number;
};

/**
 * Entrou × saiu nos últimos meses.
 *
 * Duas séries, então usa os slots 1 e 2 da paleta categórica (dourado e azul) —
 * a ordem é fixa e nunca é recalculada por ranking. A legenda fica sempre
 * visível: a identidade nunca depende só da cor.
 */
export function GraficoCaixa({ dados }: { dados: PontoDoCaixa[] }) {
  const temMovimento = dados.some((d) => d.entrou > 0 || d.saiu > 0);

  if (!temMovimento) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Ainda não há movimento suficiente pra desenhar o gráfico. Lance uma
        compra ou uma venda.
      </p>
    );
  }

  return (
    <div>
      {/* Legenda antes do gráfico — some junto com ele se não houver dados */}
      <div className="mb-3 flex flex-wrap gap-4">
        <ItemLegenda cor="var(--chart-1)" rotulo="Entrou" />
        <ItemLegenda cor="var(--chart-2)" rotulo="Saiu" />
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dados}
            margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
            barGap={2}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeWidth={1}
            />

            <XAxis
              dataKey="mes"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
              }
            />

            <Tooltip
              cursor={{ fill: "var(--accent)", opacity: 0.4 }}
              content={<DicaDoGrafico />}
            />

            {/* Ponta arredondada em cima, quadrada na linha de base */}
            <Bar
              dataKey="entrou"
              name="Entrou"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="saiu"
              name="Saiu"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ItemLegenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ backgroundColor: cor }}
      />
      {rotulo}
    </span>
  );
}

function DicaDoGrafico({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: PontoDoCaixa }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const ponto = payload[0]!.payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="mb-1.5 font-medium">{label}</p>

      <ul className="space-y-1">
        <li className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: "var(--chart-1)" }}
            />
            Entrou
          </span>
          <span className="num">{formatarMoeda(ponto.entrou)}</span>
        </li>

        <li className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: "var(--chart-2)" }}
            />
            Saiu
          </span>
          <span className="num">{formatarMoeda(ponto.saiu)}</span>
        </li>

        <li className="flex items-center justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">Sobrou</span>
          <span
            className={
              ponto.sobrou < 0 ? "num text-danger font-medium" : "num font-medium"
            }
          >
            {formatarMoeda(ponto.sobrou)}
          </span>
        </li>
      </ul>
    </div>
  );
}
