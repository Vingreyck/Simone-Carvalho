import Link from "next/link";
import {
  ArrowRight,
  ChefHat,
  Check,
  Receipt,
  ShoppingCart,
  Sliders,
  Tags,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatarNumero } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/**
 * O roteiro de instalação.
 *
 * Enquanto o sistema está totalmente vazio ele ocupa o painel inteiro
 * (`PrimeirosPassos`): abrir num painel de números zerados não ensinaria nada.
 *
 * ⚠️ Depois da primeira compra ele NÃO some. Sumia — e ela perdia o roteiro
 * na segunda de cinco etapas, bem quando ainda faltava configurar preço, ficha
 * técnica e produto. O painel real já tem conteúdo a partir da primeira compra,
 * então a partir dali o roteiro vira uma faixa fina (`RoteiroPendente`) que
 * acompanha em cima, e só desaparece quando termina de verdade.
 */

export type EstadoDoRoteiro = {
  totalInsumos: number;
  temCompra: boolean;
  temHoraDeTrabalho: boolean;
  temContaFixa: boolean;
  temReceita: boolean;
  temProduto: boolean;
};

export type Passo = {
  feito: boolean;
  titulo: string;
  texto: string;
  href: string | null;
  icone: React.ComponentType<{ className?: string }>;
};

/**
 * A lista de etapas, num lugar só — a tela cheia e a faixa fina leem daqui.
 *
 * A ordem é a que faz sentido pra ela, não a do modelo de dados: primeiro o que
 * dá preço aos insumos, depois o que transforma preço em custo de doce.
 */
export function montarPassos(estado: EstadoDoRoteiro): Passo[] {
  return [
    {
      feito: true,
      titulo: "Entrar no sistema",
      texto: "Pronto! Você já pode instalar no celular pelo menu do navegador.",
      href: null,
      icone: Check,
    },
    {
      feito: estado.temCompra,
      titulo: "Lançar a primeira compra",
      texto:
        "É a compra que dá preço aos insumos. Sem ela, o custo das receitas fica zerado.",
      href: "/compras/nova",
      icone: ShoppingCart,
    },
    {
      /*
        Só a hora de trabalho conta aqui.

        Antes bastava ter QUALQUER percentual preenchido, e o sistema nasce com
        15% de custos fixos chutado — então este passo aparecia como feito com a
        hora dela valendo zero. Trabalhar de graça é justamente o erro que faz o
        lucro parecer maior do que é.
      */
      feito: estado.temHoraDeTrabalho,
      titulo: "Dizer quanto vale sua hora",
      texto:
        "O tempo de preparo de cada receita vira dinheiro por aqui. Se você não se pagar, o lucro é ilusão.",
      href: "/ajustes",
      icone: Sliders,
    },
    {
      /*
        Virou passo próprio porque agora é ele que alimenta o % de custos fixos
        do preço: com as contas cadastradas o sistema calcula a porcentagem
        sozinho, em vez de usar o chute de 15% que veio de fábrica.
      */
      feito: estado.temContaFixa,
      titulo: "Cadastrar as contas do mês",
      texto:
        "Gás, luz, água, aluguel. O sistema divide isso entre os doces sozinho — e passa a lançar as contas todo mês pra você.",
      href: "/financeiro",
      icone: Receipt,
    },
    {
      feito: estado.temReceita,
      titulo: "Cadastrar a primeira ficha técnica",
      texto:
        "Uma receita com os ingredientes e as quantidades. O custo aparece sozinho.",
      href: "/receitas/nova",
      icone: ChefHat,
    },
    {
      feito: estado.temProduto,
      titulo: "Criar o primeiro produto",
      texto: "Aí o sistema te diz por quanto vender pra ter o lucro que você quer.",
      href: "/produtos/novo",
      icone: Tags,
    },
  ];
}

