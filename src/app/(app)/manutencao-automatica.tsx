"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { rodarManutencao } from "./acoes-manutencao";

/**
 * Dispara a rotina automática quando ela abre o painel.
 *
 * Não desenha nada. Só existe porque o Railway roda um serviço web, sem
 * agendador: alguém precisa puxar o gatilho, e a única pessoa que abre o
 * sistema é ela.
 *
 * O painel só monta este componente quando a rotina está vencida — a decisão é
 * do servidor. Assim o caso comum (ela abrindo o painel dez vezes no dia) não
 * custa nem uma requisição a mais.
 */
export function ManutencaoAutomatica() {
  const router = useRouter();
  const jaDisparou = useRef(false);

  useEffect(() => {
    // O efeito roda duas vezes em desenvolvimento (StrictMode). A rotina já se
    // protege no banco, mas evitar a segunda chamada é de graça.
    if (jaDisparou.current) return;
    jaDisparou.current = true;

    rodarManutencao()
      // As contas do mês e o estoque mínimo podem ter mudado o que a tela mostra
      .then(() => router.refresh())
      .catch(() => {});
  }, [router]);

  return null;
}
