import { prisma } from "@/lib/db";

import { PainelCameras, type CameraDaLista } from "./painel-cameras";

export const dynamic = "force-dynamic";

export default async function PaginaCameras() {
  const cameras = await prisma.camera.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });

  const lista: CameraDaLista[] = cameras.map((c) => ({
    id: c.id,
    nome: c.nome,
    local: c.local,
    tipo: c.tipo,
    url: c.url,
    streamId: c.streamId,
    ordem: c.ordem,
    ativo: c.ativo,
  }));

  return <PainelCameras cameras={lista} />;
}
