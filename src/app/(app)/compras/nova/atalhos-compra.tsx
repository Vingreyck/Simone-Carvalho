"use client";

import { useState, useTransition } from "react";
import {
  ClipboardList,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { formatarMoeda } from "@/lib/format";

import { BotaoFoto } from "@/components/botao-foto";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { lerNota, type ItemLido } from "./acoes-ia";
import { carregarUltimaCompra, interpretarLista } from "./acoes-atalhos";

export type ResultadoDoAtalho = {
  itens: ItemLido[];
  fornecedor?: string | null;
  data?: string | null;
  notaFiscal?: string | null;
};

/**
 * As três formas rápidas de começar uma compra.
 *
 * Nenhuma delas grava nada — todas preenchem o formulário logo abaixo, que ela
 * confere e confirma. É esse passo de conferência que deixa a leitura por foto
 * ser útil sem ser perigosa.
 */
export function AtalhosCompra({
  iaConfigurada,
  onPreencher,
}: {
  iaConfigurada: boolean;
  onPreencher: (resultado: ResultadoDoAtalho) => void;
}) {
  const [lendoFoto, setLendoFoto] = useState(false);
  const [carregando, iniciar] = useTransition();
  const [listaAberta, setListaAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [avisoDoCupom, setAvisoDoCupom] = useState<string | null>(null);

  async function aoTirarFoto(arquivo: File) {
    setLendoFoto(true);
    setAvisoDoCupom(null);

    try {
      const dados = new FormData();
      dados.set("foto", arquivo);

      const resultado = await lerNota(dados);

      if (!resultado.ok || !resultado.itens) {
        toast.error(resultado.erro ?? "Não consegui ler a nota.");
        return;
      }

      if (resultado.itens.length === 0) {
        toast.error("Não achei nenhum item nessa foto. Tente de novo, mais de perto.");
        return;
      }

      /*
        Nota de supermercado traz a compra da casa junto: fósforo, esponja,
        macarrão. Entram só os ingredientes — o resto viraria insumo de
        confeitaria no cadastro dela, e ela teria que apagar um por um.
      */
      const ingredientes = resultado.itens.filter(
        (i) => i.ehIngrediente !== false,
      );
      const deCasa = resultado.itens.length - ingredientes.length;

      if (ingredientes.length === 0) {
        toast.error(
          "Nessa nota só achei compra de casa, nenhum ingrediente de doceria.",
        );
        return;
      }

      onPreencher({
        itens: ingredientes,
        fornecedor: resultado.fornecedor,
        data: resultado.data,
        notaFiscal: resultado.notaFiscal,
      });

      const semCasar = ingredientes.filter((i) => !i.insumoId).length;
      const duvidosos = ingredientes.filter(
        (i) => i.insumoId && !i.confiante,
      ).length;
      const semPeso = ingredientes.filter((i) => i.precisaPeso).length;

      toast.success(
        `Li ${ingredientes.length} ${ingredientes.length === 1 ? "ingrediente" : "ingredientes"}. Confira antes de confirmar.`,
      );

      // O total da nota é a melhor conferência que existe: se bate com a soma
      // dos itens, provavelmente nenhum número foi lido errado.
      // Soma TODOS os itens, inclusive os de casa que não entraram: é contra o
      // total impresso que se descobre se algum número foi lido errado.
      const soma = resultado.itens.reduce((t, i) => t + i.valorTotal, 0);
      const total = resultado.valorTotalDaNota;

      const partes: string[] = [];

      if (semPeso > 0) {
        partes.push(
          `${semPeso} ${semPeso === 1 ? "item veio" : "itens vieram"} sem o peso na nota — escreva quanto vem em cada pacote.`,
        );
      }

      if (deCasa > 0) {
        partes.push(
          `Deixei de fora ${deCasa} ${deCasa === 1 ? "item que não é" : "itens que não são"} de doceria (compra de casa).`,
        );
      }

      if (total && Math.abs(soma - total) > 0.05) {
        partes.push(
          `A soma dos itens deu ${formatarMoeda(soma)}, mas a nota diz ${formatarMoeda(total)}. Confira as quantidades.`,
        );
      }
      if (semCasar > 0) {
        partes.push(
          `${semCasar} ${semCasar === 1 ? "item não bateu" : "itens não bateram"} com nenhum insumo — escolha na mão.`,
        );
      }
      if (duvidosos > 0) {
        partes.push(
          `${duvidosos} ${duvidosos === 1 ? "item veio" : "itens vieram"} com palpite incerto (marcado em amarelo).`,
        );
      }

      setAvisoDoCupom(partes.length > 0 ? partes.join(" ") : null);
    } finally {
      setLendoFoto(false);
    }
  }

  function repetirUltima() {
    iniciar(async () => {
      const resultado = await carregarUltimaCompra();

      if (!resultado.ok || !resultado.itens) {
        toast.error(resultado.erro ?? "Não consegui carregar.");
        return;
      }

      onPreencher({
        itens: resultado.itens,
        fornecedor: resultado.fornecedor,
      });

      toast.success("Última compra copiada. Agora ajuste os preços.");
      setAvisoDoCupom(
        "Os preços vieram em branco de propósito — preencher com o valor antigo faria o custo parecer certo estando errado.",
      );
    });
  }

  function lerLista() {
    iniciar(async () => {
      const resultado = await interpretarLista(texto);

      if (!resultado.ok || !resultado.itens) {
        toast.error(resultado.erro ?? "Não consegui entender a lista.");
        return;
      }

      onPreencher({ itens: resultado.itens });
      setListaAberta(false);
      setTexto("");
      toast.success(`${resultado.itens.length} linhas interpretadas.`);
      setAvisoDoCupom("Confira o insumo e a unidade de cada linha.");
    });
  }

  return (
    <>
      <Card className="border-gold-hairline bg-accent/20">
        <CardContent className="py-4">
          <p className="text-muted-foreground mb-3 text-sm font-medium">
            Comece rápido
          </p>

          <div className="flex flex-wrap gap-2">
            {iaConfigurada ? (
              <BotaoFoto
                onFoto={aoTirarFoto}
                processando={lendoFoto}
                rotulo="Ler nota por foto"
                className="bg-card"
              />
            ) : null}

            <Button
              type="button"
              variant="outline"
              disabled={carregando}
              onClick={repetirUltima}
              className="bg-card"
            >
              {carregando ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Repetir a última
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setListaAberta(true)}
              className="bg-card"
            >
              <ClipboardList className="size-4" />
              Colar lista
            </Button>
          </div>

          {iaConfigurada ? (
            <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-xs">
              <Sparkles className="mt-0.5 size-3 shrink-0" />
              A foto preenche o formulário abaixo. Nada é salvo até você
              conferir e confirmar.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {avisoDoCupom ? (
        <Alert className="border-warning/30 bg-warning-soft/40">
          <TriangleAlert className="text-warning size-4" />
          <AlertDescription>{avisoDoCupom}</AlertDescription>
        </Alert>
      ) : null}

      {/* ------------------------------------------------------ colar lista */}
      <Dialog open={listaAberta} onOpenChange={setListaAberta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Colar lista</DialogTitle>
            <DialogDescription>
              Uma linha por item, no formato: nome, tamanho e valor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={7}
              autoFocus
              placeholder={"farinha 5kg 28\nacucar 1kg 4,50\n2 leite condensado 395g 12,80\novo 30un 22"}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Um número no começo é a quantidade de embalagens. O último número
              é quanto você pagou naquela linha.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setListaAberta(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={lerLista}
              disabled={carregando || !texto.trim()}
            >
              {carregando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Lendo...
                </>
              ) : (
                "Interpretar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
