import { exigirUsuarioAtivo } from "@/lib/auth";
import { BarraLateral } from "@/components/navegacao/barra-lateral";
import { NavInferior } from "@/components/navegacao/nav-inferior";
import { Cabecalho } from "@/components/navegacao/cabecalho";

/**
 * Casca do sistema. Tudo aqui dentro exige estar logada — o middleware já
 * barra antes, mas `exigirUsuarioAtivo` confere no banco se a conta segue ativa.
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const usuaria = await exigirUsuarioAtivo();

  return (
    <div className="flex min-h-dvh">
      <BarraLateral />

      <div className="flex min-w-0 flex-1 flex-col">
        <Cabecalho nomeUsuaria={usuaria.nome} />

        {/* pb extra no celular pra o conteúdo não sumir atrás da barra de baixo */}
        <main className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>

      <NavInferior />
    </div>
  );
}
