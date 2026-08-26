"use client";

import type { Alergeno } from "@/generated/prisma/enums";
import { ALERGENOS_EM_ORDEM, ROTULO_ALERGENO } from "@/lib/alergenos";
import { cn } from "@/lib/utils";

/**
 * Escolha dos alergênicos de um insumo.
 *
 * Usa checkbox de verdade (não o do Radix) porque assim o formulário envia
 * sozinho, com `getAll("alergenos")`, sem precisar de campo escondido nem de
 * estado no React.
 *
 * A ordem é a do Anexo da RDC 26/2015 — a mesma da etiqueta. Ver a lista
 * sempre na mesma ordem é o que deixa ela conferir rápido.
 */
export function SeletorAlergenos({
  campo,
  selecionados,
  tom = "contem",
}: {
  /** Nome do campo no formulário: "alergenos" ou "alergenosTraco" */
  campo: string;
  selecionados: Alergeno[];
  tom?: "contem" | "traco";
}) {
  const marcados = new Set(selecionados);

  return (
    <div className="flex flex-wrap gap-1.5">
      {ALERGENOS_EM_ORDEM.map((alergeno) => (
        <label
          key={alergeno}
          className={cn(
            "group relative cursor-pointer rounded-md border px-2.5 py-1.5 text-xs transition-colors",
            "hover:bg-accent focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-1",
            tom === "contem"
              ? "has-checked:border-danger/45 has-checked:bg-danger/10 has-checked:text-danger has-checked:font-medium"
              : "has-checked:border-warning/45 has-checked:bg-warning/10 has-checked:text-warning has-checked:font-medium",
          )}
        >
          <input
            type="checkbox"
            name={campo}
            value={alergeno}
            defaultChecked={marcados.has(alergeno)}
            className="sr-only"
          />
          {ROTULO_ALERGENO[alergeno]}
        </label>
      ))}
    </div>
  );
}
