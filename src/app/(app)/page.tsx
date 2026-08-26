import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ChefHat,
  ClipboardList,
  CookingPot,
  ShoppingCart,
  Tags,
  TrendingDown,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { carregarBaseDeCusto, custoDeProduto } from "@/server/custos";
import { analisarPreco, calcularPrecoSugerido } from "@/lib/precificacao";
import { situacaoEstoque, situacaoValidade } from "@/lib/estoque";
import { formatarDataRelativa, formatarMoeda, formatarNumero } from "@/lib/format";
import { formatarQuantidade } from "@/lib/unidades";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { carregarPlano } from "@/server/plano";
import { PrimeirosPassos } from "./primeiros-passos";

export const dynamic = "force-dynamic";

export default async function PaginaPainel() {
  const hoje = new Date();
  const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [
    insumos,
    produtos,
    base,
    config,
    doMes,
    pendentes,
    contagens,
    plano,
  ] = await Promise.all([
    prisma.insumo.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        unidadeBase: true,
        estoqueMinimo: true,
        lotes: {
          where: { quantidadeRestante: { gt: 0 } },
          select: { quantidadeRestante: true, validade: true },
        },
      },
    }),
    prisma.produto.findMany({
      where: { ativo: true, precoVenda: { gt: 0 } },
      select: {
        id: true,
        nome: true,
        receitaId: true,
        consumoDaReceita: true,
        custoEmbalagem: true,
        tempoExtraMin: true,
        precoVenda: true,
        margemAlvo: true,
      },
    }),
    carregarBaseDeCusto(),
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
    prisma.lancamento.findMany({
      where: { status: "PAGO", dataPagamento: { gte: inicioDoMes } },
      select: { tipo: true, valor: true },
    }),
    prisma.lancamento.findMany({
      where: { status: "PENDENTE" },
      select: { tipo: true, valor: true, dataVencimento: true },
    }),
    Promise.all([
      prisma.insumo.count({ where: { ativo: true } }),
      prisma.compra.count(),
      prisma.receita.count({ where: { ativo: true } }),
      prisma.produto.count({ where: { ativo: true } }),
    ]),
    carregarPlano(),
  ]);

  const [totalInsumos, totalCompras, totalReceitas, totalProdutos] = contagens;

  const cfg = {
    valorHoraMaoDeObra: config?.valorHoraMaoDeObra?.toString() ?? "0",
    percentualCustosFixos: config?.percentualCustosFixos?.toString() ?? "0",
    percentualImpostos: config?.percentualImpostos?.toString() ?? "0",
    percentualTaxaCartao: config?.percentualTaxaCartao?.toString() ?? "0",
    margemLucroPadrao: config?.margemLucroPadrao?.toString() ?? "30",
  };

  const diasAlerta = config?.diasAlertaValidade ?? 7;

  // Sistema recém-instalado: guia em vez de painel vazio
  const aindaVazio = totalCompras === 0 && totalReceitas === 0;

  if (aindaVazio) {
    return (
      <PrimeirosPassos
        totalInsumos={totalInsumos}
        temCompra={totalCompras > 0}
        temReceita={totalReceitas > 0}
        temProduto={totalProdutos > 0}
        precificacaoConfigurada={
          Number(config?.valorHoraMaoDeObra ?? 0) > 0 ||
          Number(config?.percentualCustosFixos ?? 0) > 0
        }
      />
    );
  }

  // ----------------------------------------------------------- alertas ----
  const acabando = insumos
    .map((i) => {
      const saldo = i.lotes.reduce((t, l) => t + Number(l.quantidadeRestante), 0);
      return {
        ...i,
        saldo,
        situacao: situacaoEstoque(saldo, Number(i.estoqueMinimo)),
      };
    })
    .filter((i) => i.situacao !== "ok");

  const vencendo = insumos
    .flatMap((i) =>
      i.lotes
        .filter((l) => l.validade)
        .map((l) => ({
          insumoId: i.id,
          nome: i.nome,
          unidadeBase: i.unidadeBase,
          quantidade: Number(l.quantidadeRestante),
          validade: l.validade!,
          situacao: situacaoValidade(l.validade, diasAlerta),
        })),
    )
    .filter((l) => l.situacao !== "ok")
    .sort((a, b) => a.validade.getTime() - b.validade.getTime());

  const noPrejuizo = produtos
    .map((produto) => {
      const custo = custoDeProduto(produto, base);
      const sugestao = calcularPrecoSugerido(
        {
          custoIngredientes: custo.custoIngredientes,
          custoEmbalagem: produto.custoEmbalagem.toString(),
          tempoPreparoMin: custo.tempoTotalMin,
          margemAlvo: produto.margemAlvo?.toString() ?? null,
        },
        cfg,
      );
      const analise = analisarPreco(
        produto.precoVenda.toString(),
        sugestao.custoDireto,
        cfg,
        produto.margemAlvo?.toString() ?? null,
      );

      return { produto, analise };
    })
    .filter((p) => p.analise.situacao === "prejuizo");

  const vencidas = pendentes.filter((l) => l.dataVencimento < hoje);

  // ------------------------------------------------------------ números ---
  const entrou = doMes
    .filter((l) => l.tipo === "RECEITA")
    .reduce((t, l) => t + Number(l.valor), 0);
  const saiu = doMes
    .filter((l) => l.tipo === "DESPESA")
    .reduce((t, l) => t + Number(l.valor), 0);

  const temAlerta =
    acabando.length > 0 ||
    vencendo.length > 0 ||
    noPrejuizo.length > 0 ||
    vencidas.length > 0 ||
    plano.temAtrasado ||
    plano.faltaComprar.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* ------------------------------------------------------- números */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Numero titulo="Entrou este mês" valor={entrou} className="text-success" />
        <Numero titulo="Saiu este mês" valor={saiu} />
        <Numero
          titulo="Sobrou"
          valor={entrou - saiu}
          className={entrou - saiu < 0 ? "text-danger" : "text-success"}
          destaque
        />
      </section>

      {/* ------------------------------------------------------- alertas */}
      {temAlerta ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Precisa da sua atenção</h2>

          {plano.temAtrasado ? (
            <Alerta
              tom="danger"
              icone={ClipboardList}
              titulo="Tem encomenda atrasada"
              texto="A data de entrega já passou e o pedido não saiu."
              href="/producao/plano"
              acao="Ver o que fazer"
            />
          ) : null}

          {plano.faltaComprar.length > 0 ? (
            <Alerta
              tom="warning"
              icone={ShoppingCart}
              titulo={`Falta insumo pras encomendas`}
              texto={plano.faltaComprar.map((f) => f.nome).join(", ")}
              href="/producao/plano"
              acao="Ver a lista"
            />
          ) : null}

          {noPrejuizo.length > 0 ? (
            <Alerta
              tom="danger"
              icone={TrendingDown}
              titulo={`${noPrejuizo.length} ${noPrejuizo.length === 1 ? "produto vendido" : "produtos vendidos"} no prejuízo`}
              texto={noPrejuizo.map((p) => p.produto.nome).join(", ")}
              href="/produtos"
              acao="Ver preços"
            />
          ) : null}

          {vencidas.length > 0 ? (
            <Alerta
              tom="danger"
              icone={CalendarClock}
              titulo={`${vencidas.length} ${vencidas.length === 1 ? "conta vencida" : "contas vencidas"}`}
              texto={formatarMoeda(
                vencidas.reduce((t, l) => t + Number(l.valor), 0),
              )}
              href="/financeiro"
              acao="Ver contas"
            />
          ) : null}

          {vencendo.length > 0 ? (
            <Alerta
              tom="warning"
              icone={CalendarClock}
              titulo={`${vencendo.length} ${vencendo.length === 1 ? "lote vencendo" : "lotes vencendo"}`}
              texto={vencendo
                .slice(0, 3)
                .map(
                  (l) =>
                    `${l.nome} (${formatarDataRelativa(l.validade)})`,
                )
                .join(", ")}
              href="/estoque"
              acao="Ver estoque"
            />
          ) : null}

          {acabando.length > 0 ? (
            <Alerta
              tom="warning"
              icone={ShoppingCart}
              titulo={`${acabando.length} ${acabando.length === 1 ? "insumo acabando" : "insumos acabando"}`}
              texto={acabando
                .slice(0, 4)
                .map(
                  (i) =>
                    `${i.nome} (${formatarQuantidade(i.saldo, i.unidadeBase)})`,
                )
                .join(", ")}
              href="/estoque"
              acao="Lista de compras"
            />
          ) : null}
        </section>
      ) : (
        <Card className="border-success/25 bg-success-soft/30">
          <CardContent className="py-6 text-center">
            <p className="font-medium">Tudo em ordem por aqui.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Nenhum insumo acabando, nenhuma conta vencida e nenhum produto no
              prejuízo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------- atalhos */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">O que você quer fazer?</h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Atalho
            href="/compras/nova"
            icone={ShoppingCart}
            titulo="Lancei uma compra"
            texto="Atualiza os preços"
          />
          {/*
            "O que fazer" no lugar de "Produzi hoje" quando há encomenda
            esperando: de manhã a pergunta dela é o que assar, não o que já
            assou. Sem nada pendente, o atalho de registrar produção volta.
          */}
          {plano.totalDeItens > 0 ? (
            <Atalho
              href="/producao/plano"
              icone={ClipboardList}
              titulo="O que fazer hoje"
              texto={`${formatarNumero(plano.totalDeUnidades)} ${plano.totalDeUnidades === 1 ? "doce" : "doces"} na fila`}
            />
          ) : (
            <Atalho
              href="/producao/nova"
              icone={CookingPot}
              titulo="Produzi hoje"
              texto="Baixa o estoque"
            />
          )}
          <Atalho
            href="/receitas/nova"
            icone={ChefHat}
            titulo="Nova receita"
            texto="Calcula o custo"
          />
          <Atalho
            href="/produtos"
            icone={Tags}
            titulo="Ver meus preços"
            texto={`${formatarNumero(totalProdutos)} ${totalProdutos === 1 ? "produto" : "produtos"}`}
          />
        </div>
      </section>
    </div>
  );
}

