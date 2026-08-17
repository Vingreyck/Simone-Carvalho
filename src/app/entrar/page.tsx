import type { Metadata } from "next";

import { MarcaCompleta } from "@/components/marca";
import { Card, CardContent } from "@/components/ui/card";

import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const voltar = typeof params.voltar === "string" ? params.voltar : undefined;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      {/* Fundo: o verde sage da marca, bem suave */}
      <div
        aria-hidden
        className="from-sage-soft via-background to-background absolute inset-0 -z-10 bg-gradient-to-br"
      />
      <div
        aria-hidden
        className="bg-gold/10 absolute -top-32 -right-32 -z-10 size-96 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-sage/20 absolute -bottom-40 -left-40 -z-10 size-[28rem] rounded-full blur-3xl"
      />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <MarcaCompleta tamanho="lg" className="flex-col text-center" />
        </div>

        <Card className="border-gold-hairline shadow-lg">
          <CardContent className="pt-6">
            <FormularioLogin voltar={voltar} />
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Sistema de uso interno da doceria.
        </p>
      </div>
    </main>
  );
}
