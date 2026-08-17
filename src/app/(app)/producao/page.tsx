import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaProducao() {
  return (
    <EmConstrucao
      fase="Fase 3"
      titulo="Produção"
      recursos={[
        "Registrar o que produziu no dia",
        "Baixar os ingredientes do estoque automaticamente",
        "Consumir sempre o lote que vence primeiro",
        "Saber o custo real daquela fornada",
      ]}
    />
  );
}
