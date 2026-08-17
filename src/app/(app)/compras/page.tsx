import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaCompras() {
  return (
    <EmConstrucao
      fase="Fase 1"
      titulo="Compras"
      recursos={[
        "Lançar a nota do mercado com fornecedor, itens e valores",
        "Digitar do jeito que está na embalagem (2 sacos de 5 kg) — o sistema converte",
        "Registrar a validade de cada lote",
        "Gerar a conta a pagar automaticamente no financeiro",
      ]}
    />
  );
}
