"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Decimal } from "decimal.js";

import type { CanalVenda, StatusPedido } from "@/generated/prisma/enums";
import { CANAIS, ROTULO_CANAL } from "@/lib/pedidos";
import { formatarMoeda, lerNumeroBR, normalizarTexto } from "@/lib/format";

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

import { salvarPedido, type Resultado } from "./acoes";

export type ProdutoOpcao = {
  id: string;
  nome: string;
  precoVenda: number;
};

export type ClienteOpcao = {
  id: string;
  nome: string;
  telefone: string | null;
};

export type PedidoExistente = {
  id: string;
  clienteId: string | null;
  dataEntrega: string | null;
  status: StatusPedido;
  canal: CanalVenda;
  desconto: number;
  taxaEntrega: number;
  sinalPago: number;
  formaPagamento: string | null;
  enderecoEntrega: string | null;
  observacao: string | null;
  itens: {
    produtoId: string;
    quantidade: number;
    precoUnitario: number;
    observacao: string | null;
  }[];
};

type Linha = {
  chave: string;
  produtoId: string;
  quantidade: string;
  precoUnitario: string;
  observacao: string;
};

const NOVO_CLIENTE = "__novo__";

function linhaVazia(): Linha {
  return {
    chave: crypto.randomUUID(),
    produtoId: "",
    quantidade: "1",
    precoUnitario: "",
    observacao: "",
  };
}

