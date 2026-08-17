"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { entrar, type EstadoLogin } from "./acoes";

export function FormularioLogin({ voltar }: { voltar?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(
    entrar,
    {},
  );
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    <form action={acao} className="space-y-5">
      {voltar ? <input type="hidden" name="voltar" value={voltar} /> : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          placeholder="simone@doceria.local"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <div className="relative">
          <Input
            id="senha"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-2 transition-colors"
            aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
          >
            {mostrarSenha ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {estado.erro ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11 w-full text-base" disabled={enviando}>
        {enviando ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            <LogIn className="size-4" />
            Entrar
          </>
        )}
      </Button>
    </form>
  );
}
