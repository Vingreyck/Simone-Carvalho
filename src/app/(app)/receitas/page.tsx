import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaReceitas() {
  return (
    <EmConstrucao
      fase="Fase 2"
      titulo="Fichas técnicas"
      recursos={[
        "Cadastrar cada receita com ingredientes e quantidades",
        "Usar sub-receitas: o recheio de brigadeiro vira item de 10 bolos diferentes",
        "Ver o custo da receita calculado sozinho, sempre atualizado",
        "Guardar o modo de preparo e o tempo de produção",
      ]}
    />
  );
}
