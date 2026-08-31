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
  onChange,
  tom = "contem",
}: {
  /** Nome do campo no formulário: "alergenos" ou "alergenosTraco" */
  campo: string;
  selecionados: Alergeno[];
  /**
   * Controlado porque a leitura do rótulo por foto precisa marcar os campos
   * sozinha. Sem isso a IA não teria como preencher a tela.
   */
  onChange: (alergenos: Alergeno[]) => void;
  tom?: "contem" | "traco";
}) {
  const marcados = new Set(selecionados);

  function alternar(alergeno: Alergeno, marcar: boolean) {
    const novo = new Set(marcados);
    if (marcar) novo.add(alergeno);
    else novo.delete(alergeno);

    // Devolve na ordem da norma, não na ordem em que ela clicou
    onChange(ALERGENOS_EM_ORDEM.filter((a) => novo.has(a)));
  }

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
            checked={marcados.has(alergeno)}
            onChange={(e) => alternar(alergeno, e.target.checked)}
            className="sr-only"
          />
          {ROTULO_ALERGENO[alergeno]}
        </label>
      ))}
    </div>
  );
}
