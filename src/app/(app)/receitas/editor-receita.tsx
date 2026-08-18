"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  LoaderCircle,
  Plus,
  Trash2,
  TriangleAlert,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Decimal } from "decimal.js";

import type { CategoriaInsumo, UnidadeBase } from "@/generated/prisma/enums";
import { converterParaBase, unidadesDisponiveis } from "@/lib/unidades";
import { formatarMoeda, formatarMoedaPrecisa, lerNumeroBR } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeletorInsumo } from "@/components/seletor-insumo";

import { salvarReceita, type Resultado } from "./acoes";

export type InsumoOpcao = {
  id: string;
  nome: string;
  categoria: CategoriaInsumo;
  unidadeBase: UnidadeBase;
  custoMedio: number;
  equivalencias: { nome: string; quantidadeBase: number }[];
};

export type ReceitaOpcao = {
  id: string;
  nome: string;
  rendimentoUnidade: string;
  /** Custo de 1 unidade de rendimento — usado no cálculo ao vivo */
  custoPorUnidade: number;
};

export type ReceitaExistente = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  rendimentoQuantidade: number;
  rendimentoUnidade: string;
  tempoPreparoMin: number;
  modoPreparo: string | null;
  observacao: string | null;
  itens: {
    insumoId: string | null;
    subReceitaId: string | null;
    quantidade: number;
    unidade: string;
    observacao: string | null;
  }[];
};

type Linha = {
  chave: string;
  tipo: "insumo" | "sub-receita";
  insumoId: string | null;
  subReceitaId: string | null;
  quantidade: string;
  unidade: string;
  observacao: string;
};

function linhaVazia(tipo: Linha["tipo"] = "insumo"): Linha {
  return {
    chave: crypto.randomUUID(),
    tipo,
    insumoId: null,
    subReceitaId: null,
    quantidade: "",
    unidade: "",
    observacao: "",
  };
}

