"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { normalizarTexto } from "@/lib/format";
import { ROTULO_CATEGORIA } from "@/lib/constantes";
import type { CategoriaInsumo } from "@/generated/prisma/enums";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type OpcaoInsumo = {
  id: string;
  nome: string;
  categoria: CategoriaInsumo;
};

/**
 * Busca de insumo com teclado. São 65+ itens — rolar uma lista inteira toda vez
 * que ela lança uma compra seria cansativo. Digitar "acu" e achar "Açúcar"
 * (sem acento) é o comportamento esperado.
 */
export function SeletorInsumo({
  insumos,
  valor,
  onChange,
  placeholder = "Escolher insumo...",
  idsFrequentes = [],
}: {
  insumos: OpcaoInsumo[];
  valor: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Os que ela mais usa — sobem pro topo, na ordem recebida */
  idsFrequentes?: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const selecionado = insumos.find((i) => i.id === valor);

  /**
   * São 65 insumos, mas ela usa os mesmos dez quase sempre. Deixar os
   * frequentes no topo economiza rolagem em quase toda linha de compra e de
   * receita — que é onde o tempo dela some.
   */
  const frequentes = idsFrequentes
    .map((id) => insumos.find((i) => i.id === id))
    .filter((i): i is OpcaoInsumo => Boolean(i));

  const idsNoTopo = new Set(frequentes.map((i) => i.id));

  // O resto vai agrupado por categoria, pra lista não virar um paredão de nomes
  const porCategoria = insumos
    .filter((i) => !idsNoTopo.has(i.id))
    .reduce<Record<string, OpcaoInsumo[]>>((acc, insumo) => {
      (acc[insumo.categoria] ??= []).push(insumo);
      return acc;
    }, {});

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className={cn(
            "h-11 w-full justify-between font-normal",
            !selecionado && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selecionado?.nome ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0"
        align="start"
      >
        <Command
          filter={(value, search) =>
            normalizarTexto(value).includes(normalizarTexto(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder="Digite pra buscar..." />
          <CommandList>
            <CommandEmpty>Nenhum insumo com esse nome.</CommandEmpty>

            {frequentes.length > 0 ? (
              <CommandGroup heading="Que você mais usa">
                {frequentes.map((insumo) => (
                  <CommandItem
                    key={insumo.id}
                    value={insumo.nome}
                    onSelect={() => {
                      onChange(insumo.id);
                      setAberto(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        valor === insumo.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {insumo.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {Object.entries(porCategoria).map(([categoria, itens]) => (
              <CommandGroup
                key={categoria}
                heading={ROTULO_CATEGORIA[categoria as CategoriaInsumo]}
              >
                {itens.map((insumo) => (
                  <CommandItem
                    key={insumo.id}
                    value={insumo.nome}
                    onSelect={() => {
                      onChange(insumo.id);
                      setAberto(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        valor === insumo.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {insumo.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
