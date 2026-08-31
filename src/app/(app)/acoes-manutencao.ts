"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/auth";
import { chaveDoMes } from "@/lib/faturamento";
import { manutencaoVencida } from "@/lib/manutencao";
import { preencherMinimosZerados } from "@/server/estoque-minimo";

import {
  gerarContasDoMes,
  recalcularPercentualCustosFixos,
} from "./financeiro/acoes";

/**
 * A rotina que roda sozinha.
 *
 * O sistema é um serviço web só no Railway, sem agendador — então não existe
 * "toda madrugada". A rotina é disparada quando ela abre o painel, no máximo
 * uma vez a cada meio dia, e a linha `ManutencaoAutomatica` é o que impede de
 * rodar de novo a cada F5.
 *
 * Três tarefas que ela teria que lembrar de fazer na mão:
 *
 * 1. **Gerar as contas fixas do mês.** Se esquecer, o "Saiu este mês" mente
 *    pra menos e o alerta de conta vencida nunca dispara.
 * 2. **Remedir o faturamento e o % de custos fixos.** É o divisor do preço de
 *    todo doce; se congelar, o preço sugerido erra em silêncio.
 * 3. **Preencher o estoque mínimo dos insumos zerados.** Sem mínimo, o aviso
 *    de "insumo acabando" e a lista de compras simplesmente não existem.
 *
 * Nada aqui pode derrubar o painel: cada tarefa falha sozinha e o resto segue.
 */

export async function rodarManutencao(): Promise<void> {
  await exigirSessao();

  const agora = new Date();
  const marca = await prisma.manutencaoAutomatica.findUnique({
    where: { id: "default" },
  });

  // O painel já checou antes de montar o gatilho. Checa de novo porque entre
  // as duas coisas pode ter passado outra aba.
  if (!manutencaoVencida(marca?.ultimaExecucao, agora)) return;

  /*
    Marca ANTES de trabalhar.

    Ela abre o painel no celular e no computador quase junto; sem essa reserva
    as duas execuções rodariam em paralelo e disputariam a mesma escrita.
    Perder uma execução é irrelevante (a próxima é daqui a algumas horas);
    rodar duas vezes ao mesmo tempo, não.
  */
  await prisma.manutencaoAutomatica.upsert({
    where: { id: "default" },
    update: { ultimaExecucao: agora },
    create: { id: "default", ultimaExecucao: agora },
  });

  await tentar("gerar as contas do mês", () =>
    gerarContasDoMes(chaveDoMes(agora)),
  );

  // Depois das contas: o percentual sai da soma delas
  await tentar("recalcular o percentual de custos fixos", () =>
    recalcularPercentualCustosFixos(),
  );

  /*
    Guarda quantos mínimos foram preenchidos pra o painel poder explicar.

    Sem isso, o dia em que a rotina preenche 12 mínimos é o dia em que o painel
    salta de "tudo em ordem" pra "12 insumos acabando" — e ela não tem como
    saber que foi o sistema que passou a olhar, não o estoque que despencou.
  */
  await tentar("preencher o estoque mínimo", async () => {
    const quantos = await preencherMinimosZerados();
    if (quantos === 0) return;

    await prisma.manutencaoAutomatica.update({
      where: { id: "default" },
      data: { minimosPreenchidos: quantos, minimosPreenchidosEm: agora },
    });
  });

  revalidatePath("/");
  revalidatePath("/financeiro");
  revalidatePath("/estoque");
}

/**
 * Roda uma tarefa e engole o erro.
 *
 * A manutenção é um bônus rodando por trás de uma tela que ela abriu pra ver
 * outra coisa. Se a geração das contas quebrar, o painel não pode quebrar
 * junto — nem a próxima tarefa deixar de rodar.
 */
async function tentar(oQue: string, tarefa: () => Promise<unknown>) {
  try {
    await tarefa();
  } catch (erro) {
    console.error(`[manutenção] falhou ao ${oQue}:`, erro);
  }
}
