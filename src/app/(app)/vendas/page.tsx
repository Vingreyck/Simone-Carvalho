import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaVendas() {
  return (
    <EmConstrucao
      fase="Fase 4"
      titulo="Vendas e encomendas"
      recursos={[
        "Registrar pedidos com cliente, data de entrega e itens",
        "Acompanhar o status: orçamento, confirmado, produzindo, entregue",
        "Controlar o sinal pago e o que falta receber",
        "Ver a agenda de entregas da semana",
      ]}
    />
  );
}
