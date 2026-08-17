import { NextResponse, type NextRequest } from "next/server";

import { encerrarSessao } from "@/lib/auth";

/**
 * Sair é POST de propósito: se fosse um link GET, um prefetch do navegador ou
 * uma imagem escondida em outra página conseguiria deslogar ela sem querer.
 */
export async function POST(request: NextRequest) {
  await encerrarSessao();
  return NextResponse.redirect(new URL("/entrar", request.url), {
    status: 303,
  });
}
