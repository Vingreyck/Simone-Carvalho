import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaProdutos() {
  return (
    <EmConstrucao
      fase="Fase 2"
      titulo="Produtos e preços"
      recursos={[
        "Ver quanto custa fazer cada doce, de verdade",
        "Receber o preço de venda sugerido pra dar o lucro que você quer",
        "Simular: e se eu vender por R$ 45? Quanto sobra?",
        "Ser avisada quando um produto estiver sendo vendido no prejuízo",
      ]}
    />
  );
}
