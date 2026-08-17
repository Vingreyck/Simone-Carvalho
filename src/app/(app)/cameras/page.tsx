import { EmConstrucao } from "@/components/em-construcao";

export default function PaginaCameras() {
  return (
    <EmConstrucao
      fase="Fase 5"
      titulo="Câmeras da loja"
      recursos={[
        "Ver todas as câmeras ao vivo numa tela só",
        "Abrir uma câmera em tela cheia",
        "Acessar de qualquer lugar, pelo celular",
        "Tudo por conexão segura, sem abrir porta no roteador",
      ]}
    />
  );
}
