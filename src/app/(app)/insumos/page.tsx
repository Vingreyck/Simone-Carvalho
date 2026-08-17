import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaInsumos() {
  return (
    <EmConstrucao
      fase="Fase 1"
      titulo="Insumos"
      recursos={[
        "Cadastrar cada ingrediente com a unidade certa (g, ml ou unidade)",
        "Registrar medidas caseiras: 1 xícara de farinha = 120 g",
        "Definir o estoque mínimo pra o sistema avisar antes de acabar",
        "Ver o histórico de preço de cada insumo e quanto ele subiu",
      ]}
    />
  );
}
