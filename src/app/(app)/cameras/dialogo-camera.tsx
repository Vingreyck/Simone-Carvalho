"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import type { TipoCamera } from "@/generated/prisma/enums";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { alternarAtivoCamera, salvarCamera, type Resultado } from "./acoes";
import type { CameraDaLista } from "./painel-cameras";

const TIPOS: { valor: TipoCamera; rotulo: string; ajuda: string }[] = [
  {
    valor: "GO2RTC",
    rotulo: "go2rtc (recomendado)",
    ajuda:
      "O computador da loja converte a câmera pra o navegador. É o jeito que funciona no celular de qualquer lugar.",
  },
  {
    valor: "IFRAME",
    rotulo: "Página do fabricante",
    ajuda:
      "Abre a tela do app da câmera dentro do sistema. Simples, mas nem todo fabricante permite.",
  },
  {
    valor: "MJPEG",
    rotulo: "Imagem que atualiza (MJPEG)",
    ajuda: "Funciona em tudo, mas gasta mais internet e não tem som.",
  },
  {
    valor: "HLS",
    rotulo: "HLS (.m3u8)",
    ajuda:
      "Vindo direto do gravador. Toca no iPhone; no Android costuma precisar do go2rtc.",
  },
];

export function DialogoCamera({
  aberto,
  onOpenChange,
  camera,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  camera: CameraDaLista | null;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {camera ? "Editar câmera" : "Nova câmera"}
          </DialogTitle>
          <DialogDescription>
            O sistema não guarda a senha da câmera — só o endereço de onde puxar
            a imagem.
          </DialogDescription>
        </DialogHeader>

        {aberto ? (
          <Formulario
            key={camera?.id ?? "nova"}
            camera={camera}
            onFechar={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  camera,
  onFechar,
}: {
  camera: CameraDaLista | null;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarCamera,
    { ok: false },
  );

  const [tipo, setTipo] = useState<TipoCamera>(camera?.tipo ?? "GO2RTC");
  const [ativo, setAtivo] = useState(camera?.ativo ?? true);

  useEffect(() => {
    if (estado.ok) {
      toast.success(camera ? "Câmera atualizada." : "Câmera cadastrada.");
      onFechar();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const info = TIPOS.find((t) => t.valor === tipo)!;

  return (
    <form action={acao} className="space-y-4">
      {camera ? <input type="hidden" name="id" value={camera.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            name="nome"
            defaultValue={camera?.nome ?? ""}
            placeholder="Ex.: Balcão"
            required
            autoFocus
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="local">
            Onde fica{" "}
            <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="local"
            name="local"
            defaultValue={camera?.local ?? ""}
            placeholder="Ex.: Frente da loja"
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipo">Como conectar</Label>
        <Select
          name="tipo"
          value={tipo}
          onValueChange={(v) => setTipo(v as TipoCamera)}
        >
          <SelectTrigger id="tipo" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => (
              <SelectItem key={t.valor} value={t.valor}>
                {t.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">{info.ajuda}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">
          {tipo === "GO2RTC" ? "Endereço do go2rtc" : "Endereço"}
        </Label>
        <Input
          id="url"
          name="url"
          defaultValue={camera?.url ?? ""}
          placeholder={
            tipo === "GO2RTC"
              ? "https://cameras.suadoceria.com"
              : "https://..."
          }
          required
          className="h-11"
        />
        <p className="text-muted-foreground text-xs">
          {tipo === "GO2RTC"
            ? "O endereço público que o Cloudflare Tunnel criou. Sem barra no final."
            : "O endereço completo do vídeo."}
        </p>
      </div>

      {tipo === "GO2RTC" ? (
        <div className="space-y-2">
          <Label htmlFor="streamId">Nome do stream</Label>
          <Input
            id="streamId"
            name="streamId"
            defaultValue={camera?.streamId ?? ""}
            placeholder="balcao"
            className="h-11"
          />
          <p className="text-muted-foreground text-xs">
            É o nome que você deu pra esta câmera no arquivo{" "}
            <code className="bg-muted rounded px-1 py-0.5">go2rtc.yaml</code>.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="ordem">Ordem na tela</Label>
        <Input
          id="ordem"
          name="ordem"
          type="number"
          min="0"
          max="99"
          defaultValue={camera?.ordem ?? 0}
          className="no-spinner h-11 max-w-24"
        />
      </div>

      {camera ? (
        <div className="bg-muted/40 flex items-center justify-between rounded-lg border p-3">
          <div className="pr-4">
            <Label htmlFor="ativo" className="text-sm">
              Mostrar na tela de câmeras
            </Label>
            <p className="text-muted-foreground text-xs">
              Desligue se a câmera saiu do ar — some do grid sem perder o cadastro.
            </p>
          </div>
          <Switch
            id="ativo"
            checked={ativo}
            onCheckedChange={(v) => {
              setAtivo(v);
              void alternarAtivoCamera(camera.id, v).then(() => router.refresh());
            }}
          />
        </div>
      ) : null}

      {estado.erro ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
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
      </DialogFooter>
    </form>
  );
}
