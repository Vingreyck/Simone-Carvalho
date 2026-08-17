import type { MetadataRoute } from "next";

/**
 * Manifest do PWA — é o que permite a Simone instalar o sistema na tela
 * inicial do celular e abrir sem a barra do navegador, igual a um app normal.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Simone Carvalho Doceria",
    short_name: "Doceria",
    description:
      "Controle de insumos, fichas técnicas, precificação, financeiro e câmeras da doceria.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#C9D1AE",
    theme_color: "#C9D1AE",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["business", "productivity", "food"],
    icons: [
      {
        src: "/icons/icone.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icone-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // O Android recorta o ícone em círculo — esta versão tem folga nas bordas
        src: "/icons/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Lançar compra",
        short_name: "Compra",
        url: "/compras",
      },
      {
        name: "Ver estoque",
        short_name: "Estoque",
        url: "/estoque",
      },
      {
        name: "Câmeras da loja",
        short_name: "Câmeras",
        url: "/cameras",
      },
    ],
  };
}
