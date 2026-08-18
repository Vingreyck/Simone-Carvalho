"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { formatarMoeda, lerNumeroBR } from "@/lib/format";

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

import { salvarProduto, type Resultado } from "./acoes";

export type ReceitaOpcaoProduto = {
  id: string;
  nome: string;
  rendimentoQuantidade: number;
  rendimentoUnidade: string;
  custoPorUnidade: number;
};

export type ProdutoExistente = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  receitaId: string | null;
  consumoDaReceita: number;
  custoEmbalagem: number;
  tempoExtraMin: number;
  precoVenda: number;
  margemAlvo: number | null;
};

const SEM_RECEITA = "__sem__";

export function EditorProduto({
  receitas,
  produto,
}: {
  receitas: ReceitaOpcaoProduto[];
  produto?: ProdutoExistente;
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarProduto,
    { ok: false },
  );

  const [nome, setNome] = useState(produto?.nome ?? "");
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [categoria, setCategoria] = useState(produto?.categoria ?? "");
  const [receitaId, setReceitaId] = useState(produto?.receitaId ?? SEM_RECEITA);
  const [consumo, setConsumo] = useState(
    produto ? String(produto.consumoDaReceita) : "1",
  );
  const [custoEmbalagem, setCustoEmbalagem] = useState(
    produto?.custoEmbalagem ? String(produto.custoEmbalagem) : "",
  );
  const [tempoExtraMin, setTempoExtraMin] = useState(
    produto?.tempoExtraMin ? String(produto.tempoExtraMin) : "",
  );
  const [usarMargemPropria, setUsarMargemPropria] = useState(
    produto?.margemAlvo !== null && produto?.margemAlvo !== undefined,
  );
  const [margemAlvo, setMargemAlvo] = useState(
    produto?.margemAlvo !== null && produto?.margemAlvo !== undefined
      ? String(produto.margemAlvo)
      : "",
  );

  useEffect(() => {
    if (estado.ok && estado.id) {
      toast.success(produto ? "Produto atualizado." : "Produto criado!");
      router.push(`/produtos/${estado.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const receita = useMemo(
    () => receitas.find((r) => r.id === receitaId),
    [receitas, receitaId],
  );

  const custoIngredientes = receita
    ? receita.custoPorUnidade * lerNumeroBR(consumo)
    : 0;

  function enviar(formData: FormData) {
    formData.set(
      "payload",
      JSON.stringify({
        id: produto?.id ?? null,
        nome,
        descricao: descricao || null,
        categoria: categoria || null,
        receitaId: receitaId === SEM_RECEITA ? null : receitaId,
        consumoDaReceita: lerNumeroBR(consumo) || 1,
        custoEmbalagem: lerNumeroBR(custoEmbalagem),
        tempoExtraMin: Math.round(lerNumeroBR(tempoExtraMin)),
        precoVenda: produto?.precoVenda ?? 0,
        margemAlvo: usarMargemPropria ? lerNumeroBR(margemAlvo) : null,
      }),
    );
    return acao(formData);
  }

  return (
    <form action={enviar} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">O produto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Bolo de brigadeiro 15 cm"
              required
              autoFocus
              className="h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
                placeholder="Ex.: Bolos, Doces, Tortas"
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">
              Descrição{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Como você descreve pro cliente"
            />
          </div>
        </CardContent>
      </Card>

      {/* -------------------------------------------------- ficha técnica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">De onde vem o custo</CardTitle>
          <p className="text-muted-foreground text-sm">
            Ligue o produto a uma ficha técnica pro sistema saber quanto ele
            gasta de ingrediente.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receita">Ficha técnica</Label>
            <Select value={receitaId} onValueChange={setReceitaId}>
              <SelectTrigger id="receita" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_RECEITA}>
                  Nenhuma (custo manual)
                </SelectItem>
                {receitas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {receita ? (
            <div className="space-y-2">
              <Label htmlFor="consumo">
                Quanto desta receita vai em 1 {nome || "produto"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="consumo"
                  value={consumo}
                  onChange={(e) => setConsumo(e.target.value)}
                  inputMode="decimal"
                  className="no-spinner h-11 w-28"
                />
                <span className="text-muted-foreground text-sm">
                  {receita.rendimentoUnidade}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                A receita inteira rende {receita.rendimentoQuantidade}{" "}
                {receita.rendimentoUnidade}. Se este produto é uma caixa com 12,
                coloque 12. Se é o bolo inteiro, deixe 1.
              </p>

              {custoIngredientes > 0 ? (
                <p className="text-success text-sm font-medium">
                  = {formatarMoeda(custoIngredientes)} de ingredientes por
                  unidade
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custoEmbalagem">Embalagem</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">R$</span>
                <Input
                  id="custoEmbalagem"
                  value={custoEmbalagem}
                  onChange={(e) => setCustoEmbalagem(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="no-spinner h-11"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Caixa, fita, sacola, etiqueta.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tempoExtra">Tempo extra</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tempoExtra"
                  value={tempoExtraMin}
                  onChange={(e) => setTempoExtraMin(e.target.value)}
                  inputMode="numeric"
                  placeholder="15"
                  className="no-spinner h-11"
                />
                <span className="text-muted-foreground text-sm">min</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Montar, decorar, embalar — além do tempo da receita.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- margem */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lucro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={usarMargemPropria}
              onChange={(e) => setUsarMargemPropria(e.target.checked)}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              Este produto tem uma margem diferente da padrão
              <span className="text-muted-foreground block text-xs">
                Útil pra bolo de festa (margem maior) ou doce de vitrine (menor).
              </span>
            </span>
          </label>

          {usarMargemPropria ? (
            <div className="flex items-center gap-2 pl-7">
              <Input
                value={margemAlvo}
                onChange={(e) => setMargemAlvo(e.target.value)}
                inputMode="decimal"
                placeholder="40"
                className="no-spinner h-11 w-24"
              />
              <span className="text-muted-foreground text-sm">% de lucro</span>
            </div>
          ) : null}
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
          disabled={enviando || !nome}
          className="h-11 sm:w-48"
        >
          {enviando ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Salvando...
            </>
          ) : produto ? (
            "Salvar alterações"
          ) : (
            "Criar produto"
          )}
        </Button>
      </div>
    </form>
  );
}