function Numero({
  titulo,
  valor,
  className,
  destaque,
}: {
  titulo: string;
  valor: number;
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
        <p className={cn("num text-2xl font-semibold", className)}>
          {formatarMoeda(valor)}
        </p>
      </CardContent>
    </Card>
  );
}

function Alerta({
  tom,
  icone: Icone,
  titulo,
  texto,
  href,
  acao,
}: {
  tom: "danger" | "warning";
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
  href: string;
  acao: string;
}) {
  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          "transition-colors",
          tom === "danger"
            ? "border-danger/30 bg-danger-soft/25 hover:border-danger/50"
            : "border-warning/30 bg-warning-soft/25 hover:border-warning/50",
        )}
      >
        <CardContent className="flex items-start gap-3 py-4">
          <div
            className={cn(
              "mt-0.5 shrink-0 rounded-full p-2",
              tom === "danger"
                ? "bg-danger text-danger-foreground"
                : "bg-warning text-warning-foreground",
            )}
          >
            <Icone className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{titulo}</p>
            <p className="text-muted-foreground truncate text-xs">{texto}</p>
          </div>

          <span className="text-muted-foreground mt-1 flex shrink-0 items-center gap-1 text-xs">
            {acao}
            <ArrowRight className="size-3.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function Atalho({
  href,
  icone: Icone,
  titulo,
  texto,
}: {
  href: string;
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/40 h-full transition-colors">
        <CardContent className="py-4">
          <Icone className="text-primary mb-2 size-5" />
          <p className="text-sm font-medium">{titulo}</p>
          <p className="text-muted-foreground text-xs">{texto}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
