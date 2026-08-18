"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { trocarSenha, type Resultado } from "./acoes";

export function FormularioSenha() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    trocarSenha,
    { ok: false },
  );

  useEffect(() => {
    if (estado.ok) {
      toast.success("Senha trocada.");
      formRef.current?.reset();
    }
  }, [estado]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="text-primary size-4" />
          Trocar senha
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form ref={formRef} action={acao} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senhaAtual">Senha atual</Label>
            <Input
              id="senhaAtual"
              name="senhaAtual"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 sm:max-w-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senhaNova">Senha nova</Label>
            <Input
              id="senhaNova"
              name="senhaNova"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="h-11 sm:max-w-xs"
            />
            <p className="text-muted-foreground text-xs">
              Pelo menos 8 caracteres.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmacao">Repita a senha nova</Label>
            <Input
              id="confirmacao"
              name="confirmacao"
              type="password"
              autoComplete="new-password"
              required
              className="h-11 sm:max-w-xs"
            />
          </div>

          {estado.erro ? (
            <Alert variant="destructive">
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={enviando}>
              {enviando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Trocando...
                </>
              ) : (
                "Trocar senha"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
