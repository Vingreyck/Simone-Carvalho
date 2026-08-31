"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import type { CategoriaInsumo, UnidadeBase } from "@/generated/prisma/enums";
import {
  ROTULO_UNIDADE_BASE,
  converterParaBase,
  unidadesDisponiveis,
} from "@/lib/unidades";
import { formatarMoeda, formatarMoedaPrecisa, lerNumeroBR } from "@/lib/format";
import { formatarQuantidade } from "@/lib/unidades";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

import { lancarCompra, type Resultado } from "../acoes";
import { DialogoAlta } from "../dialogo-alta";
import { aprenderApelidos } from "./acoes-ia";
import { AtalhosCompra, type ResultadoDoAtalho } from "./atalhos-compra";

export type InsumoDoFormulario = {
  id: string;
  nome: string;
  categoria: CategoriaInsumo;
  unidadeBase: UnidadeBase;
  perecivel: boolean;
  /** Quanto o insumo costuma durar, medido nas compras anteriores */
  prazoValidadeDias: number | null;
  equivalencias: { nome: string; quantidadeBase: number }[];
};

/** Hoje + N dias, no formato do input de data. */
function emDias(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

type Linha = {
  chave: string;
  insumoId: string | null;
  /** Texto original da nota — vira apelido aprendido quando ela confirma */
  descricaoOriginal?: string;
  /** Palpite de casamento incerto: destaca a linha pra ela olhar */
  incerto?: boolean;
  /**
   * Insumo que a foto achou e ela ainda não tem cadastrado. Só vira registro
   * de verdade quando ela confirma a compra.
   */
  novoInsumo?: { nome: string; unidadeBase: "G" | "ML" | "UN" } | null;
  /** A nota não trouxe o peso e o insumo é medido em peso — ela precisa digitar */
  precisaPeso?: boolean;
  quantidadeEmbalagens: string;
  tamanhoEmbalagem: string;
  unidadeEmbalagem: string;
  valorTotal: string;
  validade: string;
  /** A data veio do prazo das compras anteriores, não dela */
  validadeSugerida?: boolean;
};

function linhaVazia(): Linha {
  return {
    chave: crypto.randomUUID(),
    insumoId: null,
    quantidadeEmbalagens: "1",
    tamanhoEmbalagem: "",
    unidadeEmbalagem: "",
    valorTotal: "",
    validade: "",
  };
}

export function FormularioCompra({
  insumos,
  fornecedores,
  iaConfigurada,
  frequentes,
}: {
  insumos: InsumoDoFormulario[];
  fornecedores: { id: string; nome: string }[];
  iaConfigurada: boolean;
  frequentes: string[];
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    lancarCompra,
    { ok: false },
  );

  const hoje = new Date().toISOString().slice(0, 10);

  const [data, setData] = useState(hoje);
  const [fornecedorId, setFornecedorId] = useState("");
  const [novoFornecedor, setNovoFornecedor] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [observacao, setObservacao] = useState("");
  const [jaPago, setJaPago] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);

  /**
   * Quando a compra encarece algum produto, o aviso segura a navegação.
   *
   * Mandar ela pra tela da compra e mostrar o alerta lá seria pior: ela sairia
   * dessa tela achando que acabou. O aviso de que um doce virou prejuízo é a
   * coisa mais importante que o sistema tem pra dizer — merece parar o fluxo.
   */
  const [avisoDispensado, setAvisoDispensado] = useState(false);

  // Derivado em vez de guardado: abrir o diálogo é consequência de ter aviso,
  // não um estado próprio. Evita o setState dentro do efeito.
  const avisoAberto = Boolean(estado.aviso) && !avisoDispensado;

  useEffect(() => {
    if (!estado.ok || !estado.id) return;

    toast.success("Compra lançada! Os preços dos insumos já foram atualizados.");

    // Com aviso na tela, a navegação espera ela fechar
    if (!estado.aviso) router.push(`/compras/${estado.id}`);
  }, [estado, router]);

  const porId = useMemo(
    () => new Map(insumos.map((i) => [i.id, i])),
    [insumos],
  );

  function atualizar(chave: string, campo: keyof Linha, valor: string) {
    setLinhas((atual) =>
      atual.map((l) =>
        l.chave === chave
          ? {
              ...l,
              [campo]: valor,
              // Mexeu na data: agora ela é dela, e o rótulo de sugestão sai
              ...(campo === "validade" ? { validadeSugerida: false } : null),
            }
          : l,
      ),
    );
  }

  /**
   * O que dá pra preencher sozinho quando ela escolhe o insumo: a unidade mais
   * provável da embalagem e a validade, calculada do prazo das compras
   * anteriores daquele insumo.
   */
  function preenchidoPeloInsumo(insumo: InsumoDoFormulario | undefined) {
    if (!insumo) return { unidade: "", validade: "" };

    const unidade =
      insumo.unidadeBase === "G" ? "kg" : insumo.unidadeBase === "ML" ? "l" : "un";

    /*
      Prazo de validade é característica do produto, não da compra: a farinha
      daquela marca vence sempre uns tantos meses depois. Digitar isso item por
      item, em toda compra, é trabalho que o sistema já tinha como poupar — ele
      tem a data de entrada e a validade de cada lote anterior.

      Vem marcada como sugestão e a data fica à vista: é ela quem confere
      contra a embalagem.
    */
    const validade =
      insumo.perecivel && insumo.prazoValidadeDias
        ? emDias(insumo.prazoValidadeDias)
        : "";

    return { unidade, validade };
  }

  function escolherInsumo(chave: string, insumoId: string) {
    const { unidade, validade } = preenchidoPeloInsumo(porId.get(insumoId));

    setLinhas((atual) =>
      atual.map((l) =>
        l.chave === chave
          ? {
              ...l,
              insumoId,
              unidadeEmbalagem: l.unidadeEmbalagem || unidade,
              // Nunca sobrescreve uma data que ela já digitou
              validade: l.validade || validade,
              validadeSugerida: !l.validade && Boolean(validade),
            }
          : l,
      ),
    );
  }

  /**
   * Recebe o resultado de qualquer atalho (foto, repetir, lista) e preenche o
   * formulário. Substitui as linhas em vez de somar: ela pediu pra começar
   * daquele jeito.
   */
  function preencherComAtalho(resultado: ResultadoDoAtalho) {
    setLinhas(
      resultado.itens.map((item) => {
        // A nota fiscal quase nunca traz validade; o prazo das compras
        // anteriores traz.
        const { validade } = preenchidoPeloInsumo(
          item.insumoId ? porId.get(item.insumoId) : undefined,
        );

        return {
          chave: crypto.randomUUID(),
          insumoId: item.insumoId,
          descricaoOriginal: item.descricao,
          incerto: Boolean(item.insumoId) && !item.confiante,
          novoInsumo: item.novoInsumo ?? null,
          precisaPeso: item.precisaPeso ?? false,
          quantidadeEmbalagens: String(item.quantidade || 1),
          // Sem peso na nota o campo nasce VAZIO de propósito: "1" seria um
          // número plausível e errado, e ela confirmaria sem perceber
          tamanhoEmbalagem:
            item.precisaPeso || !item.tamanhoEmbalagem
              ? ""
              : String(item.tamanhoEmbalagem),
          unidadeEmbalagem: item.unidade,
          valorTotal: item.valorTotal ? String(item.valorTotal) : "",
          validade,
          validadeSugerida: Boolean(validade),
        };
      }),
    );

    if (resultado.fornecedor) {
      const conhecido = fornecedores.find(
        (f) => f.nome.toLowerCase() === resultado.fornecedor!.toLowerCase(),
      );
      if (conhecido) setFornecedorId(conhecido.id);
      else {
        setFornecedorId("");
        setNovoFornecedor(resultado.fornecedor);
      }
    }

    if (resultado.data) setData(resultado.data);
    if (resultado.notaFiscal) setNotaFiscal(resultado.notaFiscal);
  }

  const totalItens = linhas.reduce(
    (t, l) => t + lerNumeroBR(l.valorTotal),
    0,
  );
  const total = totalItens + lerNumeroBR(valorFrete);

  const linhasValidas = linhas.filter(
    (l) =>
      // Vale também a linha que vai criar o insumo na hora de confirmar
      (l.insumoId || l.novoInsumo) &&
      lerNumeroBR(l.quantidadeEmbalagens) > 0 &&
      lerNumeroBR(l.tamanhoEmbalagem) > 0 &&
      l.unidadeEmbalagem,
  );

  function enviar(formData: FormData) {
    formData.set(
      "payload",
      JSON.stringify({
        fornecedorId: fornecedorId || null,
        novoFornecedor: novoFornecedor || null,
        data,
        notaFiscal: notaFiscal || null,
        valorFrete: lerNumeroBR(valorFrete),
        observacao: observacao || null,
        jaPago,
        itens: linhasValidas.map((l) => ({
          insumoId: l.insumoId ?? "",
          novoInsumo: l.insumoId ? null : (l.novoInsumo ?? null),
          quantidadeEmbalagens: lerNumeroBR(l.quantidadeEmbalagens),
          tamanhoEmbalagem: lerNumeroBR(l.tamanhoEmbalagem),
          unidadeEmbalagem: l.unidadeEmbalagem,
          valorTotal: lerNumeroBR(l.valorTotal),
          validade: l.validade || null,
        })),
      }),
    );

    // Ensina como aquele fornecedor escreve cada insumo. Roda em paralelo:
    // se falhar, a compra não pode deixar de ser lançada por causa disso.
    const aprender = linhasValidas
      .filter((l) => l.descricaoOriginal && l.insumoId)
      .map((l) => ({ descricao: l.descricaoOriginal!, insumoId: l.insumoId! }));

    if (aprender.length > 0) void aprenderApelidos(aprender).catch(() => {});

    return acao(formData);
  }

  return (
    <form action={enviar} className="space-y-5">
      <AtalhosCompra
        iaConfigurada={iaConfigurada}
        onPreencher={preencherComAtalho}
      />

      {/* --------------------------------------------------------- cabeçalho */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da compra</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="data">Quando você comprou</Label>
            <Input
              id="data"
              type="date"
              value={data}
              max={hoje}
              onChange={(e) => setData(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fornecedor">Onde comprou</Label>
            {fornecedores.length > 0 ? (
              <Select
                value={fornecedorId || "novo"}
                onValueChange={(v) => setFornecedorId(v === "novo" ? "" : v)}
              >
                <SelectTrigger id="fornecedor" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Outro lugar...</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {!fornecedorId ? (
              <Input
                value={novoFornecedor}
                onChange={(e) => setNovoFornecedor(e.target.value)}
                placeholder="Ex.: Atacadão, Mercado do Zé"
                className="h-11"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------- itens */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">O que você comprou</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinhas((a) => [...a, linhaVazia()])}
          >
            <Plus className="size-4" />
            Adicionar item
          </Button>
        </div>

        <div className="space-y-3">
          {linhas.map((linha, indice) => (
            <LinhaDeItem
              key={linha.chave}
              linha={linha}
              indice={indice}
              insumos={insumos}
              insumo={linha.insumoId ? porId.get(linha.insumoId) : undefined}
              frequentes={frequentes}
              podeRemover={linhas.length > 1}
              onEscolherInsumo={(id) => escolherInsumo(linha.chave, id)}
              onAtualizar={(campo, valor) => atualizar(linha.chave, campo, valor)}
              onRemover={() =>
                setLinhas((a) => a.filter((l) => l.chave !== linha.chave))
              }
            />
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------- fechamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fechamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="valorFrete">
                Frete ou taxa{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                id="valorFrete"
                value={valorFrete}
                onChange={(e) => setValorFrete(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="no-spinner h-11"
              />
              <p className="text-muted-foreground text-xs">
                É dividido entre os itens, proporcional ao valor de cada um.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notaFiscal">
                Nota fiscal{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                id="notaFiscal"
                value={notaFiscal}
                onChange={(e) => setNotaFiscal(e.target.value)}
                placeholder="Número da nota"
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">
              Observação{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex.: promoção da semana"
            />
          </div>

          <div className="bg-muted/40 flex items-center justify-between rounded-lg border p-3">
            <div className="pr-4">
              <Label htmlFor="jaPago" className="text-sm">
                Já paguei esta compra
              </Label>
              <p className="text-muted-foreground text-xs">
                Se desmarcar, ela entra como conta a pagar no financeiro.
              </p>
            </div>
            <Switch id="jaPago" checked={jaPago} onCheckedChange={setJaPago} />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-sm">Total da compra</span>
            <span className="num text-2xl font-semibold">
              {formatarMoeda(total)}
            </span>
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/compras")}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={enviando || linhasValidas.length === 0}
          className="h-11 sm:w-56"
        >
          {enviando ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Lançando...
            </>
          ) : (
            <>
              Lançar compra
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>

      {estado.aviso ? (
        <DialogoAlta
          aviso={estado.aviso}
          aberto={avisoAberto}
          onFechar={() => {
            setAvisoDispensado(true);
            if (estado.id) router.push(`/compras/${estado.id}`);
          }}
        />
      ) : null}
    </form>
  );
}

function LinhaDeItem({
  linha,
  indice,
  insumos,
  insumo,
  frequentes,
  podeRemover,
  onEscolherInsumo,
  onAtualizar,
  onRemover,
}: {
  linha: Linha;
  indice: number;
  insumos: InsumoDoFormulario[];
  insumo?: InsumoDoFormulario;
  frequentes: string[];
  podeRemover: boolean;
  onEscolherInsumo: (id: string) => void;
  onAtualizar: (campo: keyof Linha, valor: string) => void;
  onRemover: () => void;
}) {
  /**
   * A conversão ao vivo. É o que mostra pra ela que o sistema entendeu:
   * ela digita "2 sacos de 5 kg por R$ 56" e lê "10 kg · R$ 0,0056 por g".
   */
  const previa = useMemo(() => {
    if (!insumo) return null;

    const embalagens = lerNumeroBR(linha.quantidadeEmbalagens);
    const tamanho = lerNumeroBR(linha.tamanhoEmbalagem);
    const valor = lerNumeroBR(linha.valorTotal);

    if (embalagens <= 0 || tamanho <= 0 || !linha.unidadeEmbalagem) return null;

    try {
      const porEmbalagem = converterParaBase(
        tamanho,
        linha.unidadeEmbalagem,
        insumo.unidadeBase,
        insumo.equivalencias.map((e) => ({
          nome: e.nome,
          quantidadeBase: e.quantidadeBase,
        })),
      );

      const total = porEmbalagem.times(embalagens);
      if (total.lessThanOrEqualTo(0)) return null;

      return {
        quantidade: formatarQuantidade(total, insumo.unidadeBase),
        custoUnitario:
          valor > 0
            ? `${formatarMoedaPrecisa(total.greaterThan(0) ? valor / total.toNumber() : 0)} por ${ROTULO_UNIDADE_BASE[insumo.unidadeBase]}`
            : null,
        erro: null as string | null,
      };
    } catch (erro) {
      return {
        quantidade: null,
        custoUnitario: null,
        erro: (erro as Error).message,
      };
    }
  }, [insumo, linha]);

  const unidades = insumo
    ? unidadesDisponiveis(
        insumo.unidadeBase,
        insumo.equivalencias.map((e) => ({
          nome: e.nome,
          quantidadeBase: e.quantidadeBase,
        })),
      )
    : [];

  return (
    <Card
      className={cn(
        linha.incerto && "border-warning/50 bg-warning-soft/20",
        linha.precisaPeso && "border-info/50 bg-info-soft/20",
      )}
    >
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Label className="text-xs">Item {indice + 1}</Label>

            {/* O texto da nota fica visível: é contra ele que ela confere */}
            {linha.descricaoOriginal ? (
              <p
                className={cn(
                  "truncate font-mono text-xs",
                  linha.incerto ? "text-warning" : "text-muted-foreground",
                )}
                title={linha.descricaoOriginal}
              >
                {linha.incerto ? "confira: " : ""}
                {linha.descricaoOriginal}
              </p>
            ) : null}

            {linha.precisaPeso ? (
              <p className="text-info text-xs font-medium">
                A nota não disse o peso. Quanto vem em cada pacote?
              </p>
            ) : null}
            {!linha.insumoId && linha.novoInsumo ? (
              /*
                Insumo que ela ainda não tem. Em vez de parar a compra pra
                mandar ela cadastrar, o sistema cria junto ao confirmar — mas
                deixa claro que vai criar, e o seletor continua ali pra ela
                apontar um insumo existente se preferir.
              */
              <div className="border-info/40 bg-info-soft/30 rounded-md border px-2.5 py-2">
                <p className="text-info text-xs font-medium">
                  Vou cadastrar &ldquo;{linha.novoInsumo.nome}&rdquo; ao
                  confirmar
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Medido em {ROTULO_UNIDADE_BASE[linha.novoInsumo.unidadeBase]}.
                  Se já tem esse insumo com outro nome, escolha abaixo.
                </p>
              </div>
            ) : null}

            <SeletorInsumo
              insumos={insumos}
              valor={linha.insumoId}
              onChange={onEscolherInsumo}
              idsFrequentes={frequentes}
              placeholder={
                linha.novoInsumo ? "Ou escolher um já cadastrado..." : undefined
              }
            />
          </div>

          {podeRemover ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemover}
              aria-label={`Remover item ${indice + 1}`}
              className="text-muted-foreground hover:text-destructive mt-6"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>

        {insumo ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantas</Label>
                <Input
                  value={linha.quantidadeEmbalagens}
                  onChange={(e) =>
                    onAtualizar("quantidadeEmbalagens", e.target.value)
                  }
                  inputMode="decimal"
                  placeholder="2"
                  className="no-spinner h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">De quanto cada</Label>
                <Input
                  value={linha.tamanhoEmbalagem}
                  onChange={(e) =>
                    onAtualizar("tamanhoEmbalagem", e.target.value)
                  }
                  inputMode="decimal"
                  placeholder="5"
                  className="no-spinner h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Unidade</Label>
                <Select
                  value={linha.unidadeEmbalagem}
                  onValueChange={(v) => onAtualizar("unidadeEmbalagem", v)}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="kg" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Quanto pagou</Label>
                <Input
                  value={linha.valorTotal}
                  onChange={(e) => onAtualizar("valorTotal", e.target.value)}
                  inputMode="decimal"
                  placeholder="56,00"
                  className="no-spinner h-11"
                />
              </div>
            </div>

            {insumo.perecivel ? (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Validade{" "}
                  <span className="text-muted-foreground font-normal">
                    (opcional, mas ajuda a avisar antes de estragar)
                  </span>
                </Label>
                <Input
                  type="date"
                  value={linha.validade}
                  onChange={(e) => onAtualizar("validade", e.target.value)}
                  className="h-11 sm:max-w-xs"
                />
                {/*
                  A data preenchida sozinha precisa se anunciar. Se ela achar
                  que digitou, não confere; e o campo existe justamente pra ela
                  não usar ingrediente estragado.
                */}
                {linha.validadeSugerida ? (
                  <p className="text-muted-foreground text-xs">
                    Sugerida pelo prazo das compras anteriores — confira na
                    embalagem.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* --------------------------------------------- conversão ao vivo */}
            {previa?.erro ? (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {previa.erro}
                </AlertDescription>
              </Alert>
            ) : previa?.quantidade ? (
              <div className="bg-success-soft/50 border-success/20 text-success flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-sm">
                <ArrowRight className="size-3.5 shrink-0" />
                <span className="num font-medium">
                  entra {previa.quantidade} no estoque
                </span>
                {previa.custoUnitario ? (
                  <span className="num opacity-80">· {previa.custoUnitario}</span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
