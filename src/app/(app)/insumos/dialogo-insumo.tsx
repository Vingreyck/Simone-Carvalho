"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import type { Alergeno, UnidadeBase } from "@/generated/prisma/enums";
import {
  AJUDA_UNIDADE,
  CATEGORIAS,
  ROTULO_CATEGORIA,
  ROTULO_UNIDADE,
  UNIDADES,
} from "@/lib/constantes";
import { ROTULO_UNIDADE_BASE } from "@/lib/unidades";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

import { SeletorAlergenos } from "@/components/seletor-alergenos";
import { BotaoFoto } from "@/components/botao-foto";

import { lerRotuloDoInsumo, type LeituraDoRotulo } from "./acoes-ia";

import { salvarInsumo, type Resultado } from "./acoes";
import type { InsumoDaLista } from "./lista-insumos";

export function DialogoInsumo({
  aberto,
  onOpenChange,
  insumo,
  iaConfigurada,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  insumo: InsumoDaLista | null;
  iaConfigurada: boolean;
}) {
  const editando = Boolean(insumo);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editando ? "Editar insumo" : "Novo insumo"}
          </DialogTitle>
          <DialogDescription>
            {editando
              ? "Mude o que precisar. O preço não se altera aqui — ele vem das compras."
              : "Cadastre o que você compra. O preço aparece quando você lançar a primeira compra."}
          </DialogDescription>
        </DialogHeader>

        {/*
          A `key` remonta o formulário quando troca de insumo, então cada campo
          nasce já com o valor certo. É melhor que sincronizar estado num efeito:
          menos renders e sem risco de mostrar o dado do insumo anterior.
        */}
        {aberto ? (
          <FormularioInsumo
            key={insumo?.id ?? "novo"}
            insumo={insumo}
            iaConfigurada={iaConfigurada}
            onFechar={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormularioInsumo({
  insumo,
  iaConfigurada,
  onFechar,
}: {
  insumo: InsumoDaLista | null;
  iaConfigurada: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarInsumo,
    { ok: false },
  );

  const [unidade, setUnidade] = useState<UnidadeBase>(
    insumo?.unidadeBase ?? "G",
  );

  const [alergenos, setAlergenos] = useState<Alergeno[]>(insumo?.alergenos ?? []);
  const [traco, setTraco] = useState<Alergeno[]>(insumo?.alergenosTraco ?? []);
  const [lendoRotulo, setLendoRotulo] = useState(false);
  const [leitura, setLeitura] = useState<LeituraDoRotulo | null>(null);

  async function lerFotoDoRotulo(arquivo: File) {
    setLendoRotulo(true);
    setLeitura(null);
    try {
      const dados = new FormData();
      dados.set("foto", arquivo);
      const r = await lerRotuloDoInsumo(dados);

      if (!r.ok) {
        toast.error(r.erro ?? "Não consegui ler o rótulo.");
        return;
      }

      // Some com o que estava marcado: a foto é do rótulo inteiro, então ela
      // é a fonte da verdade. Somar com o antigo esconderia uma correção.
      setAlergenos(r.contem ?? []);
      setTraco(r.podeConter ?? []);
      setLeitura(r);
      toast.success("Rótulo lido. Confira antes de salvar.");
    } finally {
      setLendoRotulo(false);
    }
  }

  useEffect(() => {
    if (estado.ok) {
      toast.success(insumo ? "Insumo atualizado." : "Insumo cadastrado.");
      onFechar();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <form action={acao} className="space-y-4">
      {insumo ? <input type="hidden" name="id" value={insumo.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          name="nome"
          defaultValue={insumo?.nome ?? ""}
          placeholder="Ex.: Chocolate meio amargo"
          required
          autoFocus
          className="h-11"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="categoria">Categoria</Label>
          <Select name="categoria" defaultValue={insumo?.categoria ?? "OUTROS"}>
            <SelectTrigger id="categoria" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {ROTULO_CATEGORIA[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unidadeBase">Como você mede</Label>
          <Select
            name="unidadeBase"
            value={unidade}
            onValueChange={(v) => setUnidade(v as UnidadeBase)}
          >
            <SelectTrigger id="unidadeBase" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES.map((u) => (
                <SelectItem key={u} value={u}>
                  {ROTULO_UNIDADE[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {AJUDA_UNIDADE[unidade]}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="estoqueMinimo">Me avise quando sobrar menos que</Label>
        <div className="flex items-center gap-2">
          <Input
            id="estoqueMinimo"
            name="estoqueMinimo"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            defaultValue={insumo?.estoqueMinimo ?? 0}
            className="no-spinner h-11"
          />
          <span className="text-muted-foreground w-10 text-sm">
            {ROTULO_UNIDADE_BASE[unidade]}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Deixe 0 se não quiser aviso. Sempre em {ROTULO_UNIDADE_BASE[unidade]}.
        </p>
      </div>

      <div className="bg-muted/40 flex items-center justify-between rounded-lg border p-3">
        <div className="pr-4">
          <Label htmlFor="perecivel" className="text-sm">
            Controlar validade
          </Label>
          <p className="text-muted-foreground text-xs">
            Liga o aviso de vencimento e faz sair primeiro o que vence antes.
          </p>
        </div>
        <Switch
          id="perecivel"
          name="perecivel"
          defaultChecked={insumo?.perecivel ?? false}
        />
      </div>

      {/*
        Alergênicos. É exigência da ANVISA (RDC 26/2015), e o trabalho é feito
        UMA vez aqui: a partir daí toda receita que usar este insumo monta o
        aviso sozinha.
      */}
      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm">Alergênicos que este insumo contém</Label>
            <p className="text-muted-foreground text-xs">
              Marque o que está no rótulo. Toda receita que usar este insumo vai
              avisar sozinha — você só faz isso uma vez.
            </p>
          </div>

          {iaConfigurada ? (
            <BotaoFoto
              onFoto={lerFotoDoRotulo}
              processando={lendoRotulo}
              rotulo="Ler rótulo"
            />
          ) : null}
        </div>

        <SeletorAlergenos
          campo="alergenos"
          selecionados={alergenos}
          onChange={setAlergenos}
        />

        <div className="border-t pt-3">
          <Label className="text-sm">Pode conter (traços)</Label>
          <p className="text-muted-foreground mb-2 text-xs">
            Só o que o rótulo disser &ldquo;pode conter&rdquo; — é a
            contaminação da fábrica, e muda de marca pra marca.
          </p>
          <SeletorAlergenos
            campo="alergenosTraco"
            tom="traco"
            selecionados={traco}
            onChange={setTraco}
          />
        </div>

        {leitura?.frase ? (
          <div className="bg-muted/50 rounded-md border p-2">
            <p className="text-muted-foreground text-xs">Li isto na foto:</p>
            <p className="mt-0.5 text-xs font-medium">{leitura.frase}</p>
          </div>
        ) : null}

        {leitura?.naoEntendi && leitura.naoEntendi.length > 0 ? (
          <p className="text-warning text-xs font-medium">
            Não reconheci: {leitura.naoEntendi.join(", ")}. Se for alergênico,
            marque na mão.
          </p>
        ) : null}

        {insumo && !insumo.alergenosRevisados ? (
          <p className="text-warning text-xs font-medium">
            Este insumo ainda não foi conferido. Salvar marca como conferido.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="marcaPreferida">
          Marca preferida{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id="marcaPreferida"
          name="marcaPreferida"
          defaultValue={insumo?.marcaPreferida ?? ""}
          placeholder="Ex.: Callebaut"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacao">
          Observação{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="observacao"
          name="observacao"
          defaultValue={insumo?.observacao ?? ""}
          placeholder="Ex.: comprar sempre no atacado da rua 5"
          rows={2}
        />
      </div>

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
