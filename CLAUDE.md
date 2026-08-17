# Simone Carvalho Doceria — Memória do Projeto

> Lido no início de cada sessão.
> Idioma: responder ao Vinícius **em português, de forma simples** (nível júnior).

## 🎯 O que é

Sistema de gestão para a **Simone**, confeiteira. Uso pessoal dela — nenhum outro
funcionário. Ela hoje controla tudo em caderno/cabeça/WhatsApp.

**A dor central:** sem ficha técnica e sem controle de insumo, ela não sabe o custo
real de cada bolo. Quando a farinha ou o chocolate sobem, o preço de venda dela
continua igual — e ela pode estar vendendo no prejuízo sem saber. Tudo no sistema
existe pra resolver isso.

## 🎨 Identidade visual (do logo real que o Vinícius mandou)

- Nome: **Simone Carvalho · DOCERIA** (é "Doceria", NÃO "Confeitaria").
- Cores: **verde sage `#C9D1AE`** (fundo do logo) + **dourado `#D4AF37` → bronze `#8A6A1F`**.
- Elementos: monograma "SC" manuscrito dentro de oval + ramo de oliveira.
- **Cuidado de contraste:** dourado puro com texto branco dá ~2,3:1 (reprova).
  Por isso o BOTÃO primário usa o **bronze** (~5,5:1) e o dourado fica nos detalhes.
  No tema escuro o dourado vira o primário (aí contrasta bem).
- ⚠️ **PENDENTE:** o arquivo original do logo não está no repo. O `src/components/marca.tsx`
  e o `public/icons/icone.svg` são uma **recriação em SVG**. Quando o arquivo chegar,
  colocar em `public/marca/` e trocar o corpo do `MarcaIcone`.

## 🧱 Stack e decisões

- **Next.js 16 (App Router) + TypeScript**, front e back no mesmo projeto → 1 serviço no Railway.
- **PostgreSQL + Prisma 7**. Deploy no **Railway** (padrão do SeeNet).
- **Tailwind v4 + shadcn/ui** (style `radix-nova`).
- Auth **própria** (bcrypt + `jose` JWT em cookie httpOnly) — NÃO usei Auth.js/NextAuth
  porque a v5 ainda é beta e o risco de incompatibilidade com Next 16 não valia a pena.
- **PWA** desde o início: ela instala na tela inicial do celular. Sem app Flutter por ora.
- **Vitest** só nos módulos de cálculo (é onde dinheiro erra).

## ⚠️ Pegadinhas do Prisma 7 (já custaram tempo — não repetir)

1. `datasource db { url = env("DATABASE_URL") }` **não existe mais**. A URL vai no
   `prisma.config.ts`, e o `PrismaClient` recebe um **driver adapter**:
   ```ts
   new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
   ```
2. O generator é `prisma-client` (não `prisma-client-js`) e **exige `output`**.
   Sai em `src/generated/prisma/` (gitignored). Import: `@/generated/prisma/client`.
3. `prisma` e `dotenv` estão em **dependencies** (não dev) porque o Railway pode podar
   devDependencies antes do `migrate deploy` no start.
4. As skills do Prisma em `.agents/skills/` documentam a API v7 — consultar em caso de dúvida.

## 🔢 Duas regras que sustentam o sistema

1. **Estoque vive sempre na unidade base do insumo** (`G`, `ML` ou `UN`).
   Kg/litro/xícara/colher são só formas de DIGITAR — convertidas na entrada por
   `src/lib/unidades.ts` e **nunca gravadas**. Equivalência é **por insumo**
   (xícara de farinha = 120 g, de açúcar = 180 g).
2. **Dinheiro nunca passa por `number`.** Custo por grama é ~R$ 0,0056; em float o erro
   acumula. Tudo com `Decimal` (decimal.js). Banco: `Decimal(14,6)` custo unitário,
   `Decimal(12,2)` reais, `Decimal(14,4)` quantidades.

## 📐 Fórmula de precificação (markup divisor — a correta)

```
CustoDireto   = CMV(ficha técnica) + Embalagem + MãoDeObra(tempo × valor/hora)
Divisor       = 1 − (%CustosFixos + %Taxas + %Impostos + %MargemLucro)
PreçoSugerido = CustoDireto ÷ Divisor
```
Não usar "custo × 3" (é o que a maioria faz e erra). Os custos fixos cadastrados
(gás, luz, aluguel) alimentam o `%CustosFixos` — fecha o ciclo despesa real → preço.

## 🗺️ Fases

| Fase | Módulo | Situação |
|---|---|---|
| 0 | Fundação, login, layout, PWA, deploy | ✅ pronta |
| 1 | Insumos, Compras, Estoque | ⏳ próxima |
| 2 | Fichas técnicas e Precificação | ⏳ |
| 3 | Produção e Financeiro | ⏳ |
| 4 | Vendas e Encomendas | ⏳ |
| 5 | Câmeras ao vivo | ⏳ |
| — | Portal do cliente + WhatsApp | só quando ela pedir |

O `schema.prisma` já cobre **todas** as fases e está migrado. As próximas fases são
telas e regras em cima do modelo que já existe.

## 📷 Câmeras (Fase 5) — arquitetura decidida

Ela **ainda não comprou**. Recomendação: câmeras com **RTSP nativo**
(Intelbras iM4 C / iM5 S / iM7 S, ou TP-Link Tapo C210/C212/C520WS) + microSD.

```
[Câmeras RTSP na loja] → [mini-PC com go2rtc] → [Cloudflare Tunnel] → [sistema no Railway]
```
- Vídeo **não passa pelo Railway** → sem custo de banda.
- Cloudflare Tunnel é TCP; WebRTC puro quer UDP. Pelo túnel vai **MSE / WebRTC-over-TCP**,
  latência ~1s (ótimo pra loja). Se quiser ~0,3s, alternativa é **Tailscale** (exige app
  no celular dela).
- LGPD: aviso de "ambiente monitorado" na loja, acesso só autenticado, sem nuvem.

## 🔒 Regras de trabalho

- **NÃO** dar `git commit` / `git push` / deploy sem o Vinícius pedir. Eu dou o comando, ele roda.
- Validar sempre antes de concluir: `npm run typecheck`, `npm test`, `npm run build`.
- Entregar **fase por fase**, cada uma funcionando ponta a ponta. Ele aprova antes da próxima.
- Linguagem das telas é pra **ela**, não pra dev: "Quanto custa fazer" em vez de "CMV".

## 🧪 Teste manual de ponta a ponta (rodar a cada fase)

Comprar 5 kg de farinha por R$ 28 → saldo 5.000 g e custo R$ 0,0056/g → receita usando
500 g → custo R$ 2,80 → registrar produção → baixa no lote certo → preço sugerido no produto.

## 🐘 Banco local

```bash
npm run db:up && npm run db:migrate && npm run db:seed
```
Postgres em **localhost:5433** (porta 5433 de propósito, pra não brigar com outro Postgres
da máquina). Usuária inicial: `simone@doceria.local` / senha do `.env`.
