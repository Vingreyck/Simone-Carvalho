"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { GRUPOS_NAV, ITEM_AJUSTES, ITENS_CELULAR, itemAtivo } from "@/lib/navegacao";
import { MarcaCompleta } from "@/components/marca";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Barra de baixo do celular — polegar alcança tudo.
 * Só os 4 módulos do dia a dia ficam fixos; o resto abre no "Mais".
 */
export function NavInferior() {
  const pathname = usePathname();
  const ativo = itemAtivo(pathname);
  const [menuAberto, setMenuAberto] = useState(false);

  const ehSecundario = !ITENS_CELULAR.some((i) => i.href === ativo?.href);

  return (
    <nav
      className="bg-card/95 supports-[backdrop-filter]:bg-card/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {ITENS_CELULAR.map((item) => {
          const Icone = item.icone;
          const estaAtivo = ativo?.href === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={estaAtivo ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors",
                  estaAtivo
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icone className="size-5" />
                <span className="max-w-full truncate">
                  {rotuloCurto(item.titulo)}
                </span>
              </Link>
            </li>
          );
        })}

        <li>
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger
              className={cn(
                "flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors",
                ehSecundario
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Menu className="size-5" />
              Mais
            </SheetTrigger>

            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <MarcaCompleta tamanho="sm" />
              </SheetHeader>

              <div className="space-y-5 px-4 pb-8">
                {GRUPOS_NAV.map((grupo) => (
                  <div key={grupo.titulo}>
                    <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
                      {grupo.titulo}
                    </p>

                    <ul className="space-y-1">
                      {grupo.itens.map((item) => {
                        const Icone = item.icone;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setMenuAberto(false)}
                              className={cn(
                                "flex items-start gap-3 rounded-lg p-3 transition-colors",
                                ativo?.href === item.href
                                  ? "bg-accent"
                                  : "hover:bg-accent/60",
                              )}
                            >
                              <Icone className="text-primary mt-0.5 size-5 shrink-0" />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium">
                                  {item.titulo}
                                </span>
                                <span className="text-muted-foreground block text-xs">
                                  {item.descricao}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

                <Link
                  href={ITEM_AJUSTES.href}
                  onClick={() => setMenuAberto(false)}
                  className="hover:bg-accent/60 flex items-start gap-3 rounded-lg border p-3 transition-colors"
                >
                  <ITEM_AJUSTES.icone className="text-primary mt-0.5 size-5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">
                      {ITEM_AJUSTES.titulo}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {ITEM_AJUSTES.descricao}
                    </span>
                  </span>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

/** "Fichas técnicas" não cabe embaixo de um ícone de 20px. */
function rotuloCurto(titulo: string): string {
  const curtos: Record<string, string> = {
    "Fichas técnicas": "Fichas",
    "Produtos e preços": "Produtos",
    "Vendas e encomendas": "Vendas",
  };
  return curtos[titulo] ?? titulo;
}
