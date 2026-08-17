import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESSAO, lerToken } from "@/lib/sessao";

/**
 * Porteiro do sistema: sem cookie de sessão válido, só o login é acessível.
 *
 * É o antigo `middleware.ts` — no Next 16 a convenção passou a se chamar `proxy`.
 *
 * Roda no Edge Runtime, então aqui só dá pra conferir a ASSINATURA do token —
 * nada de banco. A checagem "essa conta ainda existe e está ativa" é feita
 * pelas páginas/actions com `exigirUsuarioAtivo()`.
 */

const ROTAS_PUBLICAS = ["/entrar"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  const sessao = token ? await lerToken(token) : null;
  const ehRotaPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));

  // Já logada tentando abrir o login → manda pro painel
  if (sessao && ehRotaPublica) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!sessao && !ehRotaPublica) {
    const login = new URL("/entrar", request.url);
    // Guarda onde ela queria ir pra voltar pra lá depois de entrar
    if (pathname !== "/") login.searchParams.set("voltar", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Tudo, menos:
     *  - rotas internas do Next (_next/static, _next/image)
     *  - arquivos públicos (ícones, manifest, imagens)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
