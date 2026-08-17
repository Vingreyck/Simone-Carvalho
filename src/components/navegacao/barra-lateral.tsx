"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { GRUPOS_NAV, ITEM_AJUSTES, itemAtivo } from "@/lib/navegacao";
import { MarcaCompleta } from "@/components/marca";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Barra lateral do notebook. No celular ela não aparece (vira a barra de baixo). */
export function BarraLateral() {
  const pathname = usePathname();
  const ativo = itemAtivo(pathname);

  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 flex-col border-r lg:flex">
      <div className="border-sidebar-border flex h-16 items-center border-b px-5">
        <Link href="/" aria-label="Ir para o painel">
          <MarcaCompleta tamanho="sm" />
        </Link>
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-6 p-3">
          {GRUPOS_NAV.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="text-muted-foreground mb-1.5 px-3 text-[11px] font-semibold tracking-wider uppercase">
                {grupo.titulo}
              </p>

              <ul className="space-y-0.5">
                {grupo.itens.map((item) => (
                  <li key={item.href}>
                    <LinkNav item={item} ativo={ativo?.href === item.href} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-sidebar-border border-t p-3">
        <LinkNav item={ITEM_AJUSTES} ativo={ativo?.href === ITEM_AJUSTES.href} />
      </div>
    </aside>
  );
}

function LinkNav({
  item,
  ativo,
}: {
  item: (typeof GRUPOS_NAV)[number]["itens"][number];
  ativo: boolean;
}) {
  const Icone = item.icone;

  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        ativo
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icone
        className={cn(
          "size-4 shrink-0 transition-colors",
          ativo ? "text-primary" : "text-muted-foreground group-hover:text-primary",
        )}
      />
      {item.titulo}
    </Link>
  );
}
