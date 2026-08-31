"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Wheat, X } from "lucide-react";

import type {
  Alergeno,
  CategoriaInsumo,
  UnidadeBase,
} from "@/generated/prisma/enums";
import type { SituacaoEstoque } from "@/lib/estoque";
import { formatarQuantidade } from "@/lib/unidades";
import { formatarMoedaPrecisa, normalizarTexto } from "@/lib/format";
import { ROTULO_CATEGORIA } from "@/lib/constantes";
import { cn } from "@/lib/utils";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { SeloEstoque } from "@/components/selo-situacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

import { DialogoInsumo } from "./dialogo-insumo";

export type InsumoDaLista = {
  id: string;
  nome: string;
  categoria: CategoriaInsumo;
  unidadeBase: UnidadeBase;
  estoqueMinimo: number;
  custoMedio: number;
  custoUltimaCompra: number | null;
  perecivel: boolean;
  marcaPreferida: string | null;
  observacao: string | null;
  alergenos: Alergeno[];
  alergenosTraco: Alergeno[];
  alergenosRevisados: boolean;
  ativo: boolean;
  saldo: number;
  situacao: SituacaoEstoque;
};

type Filtro = "todos" | "acabando" | "sem-preco" | "arquivados";

export function ListaInsumos({
  insumos,
  iaConfigurada,
}: {
  insumos: InsumoDaLista[];
  iaConfigurada: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaInsumo | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [emEdicao, setEmEdicao] = useState<InsumoDaLista | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);

  const semPreco = insumos.filter((i) => i.ativo && i.custoMedio <= 0).length;
  const acabando = insumos.filter(
    (i) => i.ativo && i.situacao !== "ok",
  ).length;

  const visiveis = useMemo(() => {
    const termo = normalizarTexto(busca);

    return insumos.filter((insumo) => {
      if (filtro === "arquivados" ? insumo.ativo : !insumo.ativo) return false;
      if (filtro === "acabando" && insumo.situacao === "ok") return false;
      if (filtro === "sem-preco" && insumo.custoMedio > 0) return false;
      if (categoria && insumo.categoria !== categoria) return false;

      if (!termo) return true;

      return (
        normalizarTexto(insumo.nome).includes(termo) ||
        normalizarTexto(insumo.marcaPreferida ?? "").includes(termo)
      );
    });
  }, [insumos, busca, categoria, filtro]);

  // Só oferece filtro de categoria que realmente tem item
  const categoriasUsadas = useMemo(() => {
    const usadas = new Set(insumos.filter((i) => i.ativo).map((i) => i.categoria));
    return (Object.keys(ROTULO_CATEGORIA) as CategoriaInsumo[]).filter((c) =>
      usadas.has(c),
    );
  }, [insumos]);

  function abrirNovo() {
    setEmEdicao(null);
    setDialogoAberto(true);
  }

  function abrirEdicao(insumo: InsumoDaLista) {
    setEmEdicao(insumo);
    setDialogoAberto(true);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina
        titulo="Insumos"
        descricao="Tudo que você compra pra produzir. O preço vem sozinho quando você lança uma compra."
        acao={
          <Button onClick={abrirNovo}>
            <Plus className="size-4" />
            Novo insumo
          </Button>
        }
      />

      {/* ------------------------------------------------------------- busca */}
      <div className="relative mb-3">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar insumo..."
          className="h-11 pr-10 pl-9"
        />
        {busca ? (
          <button
            onClick={() => setBusca("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* ----------------------------------------------------------- filtros */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>
          Todos
        </Chip>
        <Chip
          ativo={filtro === "acabando"}
          onClick={() => setFiltro("acabando")}
          contador={acabando}
          tom="alerta"
        >
          Acabando
        </Chip>
        <Chip
          ativo={filtro === "sem-preco"}
          onClick={() => setFiltro("sem-preco")}
          contador={semPreco}
        >
          Sem preço
        </Chip>
        <Chip
          ativo={filtro === "arquivados"}
          onClick={() => setFiltro("arquivados")}
        >
          Arquivados
        </Chip>
      </div>

      {categoriasUsadas.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Chip ativo={categoria === null} onClick={() => setCategoria(null)}>
            Todas as categorias
          </Chip>
          {categoriasUsadas.map((c) => (
            <Chip
              key={c}
              ativo={categoria === c}
              onClick={() => setCategoria(categoria === c ? null : c)}
            >
              {ROTULO_CATEGORIA[c]}
            </Chip>
          ))}
        </div>
      ) : null}

      {/* ------------------------------------------------------------- lista */}
      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={Wheat}
          titulo={busca ? "Nada encontrado" : "Nenhum insumo aqui"}
          descricao={
            busca
              ? `Não achei nenhum insumo com "${busca}".`
              : "Mude o filtro acima ou cadastre um insumo novo."
          }
          acao={
            !busca ? (
              <Button onClick={abrirNovo} variant="outline">
                <Plus className="size-4" />
                Novo insumo
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <p className="text-muted-foreground mb-2 text-xs">
            {visiveis.length}{" "}
            {visiveis.length === 1 ? "insumo" : "insumos"}
          </p>

          <div className="space-y-2">
            {visiveis.map((insumo) => (
              <LinhaInsumo
                key={insumo.id}
                insumo={insumo}
                onEditar={() => abrirEdicao(insumo)}
              />
            ))}
          </div>
        </>
      )}

      <DialogoInsumo
        aberto={dialogoAberto}
        onOpenChange={setDialogoAberto}
        insumo={emEdicao}
        iaConfigurada={iaConfigurada}
      />
    </div>
  );
}

function LinhaInsumo({
  insumo,
  onEditar,
}: {
  insumo: InsumoDaLista;
  onEditar: () => void;
}) {
  const semPreco = insumo.custoMedio <= 0;

  return (
    <Card className={cn("transition-colors", !insumo.ativo && "opacity-60")}>
      <CardContent className="flex items-center gap-3 py-3">
        <Link
          href={`/insumos/${insumo.id}`}
          className="min-w-0 flex-1"
          aria-label={`Abrir ${insumo.nome}`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{insumo.nome}</span>
            {/* Selo só quando há algo a dizer — "Ok" em toda linha vira ruído */}
            {insumo.ativo && insumo.situacao !== "ok" ? (
              <SeloEstoque situacao={insumo.situacao} />
            ) : null}
          </div>

          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span>{ROTULO_CATEGORIA[insumo.categoria]}</span>

            <span className="num">
              {formatarQuantidade(insumo.saldo, insumo.unidadeBase)} em estoque
            </span>

            {semPreco ? (
              <span className="text-warning font-medium">sem preço ainda</span>
            ) : (
              <span className="num">
                {formatarMoedaPrecisa(insumo.custoMedio)} por{" "}
                {insumo.unidadeBase === "UN"
                  ? "unidade"
                  : insumo.unidadeBase.toLowerCase()}
              </span>
            )}
          </div>
        </Link>

        <Button variant="ghost" size="sm" onClick={onEditar} className="shrink-0">
          Editar
        </Button>
      </CardContent>
    </Card>
  );
}

function Chip({
  ativo,
  onClick,
  children,
  contador,
  tom = "normal",
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  contador?: number;
  tom?: "normal" | "alerta";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        ativo
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-accent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {contador !== undefined && contador > 0 ? (
        <span
          className={cn(
            "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
            ativo
              ? "bg-primary-foreground/20"
              : tom === "alerta"
                ? "bg-warning-soft text-warning"
                : "bg-muted",
          )}
        >
          {contador}
        </span>
      ) : null}
    </button>
  );
}