export function EditorReceita({
  insumos,
  receitas,
  receita,
}: {
  insumos: InsumoOpcao[];
  receitas: ReceitaOpcao[];
  receita?: ReceitaExistente;
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarReceita,
    { ok: false },
  );

  const [nome, setNome] = useState(receita?.nome ?? "");
  const [categoria, setCategoria] = useState(receita?.categoria ?? "");
  const [rendimentoQuantidade, setRendimentoQuantidade] = useState(
    receita ? String(receita.rendimentoQuantidade) : "1",
  );
  const [rendimentoUnidade, setRendimentoUnidade] = useState(
    receita?.rendimentoUnidade ?? "",
  );
  const [tempoPreparoMin, setTempoPreparoMin] = useState(
    receita ? String(receita.tempoPreparoMin) : "",
  );
  const [modoPreparo, setModoPreparo] = useState(receita?.modoPreparo ?? "");
  const [observacao, setObservacao] = useState(receita?.observacao ?? "");

  const [linhas, setLinhas] = useState<Linha[]>(
    receita && receita.itens.length > 0
      ? receita.itens.map((i) => ({
          chave: crypto.randomUUID(),
          tipo: i.insumoId ? "insumo" : "sub-receita",
          insumoId: i.insumoId,
          subReceitaId: i.subReceitaId,
          quantidade: String(i.quantidade),
          unidade: i.unidade,
          observacao: i.observacao ?? "",
        }))
      : [linhaVazia()],
  );

  useEffect(() => {
    if (estado.ok && estado.id) {
      toast.success(receita ? "Ficha atualizada." : "Ficha técnica criada!");
      router.push(`/receitas/${estado.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const porInsumo = useMemo(
    () => new Map(insumos.map((i) => [i.id, i])),
    [insumos],
  );
  const porReceita = useMemo(
    () => new Map(receitas.map((r) => [r.id, r])),
    [receitas],
  );

  // Uma receita não pode usar ela mesma como sub-receita
  const receitasDisponiveis = useMemo(
    () => receitas.filter((r) => r.id !== receita?.id),
    [receitas, receita],
  );

  function atualizar(chave: string, campo: keyof Linha, valor: string) {
    setLinhas((atual) =>
      atual.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)),
    );
  }

  function escolherInsumo(chave: string, insumoId: string) {
    const insumo = porInsumo.get(insumoId);
    const sugerida = insumo
      ? insumo.unidadeBase === "G"
        ? "g"
        : insumo.unidadeBase === "ML"
          ? "ml"
          : "un"
      : "";

    setLinhas((atual) =>
      atual.map((l) =>
        l.chave === chave
          ? { ...l, insumoId, subReceitaId: null, unidade: l.unidade || sugerida }
          : l,
      ),
    );
  }

  function escolherSubReceita(chave: string, subReceitaId: string) {
    const sub = porReceita.get(subReceitaId);

    setLinhas((atual) =>
      atual.map((l) =>
        l.chave === chave
          ? {
              ...l,
              subReceitaId,
              insumoId: null,
              unidade: sub?.rendimentoUnidade ?? "",
            }
          : l,
      ),
    );
  }

  /**
   * Custo calculado enquanto ela digita. É o que transforma a ficha técnica
   * de "papelada" em ferramenta: ela vê na hora qual ingrediente pesa mais.
   */
  const calculo = useMemo(() => {
    let total = new Decimal(0);
    const semPreco: string[] = [];
    const porLinha = new Map<string, Decimal>();

    for (const linha of linhas) {
      const qtd = lerNumeroBR(linha.quantidade);
      if (qtd <= 0) continue;

      if (linha.tipo === "insumo" && linha.insumoId) {
        const insumo = porInsumo.get(linha.insumoId);
        if (!insumo || !linha.unidade) continue;

        try {
          const base = converterParaBase(
            qtd,
            linha.unidade,
            insumo.unidadeBase,
            insumo.equivalencias,
          );
          const custo = base.times(insumo.custoMedio);

          porLinha.set(linha.chave, custo);
          total = total.plus(custo);

          if (insumo.custoMedio <= 0) semPreco.push(insumo.nome);
        } catch {
          // Unidade que ainda não dá pra converter: ignora no total
        }
        continue;
      }

      if (linha.tipo === "sub-receita" && linha.subReceitaId) {
        const sub = porReceita.get(linha.subReceitaId);
        if (!sub) continue;

        const custo = new Decimal(sub.custoPorUnidade).times(qtd);
        porLinha.set(linha.chave, custo);
        total = total.plus(custo);
      }
    }

    const rendimento = lerNumeroBR(rendimentoQuantidade);

    return {
      total,
      porUnidade: rendimento > 0 ? total.dividedBy(rendimento) : new Decimal(0),
      porLinha,
      semPreco: [...new Set(semPreco)],
    };
  }, [linhas, porInsumo, porReceita, rendimentoQuantidade]);

  const linhasValidas = linhas.filter(
    (l) =>
      (l.tipo === "insumo" ? l.insumoId : l.subReceitaId) &&
      lerNumeroBR(l.quantidade) > 0 &&
      l.unidade,
  );

  function enviar(formData: FormData) {
    formData.set(
      "payload",
      JSON.stringify({
        id: receita?.id ?? null,
        nome,
        descricao: null,
        categoria: categoria || null,
        rendimentoQuantidade: lerNumeroBR(rendimentoQuantidade),
        rendimentoUnidade,
        tempoPreparoMin: Math.round(lerNumeroBR(tempoPreparoMin)),
        modoPreparo: modoPreparo || null,
        observacao: observacao || null,
        itens: linhasValidas.map((l) => ({
          insumoId: l.tipo === "insumo" ? l.insumoId : null,
          subReceitaId: l.tipo === "sub-receita" ? l.subReceitaId : null,
          quantidade: lerNumeroBR(l.quantidade),
          unidade: l.unidade,
          observacao: l.observacao || null,
        })),
      }),
    );
    return acao(formData);
  }

  return (
    <form action={enviar} className="space-y-5">
      {/* ------------------------------------------------------------ básico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A receita</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da receita</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Massa de bolo de chocolate"
              required
              autoFocus
              className="h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rendimento">Essa receita rende</Label>
              <div className="flex gap-2">
                <Input
                  id="rendimento"
                  value={rendimentoQuantidade}
                  onChange={(e) => setRendimentoQuantidade(e.target.value)}
                  inputMode="decimal"
                  placeholder="30"
                  required
                  className="no-spinner h-11 w-24"
                />
                <Input
                  value={rendimentoUnidade}
                  onChange={(e) => setRendimentoUnidade(e.target.value)}
                  placeholder="brigadeiros"
                  required
                  className="h-11 flex-1"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Ex.: 1 bolo · 30 brigadeiros · 800 g de recheio. Se for virar
                recheio de outra receita, use gramas.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tempo">Tempo de preparo</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tempo"
                  value={tempoPreparoMin}
                  onChange={(e) => setTempoPreparoMin(e.target.value)}
                  inputMode="numeric"
                  placeholder="45"
                  className="no-spinner h-11"
                />
                <span className="text-muted-foreground text-sm">min</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Vira dinheiro no preço.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">
              Categoria{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex.: Massas, Recheios, Coberturas"
              className="h-11 sm:max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- ingredientes */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">O que vai nela</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLinhas((a) => [...a, linhaVazia("insumo")])}
            >
              <Plus className="size-4" />
              Ingrediente
            </Button>
            {receitasDisponiveis.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLinhas((a) => [...a, linhaVazia("sub-receita")])}
              >
                <Plus className="size-4" />
                Outra receita
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {linhas.map((linha, indice) => (
            <LinhaIngrediente
              key={linha.chave}
              linha={linha}
              indice={indice}
              insumos={insumos}
              receitas={receitasDisponiveis}
              insumo={linha.insumoId ? porInsumo.get(linha.insumoId) : undefined}
              subReceita={
                linha.subReceitaId ? porReceita.get(linha.subReceitaId) : undefined
              }
              custo={calculo.porLinha.get(linha.chave)}
              podeRemover={linhas.length > 1}
              onEscolherInsumo={(id) => escolherInsumo(linha.chave, id)}
              onEscolherSubReceita={(id) => escolherSubReceita(linha.chave, id)}
              onAtualizar={(campo, valor) => atualizar(linha.chave, campo, valor)}
              onRemover={() =>
                setLinhas((a) => a.filter((l) => l.chave !== linha.chave))
              }
            />
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------- custo vivo */}
      <Card className="border-gold-hairline from-accent/40 to-card bg-gradient-to-br">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs">
                Custo dos ingredientes da receita inteira
              </p>
              <p className="num text-primary text-3xl font-semibold">
                {formatarMoeda(calculo.total)}
              </p>
            </div>

            {lerNumeroBR(rendimentoQuantidade) > 0 && rendimentoUnidade ? (
              <div className="text-right">
                <p className="text-muted-foreground text-xs">
                  Cada {unidadeSingular(rendimentoUnidade)} sai por
                </p>
                <p className="num text-xl font-semibold">
                  {formatarMoedaPrecisa(calculo.porUnidade, 2)}
                </p>
              </div>
            ) : null}
          </div>

          {calculo.semPreco.length > 0 ? (
            <Alert className="border-warning/30 bg-warning-soft/40 mt-4">
              <TriangleAlert className="text-warning size-4" />
              <AlertDescription className="text-xs">
                Este custo está incompleto: <strong>{calculo.semPreco.join(", ")}</strong>{" "}
                {calculo.semPreco.length === 1 ? "ainda não tem" : "ainda não têm"}{" "}
                preço. Lance uma compra desses insumos pra o custo ficar certo.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------- preparo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modo de preparo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={modoPreparo}
            onChange={(e) => setModoPreparo(e.target.value)}
            rows={6}
            placeholder={"1. Bata as claras em neve...\n2. Acrescente o açúcar..."}
          />

          <div className="space-y-2">
            <Label htmlFor="observacao">
              Segredinhos e observações{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex.: não bater demais senão solta óleo"
            />
          </div>
        </CardContent>
      </Card>

      {estado.erro ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={enviando || linhasValidas.length === 0 || !nome}
          className="h-11 sm:w-52"
        >
          {enviando ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Salvando...
            </>
          ) : receita ? (
            "Salvar alterações"
          ) : (
            "Criar ficha técnica"
          )}
        </Button>
      </div>
    </form>
  );
}

function LinhaIngrediente({
  linha,
  indice,
  insumos,
  receitas,
  insumo,
  subReceita,
  custo,
  podeRemover,
  onEscolherInsumo,
  onEscolherSubReceita,
  onAtualizar,
  onRemover,
}: {
  linha: Linha;
  indice: number;
  insumos: InsumoOpcao[];
  receitas: ReceitaOpcao[];
  insumo?: InsumoOpcao;
  subReceita?: ReceitaOpcao;
  custo?: Decimal;
  podeRemover: boolean;
  onEscolherInsumo: (id: string) => void;
  onEscolherSubReceita: (id: string) => void;
  onAtualizar: (campo: keyof Linha, valor: string) => void;
  onRemover: () => void;
}) {
  const ehSubReceita = linha.tipo === "sub-receita";

  const unidades = insumo
    ? unidadesDisponiveis(insumo.unidadeBase, insumo.equivalencias)
    : [];

  return (
    <Card className={cn(ehSubReceita && "border-primary/30 bg-accent/20")}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {ehSubReceita ? (
                <>
                  <ChefHat className="size-3.5" />
                  Outra receita
                </>
              ) : (
                <>
                  <Utensils className="size-3.5" />
                  Ingrediente {indice + 1}
                </>
              )}
            </Label>

            {ehSubReceita ? (
              <Select
                value={linha.subReceitaId ?? ""}
                onValueChange={onEscolherSubReceita}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Escolher receita..." />
                </SelectTrigger>
                <SelectContent>
                  {receitas.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <SeletorInsumo
                insumos={insumos}
                valor={linha.insumoId}
                onChange={onEscolherInsumo}
                placeholder="Escolher ingrediente..."
              />
            )}
          </div>

          {podeRemover ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemover}
              aria-label={`Remover linha ${indice + 1}`}
              className="text-muted-foreground hover:text-destructive mt-6"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>

        {insumo || subReceita ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-28 space-y-1.5">
              <Label className="text-xs">Quanto</Label>
              <Input
                value={linha.quantidade}
                onChange={(e) => onAtualizar("quantidade", e.target.value)}
                inputMode="decimal"
                placeholder="500"
                className="no-spinner h-11"
              />
            </div>

            <div className="w-36 space-y-1.5">
              <Label className="text-xs">Unidade</Label>
              {ehSubReceita ? (
                // A sub-receita só pode ser medida na unidade de rendimento dela
                <Input
                  value={linha.unidade}
                  readOnly
                  className="bg-muted/50 h-11"
                />
              ) : (
                <Select
                  value={linha.unidade}
                  onValueChange={(v) => onAtualizar("unidade", v)}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="g" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {custo && custo.greaterThan(0) ? (
              <div className="pb-2.5">
                <span className="num text-muted-foreground text-sm">
                  = <strong className="text-foreground">{formatarMoeda(custo)}</strong>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** "brigadeiros" → "brigadeiro", pra escrever "cada brigadeiro sai por". */
function unidadeSingular(unidade: string): string {
  const limpo = unidade.trim().toLowerCase();
  return limpo.endsWith("s") ? limpo.slice(0, -1) : limpo;
}
