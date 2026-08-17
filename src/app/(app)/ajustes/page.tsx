import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaAjustes() {
  return (
    <EmConstrucao
      fase="Fase 3"
      titulo="Ajustes"
      recursos={[
        "Definir quanto vale sua hora de trabalho",
        "Configurar margem de lucro, taxa de cartão e impostos",
        "Cadastrar os dados da doceria",
        "Trocar sua senha e fazer backup dos dados",
      ]}
    />
  );
}
