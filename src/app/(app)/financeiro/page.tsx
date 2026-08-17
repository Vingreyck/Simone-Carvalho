import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaFinanceiro() {
  return (
    <EmConstrucao
      fase="Fase 3"
      titulo="Financeiro"
      recursos={[
        "Controlar contas a pagar e a receber",
        "Ver o fluxo de caixa do mês",
        "Cadastrar os custos fixos (gás, luz, aluguel) que entram no preço",
        "Saber o lucro real por período e por produto",
      ]}
    />
  );
}
