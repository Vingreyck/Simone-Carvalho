import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaEstoque() {
  return (
    <EmConstrucao
      fase="Fase 1"
      titulo="Estoque"
      recursos={[
        "Ver quanto tem de cada insumo, na hora",
        "Ser avisada do que está acabando e do que vence nos próximos dias",
        "Registrar perdas e sobras (aquele creme que estragou)",
        "Fazer o inventário e acertar o saldo real",
      ]}
    />
  );
}