export function EditorPedido({
  produtos,
  clientes,
  pedido,
}: {
  produtos: ProdutoOpcao[];
  clientes: ClienteOpcao[];
  pedido?: PedidoExistente;
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(
    salvarPedido,
    { ok: false },
  );

  const [clienteId, setClienteId] = useState(pedido?.clienteId ?? NOVO_CLIENTE);
  const [novoCliente, setNovoCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataEntrega, setDataEntrega] = useState(
    pedido?.dataEntrega?.slice(0, 10) ?? "",
  );
  const [canal, setCanal] = useState<CanalVenda>(pedido?.canal ?? "WHATSAPP");
  const [desconto, setDesconto] = useState(
    pedido?.desconto ? String(pedido.desconto) : "",
  );
  const [taxaEntrega, setTaxaEntrega] = useState(
    pedido?.taxaEntrega ? String(pedido.taxaEntrega) : "",
  );
  const [sinalPago, setSinalPago] = useState(
    pedido?.sinalPago ? String(pedido.sinalPago) : "",
  );
  const [formaPagamento, setFormaPagamento] = useState(
    pedido?.formaPagamento ?? "",
  );
  const [enderecoEntrega, setEnderecoEntrega] = useState(
    pedido?.enderecoEntrega ?? "",
  );
  const [observacao, setObservacao] = useState(pedido?.observacao ?? "");

  const [linhas, setLinhas] = useState<Linha[]>(
    pedido && pedido.itens.length > 0
      ? pedido.itens.map((i) => ({
          chave: crypto.randomUUID(),
          produtoId: i.produtoId,
          quantidade: String(i.quantidade),
          precoUnitario: String(i.precoUnitario),
          observacao: i.observacao ?? "",
        }))
      : [linhaVazia()],
  );

  useEffect(() => {
    if (estado.ok && estado.id) {
      toast.success(pedido ? "Pedido atualizado." : "Pedido registrado!");
      router.push(`/vendas/${estado.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const porProduto = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  );

  function atualizar(chave: string, campo: keyof Linha, valor: string) {
    setLinhas((atual) =>
      atual.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)),
    );
  }

  /** Ao escolher o produto, já traz o preço de tabela — ela só ajusta se der desconto. */
  function escolherProduto(chave: string, produtoId: string) {
    const produto = porProduto.get(produtoId);

    setLinhas((atual) =>
      atual.map((l) =>
        l.chave === chave
          ? {
              ...l,
              produtoId,
              precoUnitario:
                l.precoUnitario || (produto ? String(produto.precoVenda) : ""),
            }
          : l,
      ),
    );
  }

  const subtotal = linhas.reduce(
    (t, l) =>
      t.plus(
        new Decimal(lerNumeroBR(l.precoUnitario)).times(
          lerNumeroBR(l.quantidade),
        ),
      ),
    new Decimal(0),
  );

  const total = subtotal
    .minus(lerNumeroBR(desconto))
    .plus(lerNumeroBR(taxaEntrega));

  const falta = total.minus(lerNumeroBR(sinalPago));

  const linhasValidas = linhas.filter(
    (l) => l.produtoId && lerNumeroBR(l.quantidade) > 0,
  );

  function enviar(formData: FormData) {
    formData.set(
      "payload",
      JSON.stringify({
        id: pedido?.id ?? null,
        clienteId: clienteId === NOVO_CLIENTE ? null : clienteId,
        novoCliente: clienteId === NOVO_CLIENTE ? novoCliente || null : null,
        telefoneNovoCliente:
          clienteId === NOVO_CLIENTE ? telefone || null : null,
        dataEntrega: dataEntrega || null,
        status: pedido?.status ?? "ORCAMENTO",
        canal,
        desconto: lerNumeroBR(desconto),
        taxaEntrega: lerNumeroBR(taxaEntrega),
        sinalPago: lerNumeroBR(sinalPago),
        formaPagamento: formaPagamento || null,
        enderecoEntrega: enderecoEntrega || null,
        observacao: observacao || null,
        itens: linhasValidas.map((l) => ({
          produtoId: l.produtoId,
          quantidade: lerNumeroBR(l.quantidade),
          precoUnitario: lerNumeroBR(l.precoUnitario),
          observacao: l.observacao || null,
        })),
      }),
    );
    return acao(formData);
  }

  return (
    <form action={enviar} className="space-y-5">
      {/* --------------------------------------------------------- cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pra quem é</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger id="cliente" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOVO_CLIENTE}>Cliente novo...</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                    {c.telefone ? ` · ${c.telefone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {clienteId === NOVO_CLIENTE ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="novoCliente">Nome</Label>
                <Input
                  id="novoCliente"
                  value={novoCliente}
                  onChange={(e) => setNovoCliente(e.target.value)}
                  placeholder="Ex.: Dona Maria"
                  className="h-11"
                />
                <p className="text-muted-foreground text-xs">
                  Deixe vazio se for venda de balcão.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(79) 99999-9999"
                  className="h-11"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dataEntrega">Quando entrega</Label>
              <Input
                id="dataEntrega"
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="canal">Como chegou o pedido</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v as CanalVenda)}>
                <SelectTrigger id="canal" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {ROTULO_CANAL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="enderecoEntrega">
              Endereço de entrega{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="enderecoEntrega"
              value={enderecoEntrega}
              onChange={(e) => setEnderecoEntrega(e.target.value)}
              className="h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------- itens */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">O que ela pediu</h3>
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
            <LinhaItem
              key={linha.chave}
              linha={linha}
              indice={indice}
              produtos={produtos}
              podeRemover={linhas.length > 1}
              onEscolherProduto={(id) => escolherProduto(linha.chave, id)}
              onAtualizar={(campo, valor) => atualizar(linha.chave, campo, valor)}
              onRemover={() =>
                setLinhas((a) => a.filter((l) => l.chave !== linha.chave))
              }
            />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ fechamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoDinheiro
              id="desconto"
              rotulo="Desconto"
              valor={desconto}
              onChange={setDesconto}
            />
            <CampoDinheiro
              id="taxaEntrega"
              rotulo="Taxa de entrega"
              valor={taxaEntrega}
              onChange={setTaxaEntrega}
            />
            <CampoDinheiro
              id="sinalPago"
              rotulo="Sinal já recebido"
              valor={sinalPago}
              onChange={setSinalPago}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="formaPagamento">
              Forma de pagamento{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="formaPagamento"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              placeholder="Ex.: Pix, cartão, dinheiro"
              className="h-11 sm:max-w-xs"
            />
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
              placeholder="Ex.: sem lactose, escrever 'Parabéns Ana' na cobertura"
            />
          </div>

          <ul className="space-y-1.5 border-t pt-4 text-sm">
            <li className="text-muted-foreground flex justify-between">
              <span>Produtos</span>
              <span className="num">{formatarMoeda(subtotal)}</span>
            </li>
            {lerNumeroBR(desconto) > 0 ? (
              <li className="text-muted-foreground flex justify-between">
                <span>Desconto</span>
                <span className="num">− {formatarMoeda(desconto)}</span>
              </li>
            ) : null}
            {lerNumeroBR(taxaEntrega) > 0 ? (
              <li className="text-muted-foreground flex justify-between">
                <span>Entrega</span>
                <span className="num">+ {formatarMoeda(taxaEntrega)}</span>
              </li>
            ) : null}
            <li className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="num">{formatarMoeda(total)}</span>
            </li>
            {lerNumeroBR(sinalPago) > 0 ? (
              <li className="text-primary flex justify-between font-medium">
                <span>Falta receber</span>
                <span className="num">{formatarMoeda(falta)}</span>
              </li>
            ) : null}
          </ul>
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
          disabled={enviando || linhasValidas.length === 0}
          className="h-11 sm:w-48"
        >
          {enviando ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Salvando...
            </>
          ) : pedido ? (
            "Salvar alterações"
          ) : (
            "Registrar pedido"
          )}
        </Button>
      </div>
    </form>
  );
}

function LinhaItem({
  linha,
  indice,
  produtos,
  podeRemover,
  onEscolherProduto,
  onAtualizar,
  onRemover,
}: {
  linha: Linha;
  indice: number;
  produtos: ProdutoOpcao[];
  podeRemover: boolean;
  onEscolherProduto: (id: string) => void;
  onAtualizar: (campo: keyof Linha, valor: string) => void;
  onRemover: () => void;
}) {
  const subtotal =
    lerNumeroBR(linha.precoUnitario) * lerNumeroBR(linha.quantidade);

  const ordenados = [...produtos].sort((a, b) =>
    normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome), "pt-BR"),
  );

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Label className="text-xs">Item {indice + 1}</Label>
            <Select value={linha.produtoId} onValueChange={onEscolherProduto}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Escolher produto..." />
              </SelectTrigger>
              <SelectContent>
                {ordenados.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                    {p.precoVenda > 0 ? ` · ${formatarMoeda(p.precoVenda)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {linha.produtoId ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-24 space-y-1.5">
                <Label className="text-xs">Quantos</Label>
                <Input
                  value={linha.quantidade}
                  onChange={(e) => onAtualizar("quantidade", e.target.value)}
                  inputMode="decimal"
                  className="no-spinner h-11"
                />
              </div>

              <div className="w-32 space-y-1.5">
                <Label className="text-xs">Preço de cada</Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-sm">R$</span>
                  <Input
                    value={linha.precoUnitario}
                    onChange={(e) =>
                      onAtualizar("precoUnitario", e.target.value)
                    }
                    inputMode="decimal"
                    className="no-spinner h-11"
                  />
                </div>
              </div>

              {subtotal > 0 ? (
                <span className="num text-muted-foreground pb-3 text-sm">
                  ={" "}
                  <strong className="text-foreground">
                    {formatarMoeda(subtotal)}
                  </strong>
                </span>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Observação deste item{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                value={linha.observacao}
                onChange={(e) => onAtualizar("observacao", e.target.value)}
                placeholder="Ex.: cobertura de chocolate branco"
                className="h-11"
              />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CampoDinheiro({
  id,
  rotulo,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">R$</span>
        <Input
          id={id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="no-spinner h-11"
        />
      </div>
    </div>
  );
}
