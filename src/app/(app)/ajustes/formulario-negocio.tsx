"use client";

import { useActionState, useEffect } from "react";
import { LoaderCircle, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { salvarNegocio, type Resultado } from "./acoes";

type Valores = {
  nomeFantasia: string;
  telefone: string;
  whatsapp: string;
  instagram: string;
  endereco: string;
  cnpj: string;
};

export function FormularioNegocio({ valores }: { valores: Valores }) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarNegocio,
    { ok: false },
  );

  useEffect(() => {
    if (estado.ok) toast.success("Dados da doceria salvos.");
  }, [estado]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="text-primary size-4" />
          Dados da doceria
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Vão aparecer nos orçamentos e, mais pra frente, na página de pedidos.
        </p>
      </CardHeader>

      <CardContent>
        <form action={acao} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nomeFantasia">Nome</Label>
            <Input
              id="nomeFantasia"
              name="nomeFantasia"
              defaultValue={valores.nomeFantasia}
              required
              className="h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                defaultValue={valores.whatsapp}
                placeholder="(79) 99999-9999"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                name="telefone"
                defaultValue={valores.telefone}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                name="instagram"
                defaultValue={valores.instagram}
                placeholder="@simonecarvalhodoceria"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">
                CNPJ{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                id="cnpj"
                name="cnpj"
                defaultValue={valores.cnpj}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              name="endereco"
              defaultValue={valores.endereco}
              className="h-11"
            />
          </div>

          {estado.erro ? (
            <Alert variant="destructive">
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={enviando}>
              {enviando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
