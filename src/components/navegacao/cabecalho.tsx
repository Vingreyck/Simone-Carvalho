"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { LogOut, Moon, Settings, Sun } from "lucide-react";

import { itemAtivo } from "@/lib/navegacao";
import { MarcaIcone } from "@/components/marca";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Cabecalho({ nomeUsuaria }: { nomeUsuaria: string }) {
  const pathname = usePathname();
  const ativo = itemAtivo(pathname);
  const { resolvedTheme, setTheme } = useTheme();

  const iniciais = nomeUsuaria
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:px-6">
      {/* No celular a marca fica aqui, já que não tem barra lateral */}
      <Link href="/" className="lg:hidden" aria-label="Ir para o painel">
        <MarcaIcone className="size-8" />
      </Link>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold lg:text-xl">
          {ativo?.titulo ?? "Painel"}
        </h1>
        {ativo?.descricao ? (
          <p className="text-muted-foreground hidden truncate text-xs lg:block">
            {ativo.descricao}
          </p>
        ) : null}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label="Alternar tema claro e escuro"
      >
        <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="bg-accent text-accent-foreground rounded-full text-xs font-semibold"
            aria-label="Menu da conta"
          >
            {iniciais}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{nomeUsuaria}</p>
            <p className="text-muted-foreground text-xs">Dona da doceria</p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/ajustes">
              <Settings className="size-4" />
              Ajustes
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild variant="destructive">
            <form action="/api/sair" method="post" className="w-full">
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut className="size-4" />
                Sair
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
