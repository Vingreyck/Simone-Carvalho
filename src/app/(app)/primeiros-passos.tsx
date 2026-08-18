import Link from "next/link";
import { ArrowRight, ChefHat, Check, ShoppingCart, Sliders, Tags } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatarNumero } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/**
 * O painel do sistema recém-instalado.
 *
 * Ela nunca usou sistema nenhum — abrir num painel de números zerados não
 * ensinaria nada. Some sozinho assim que existir a primeira compra ou receita.
 */
export function PrimeirosPassos({
  totalInsumos,
  temCompra,
  temReceita,
  temProduto,
  precificacaoConfigurada,
}: {
  totalInsumos: number;
  temCompra: boolean;
  temReceita: boolean;
  temProduto: boolean;
  precificacaoConfigurada: boolean;
}) {
  const passos = [
    {
      feito: true,
      titulo: "Entrar no sistema",
      texto: "Pronto! Você já pode instalar no celular pelo menu do navegador.",
      href: null,
      icone: Check,
    },
    {
      feito: temCompra,
      titulo: "Lançar a primeira compra",
      texto:
        "É a compra que dá preço aos insumos. Sem ela, o custo das receitas fica zerado.",
      href: "/compras/nova",
      icone: ShoppingCart,
    },
    {
      feito: precificacaoConfigurada,
      titulo: "Configurar a precificação",
      texto:
        "Quanto vale sua hora de trabalho e quanto você gasta de fixo por mês (gás, luz, aluguel).",
      href: "/ajustes",
      icone: Sliders,
    },
    {
      feito: temReceita,
      titulo: "Cadastrar a primeira ficha técnica",
      texto:
        "Uma receita com os ingredientes e as quantidades. O custo aparece sozinho.",
      href: "/receitas/nova",
      icone: ChefHat,
    },
    {
      feito: temProduto,
      titulo: "Criar o primeiro produto",
      texto: "Aí o sistema te diz por quanto vender pra ter o lucro que você quer.",
      href: "/produtos/novo",
      icone: Tags,
    },
  ];

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
              {formatarNumero(totalInsumos)} insumos
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
      </section>
    </div>
  );
}
