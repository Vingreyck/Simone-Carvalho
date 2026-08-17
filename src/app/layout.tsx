import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, Parisienne } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProvedorTema } from "@/components/provedor-tema";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Serifada quente — títulos e números grandes, sem perder legibilidade. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

/** Manuscrita da marca — só no nome "Simone Carvalho". */
const parisienne = Parisienne({
  variable: "--font-parisienne",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Simone Carvalho Doceria",
    template: "%s · Simone Carvalho Doceria",
  },
  description:
    "Controle de insumos, fichas técnicas, precificação, financeiro e câmeras da doceria.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Doceria",
    statusBarStyle: "default",
  },
  // Os ícones vêm por convenção de arquivo: src/app/icon.png e apple-icon.png
  // Sistema interno — não deve aparecer em busca
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6ec" },
    { media: "(prefers-color-scheme: dark)", color: "#20231b" },
  ],
  width: "device-width",
  initialScale: 1,
  // Deixa ela dar zoom — vai usar de perto na cozinha, com a mão suja de farinha
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${parisienne.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ProvedorTema>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
        </ProvedorTema>
      </body>
    </html>
  );
}