/** O painel do sistema recém-instalado, quando ainda não existe nada. */
export function PrimeirosPassos({ estado }: { estado: EstadoDoRoteiro }) {
  const passos = montarPassos(estado);
  const concluidos = passos.filter((p) => p.feito).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="border-gold-hairline from-sage-soft/60 to-card bg-gradient-to-br">
        <CardContent className="py-7">
          <Badge variant="secondary" className="mb-3">
            Sistema recém-instalado
          </Badge>

          <h2 className="text-2xl font-semibold">Bem-vinda, Simone!</h2>

          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            O sistema já veio com{" "}
            <strong className="text-foreground">
              {formatarNumero(estado.totalInsumos)} insumos
            </strong>{" "}
            de confeitaria cadastrados, com as unidades e medidas caseiras
            (xícara, colher, lata) já configuradas. Falta só dizer quanto você
            paga em cada um — e isso acontece quando você lança a primeira compra.
          </p>

          <div className="mt-6 max-w-md space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Primeiros passos</span>
              <span className="font-medium">
                {concluidos} de {passos.length}
              </span>
            </div>
            <Progress
              value={Math.round((concluidos / passos.length) * 100)}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Comece por aqui</h2>
        <ListaDePassos passos={passos} />
      </section>
    </div>
  );
}

/**
 * A faixa fina que acompanha o painel enquanto o roteiro não terminou.
 *
 * Mostra UMA etapa por vez — a próxima. A lista inteira aqui competiria com os
 * avisos do dia; o que ela precisa saber é qual é o próximo passo e quanto
 * falta.
 */
export function RoteiroPendente({ estado }: { estado: EstadoDoRoteiro }) {
  const passos = montarPassos(estado);
  const proximo = passos.find((p) => !p.feito);

  if (!proximo) return null;

  const concluidos = passos.filter((p) => p.feito).length;
  const faltam = passos.length - concluidos;

  const conteudo = (
    <Card className="border-gold-hairline from-sage-soft/40 to-card bg-gradient-to-br transition-colors">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="bg-accent text-primary mt-0.5 shrink-0 rounded-full p-2">
            <proximo.icone className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Falta {faltam === 1 ? "1 passo" : `${faltam} passos`} pro sistema
              calcular seus preços
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Próximo: <strong className="text-foreground">{proximo.titulo}</strong>{" "}
              — {proximo.texto}
            </p>

            <Progress
              value={Math.round((concluidos / passos.length) * 100)}
              className="mt-3 h-1.5 max-w-xs"
            />
          </div>

          {proximo.href ? (
            <ArrowRight className="text-muted-foreground mt-2 size-4 shrink-0" />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  return proximo.href ? (
    <Link href={proximo.href} className="block">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

function ListaDePassos({ passos }: { passos: Passo[] }) {
  return (
    <div className="space-y-2.5">
      {passos.map((passo) => {
        const Icone = passo.icone;

        const conteudo = (
          <div
            className={cn(
              "flex items-start gap-4 rounded-xl border p-4 transition-colors",
              passo.feito
                ? "bg-success-soft/40 border-success/25"
                : "bg-card hover:border-primary/40 hover:bg-accent/40",
            )}
          >
            <div
              className={cn(
                "mt-0.5 shrink-0 rounded-full p-2",
                passo.feito
                  ? "bg-success text-success-foreground"
                  : "bg-accent text-primary",
              )}
            >
              <Icone className="size-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  passo.feito && "text-muted-foreground line-through",
                )}
              >
                {passo.titulo}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {passo.texto}
              </p>
            </div>

            {!passo.feito && passo.href ? (
              <ArrowRight className="text-muted-foreground mt-2 size-4 shrink-0" />
            ) : null}
          </div>
        );

        return passo.href && !passo.feito ? (
          <Link key={passo.titulo} href={passo.href} className="block">
            {conteudo}
          </Link>
        ) : (
          <div key={passo.titulo}>{conteudo}</div>
        );
      })}
    </div>
  );
}
