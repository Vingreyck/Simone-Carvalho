import { describe, expect, it } from "vitest";

import { linkDoWhatsApp, montarOrcamento } from "@/lib/orcamento";
import { formatarMoeda } from "@/lib/format";

// O Intl usa espaço não-quebrável entre "R$" e o número — comparar com string
// literal falharia por um caractere invisível. Sempre formatar dos dois lados.

const base = {
  nomeDaDoceria: "Simone Carvalho Doceria",
  cliente: "Maria",
  itens: [
    { nome: "Bolo de brigadeiro", quantidade: 1, precoUnitario: 180 },
    { nome: "Brigadeiro", quantidade: 50, precoUnitario: 2.5 },
  ],
};

describe("montarOrcamento", () => {
  it("abre com o nome da doceria e o da cliente", () => {
    const texto = montarOrcamento(base);

    expect(texto).toContain("*Simone Carvalho Doceria*");
    expect(texto).toContain("Orçamento para Maria:");
  });

  it("multiplica quantidade pelo preço em cada linha", () => {
    const texto = montarOrcamento(base);

    // 50 × 2,50 = 125,00
    expect(texto).toContain("50x Brigadeiro");
    expect(texto).toContain("125,00");
  });

  it("omite o '1x' quando é uma unidade só", () => {
    const texto = montarOrcamento(base);

    expect(texto).toContain("• Bolo de brigadeiro");
    expect(texto).not.toContain("1x Bolo");
  });

  it("soma o total certo", () => {
    // 180 + 125 = 305
    expect(montarOrcamento(base)).toContain(`*Total: ${formatarMoeda(305)}*`);
  });

  it("não repete subtotal quando não há desconto nem entrega", () => {
    expect(montarOrcamento(base)).not.toContain("Subtotal");
  });

  it("detalha subtotal, desconto e entrega quando existem", () => {
    const texto = montarOrcamento({ ...base, desconto: 5, taxaEntrega: 10 });

    expect(texto).toContain(`Subtotal: ${formatarMoeda(305)}`);
    expect(texto).toContain(`Desconto: −${formatarMoeda(5)}`);
    expect(texto).toContain(`Entrega: ${formatarMoeda(10)}`);
    expect(texto).toContain(`*Total: ${formatarMoeda(310)}*`);
  });

  it("mostra o que falta receber quando houve sinal", () => {
    const texto = montarOrcamento({ ...base, sinalPago: 100 });

    expect(texto).toContain(`Já recebido: ${formatarMoeda(100)}`);
    expect(texto).toContain(`*Falta: ${formatarMoeda(205)}*`);
  });

  it("não mostra 'falta' quando o pedido está quitado", () => {
    const texto = montarOrcamento({ ...base, sinalPago: 305 });

    expect(texto).toContain("Já recebido");
    expect(texto).not.toContain("Falta:");
  });

  it("inclui a observação do item em itálico", () => {
    const texto = montarOrcamento({
      ...base,
      itens: [
        {
          nome: "Bolo",
          quantidade: 1,
          precoUnitario: 180,
          observacao: "sem lactose",
        },
      ],
    });

    expect(texto).toContain("_sem lactose_");
  });

  it("funciona sem cliente identificada", () => {
    const texto = montarOrcamento({ ...base, cliente: null });
    expect(texto).toContain("Seu orçamento:");
  });
});

describe("linkDoWhatsApp", () => {
  it("põe o DDI 55 em número brasileiro", () => {
    const url = linkDoWhatsApp("oi", "(79) 99999-1234");
    expect(url).toContain("wa.me/5579999991234");
  });

  it("não duplica o DDI se já vier com ele", () => {
    const url = linkDoWhatsApp("oi", "5579999991234");
    expect(url).toContain("wa.me/5579999991234");
    expect(url).not.toContain("555579");
  });

  it("sem telefone, abre o seletor de contato", () => {
    expect(linkDoWhatsApp("oi")).toBe("https://wa.me/?text=oi");
  });

  it("escapa quebra de linha e acento no texto", () => {
    const url = linkDoWhatsApp("linha 1\nOrçamento");
    expect(url).toContain("%0A");
    expect(url).not.toContain("\n");
  });
});
