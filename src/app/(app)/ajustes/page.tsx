import { prisma } from "@/lib/db";
import { faturamentoMedioMedido } from "@/server/faturamento";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { FormularioPrecificacao } from "./formulario-precificacao";
import { FormularioNegocio } from "./formulario-negocio";
import { FormularioSenha } from "./formulario-senha";

export const dynamic = "force-dynamic";

export default async function PaginaAjustes() {
  const [precificacao, negocio, medido] = await Promise.all([
    prisma.configPrecificacao.findUnique({ where: { id: "default" } }),
    prisma.configNegocio.findUnique({ where: { id: "default" } }),
    faturamentoMedioMedido(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoPagina
        titulo="Ajustes"
        descricao="Estas contas entram no preço de todos os seus produtos."
      />

      <FormularioPrecificacao
        valores={{
          valorHoraMaoDeObra: Number(precificacao?.valorHoraMaoDeObra ?? 0),
          percentualCustosFixos: Number(precificacao?.percentualCustosFixos ?? 0),
          percentualImpostos: Number(precificacao?.percentualImpostos ?? 0),
          percentualTaxaCartao: Number(precificacao?.percentualTaxaCartao ?? 0),
          margemLucroPadrao: Number(precificacao?.margemLucroPadrao ?? 30),
          faturamentoMedioMensal: Number(
            precificacao?.faturamentoMedioMensal ?? 0,
          ),
          alertaVariacaoPreco: Number(precificacao?.alertaVariacaoPreco ?? 10),
          diasAlertaValidade: precificacao?.diasAlertaValidade ?? 7,
        }}
        faturamentoMedido={medido === null ? null : Number(medido)}
      />

      <FormularioNegocio
        valores={{
          nomeFantasia: negocio?.nomeFantasia ?? "Simone Carvalho Doceria",
          telefone: negocio?.telefone ?? "",
          whatsapp: negocio?.whatsapp ?? "",
          instagram: negocio?.instagram ?? "",
          endereco: negocio?.endereco ?? "",
          cnpj: negocio?.cnpj ?? "",
        }}
      />

      <FormularioSenha />
    </div>
  );
}
