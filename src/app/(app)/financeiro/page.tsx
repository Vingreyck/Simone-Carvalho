import { prisma } from "@/lib/db";
import { formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { GraficoCaixa, type PontoDoCaixa } from "./grafico-caixa";
import { PainelLancamentos, type LancamentoDaLista } from "./painel-lancamentos";
import { PainelCustosFixos } from "./painel-custos-fixos";

export const dynamic = "force-dynamic";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export default async function PaginaFinanceiro() {
  const hoje = new Date();
  const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0);
  const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

  // Seis meses de histórico, contando o atual
  const inicioJanela = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1, 0, 0, 0);

  const [lancamentos, custosFixos, categorias, doPeriodo] = await Promise.all([
    prisma.lancamento.findMany({
      where: {
        OR: [
          { status: "PENDENTE" },
          { dataVencimento: { gte: inicioDoMes, lte: fimDoMes } },
        ],
      },
      orderBy: [{ status: "asc" }, { dataVencimento: "asc" }],
      take: 200,
      include: { categoria: { select: { nome: true } } },
    }),
    prisma.custoFixoMensal.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.categoriaFinanceira.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, tipo: true },
    }),
    prisma.lancamento.findMany({
      where: {
        status: "PAGO",
        dataPagamento: { gte: inicioJanela },
      },
      select: { tipo: true, valor: true, dataPagamento: true },
    }),
  ]);

  // ------------------------------------------------------ série do gráfico
  const porMes = new Map<string, { entrou: number; saiu: number }>();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    porMes.set(`${d.getFullYear()}-${d.getMonth()}`, { entrou: 0, saiu: 0 });
  }

  for (const l of doPeriodo) {
    if (!l.dataPagamento) continue;

    const chave = `${l.dataPagamento.getFullYear()}-${l.dataPagamento.getMonth()}`;
    const alvo = porMes.get(chave);
    if (!alvo) continue;

    if (l.tipo === "RECEITA") alvo.entrou += Number(l.valor);
    else alvo.saiu += Number(l.valor);
  }

  const serie: PontoDoCaixa[] = [...porMes.entries()].map(([chave, v]) => {
    const [, mes] = chave.split("-").map(Number);
    return {
      mes: MESES[mes!]!,
      entrou: v.entrou,
      saiu: v.saiu,
      sobrou: v.entrou - v.saiu,
    };
  });

  // ------------------------------------------------------------- números
  const pendentes = lancamentos.filter((l) => l.status === "PENDENTE");

  const aPagar = pendentes
    .filter((l) => l.tipo === "DESPESA")
    .reduce((t, l) => t + Number(l.valor), 0);

  const aReceber = pendentes
    .filter((l) => l.tipo === "RECEITA")
    .reduce((t, l) => t + Number(l.valor), 0);

  const mesAtual = serie[serie.length - 1] ?? { entrou: 0, saiu: 0, sobrou: 0 };

  const vencidas = pendentes.filter(
    (l) => l.dataVencimento < inicioDoMes || l.dataVencimento < hoje,
  ).length;

  const lista: LancamentoDaLista[] = lancamentos.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao,
    categoria: l.categoria?.nome ?? null,
    categoriaId: l.categoriaId,
    valor: Number(l.valor),
    dataVencimento: l.dataVencimento.toISOString(),
    status: l.status,
    formaPagamento: l.formaPagamento,
    observacao: l.observacao,
    veioDeCompra: Boolean(l.compraId),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="O que entra, o que sai e quanto realmente sobra."
      />

      {/* ------------------------------------------------------ números */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          titulo="Entrou este mês"
          valor={mesAtual.entrou}
          className="text-success"
        />
        <Numero titulo="Saiu este mês" valor={mesAtual.saiu} />
        <Numero
          titulo="Sobrou"
          valor={mesAtual.sobrou}
          className={mesAtual.sobrou < 0 ? "text-danger" : "text-success"}
          destaque
        />
        <Numero
          titulo="A pagar"
          valor={aPagar}
          detalhe={
            vencidas > 0
              ? `${vencidas} ${vencidas === 1 ? "vencida" : "vencidas"}`
              : aReceber > 0
                ? `${formatarMoeda(aReceber)} a receber`
                : undefined
          }
          className={vencidas > 0 ? "text-danger" : undefined}
        />
      </div>

      {/* ------------------------------------------------------ gráfico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 6 meses</CardTitle>
          <p className="text-muted-foreground text-sm">
            Só conta o que já foi pago ou recebido de fato.
          </p>
        </CardHeader>
        <CardContent>
          <GraficoCaixa dados={serie} />
        </CardContent>
      </Card>

      <PainelLancamentos lancamentos={lista} categorias={categorias} />

      <PainelCustosFixos
        custos={custosFixos.map((c) => ({
          id: c.id,
          nome: c.nome,
          valor: Number(c.valor),
          diaVencimento: c.diaVencimento,
        }))}
      />
    </div>
  );
}

function Numero({
  titulo,
  valor,
  detalhe,
  className,
  destaque,
}: {
  titulo: string;
  valor: number;
  detalhe?: string;
  className?: string;
  destaque?: boolean;
}) {
  return (
    <Card className={cn(destaque && "border-gold-hairline")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("num text-xl font-semibold", className)}>
          {formatarMoeda(valor)}
        </p>
        {detalhe ? (
          <p className="text-muted-foreground mt-0.5 text-xs">{detalhe}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
