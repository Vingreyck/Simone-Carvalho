# Simone Carvalho Doceria — Sistema de Gestão

Sistema de uso interno da doceria: controle de insumos, fichas técnicas com custo
automático, precificação, financeiro, vendas e câmeras da loja.

Roda no notebook e no celular (é um PWA — instala na tela inicial e abre como app).

---

## Como rodar na sua máquina

Precisa de **Node 20+** e **Docker** (só pro banco local).

```bash
npm install
```

```bash
cp .env.example .env
```

Gere um segredo de sessão e cole no `AUTH_SECRET` do `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Suba o Postgres, aplique as migrations e popule os insumos:

```bash
npm run db:up && npm run db:migrate && npm run db:seed
```

```bash
npm run dev
```

Abre em <http://localhost:3000>. Login inicial: o e-mail e a senha que estiverem
no `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_SENHA`).

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o sistema em modo desenvolvimento |
| `npm run build` | Gera o Prisma Client e compila pra produção |
| `npm test` | Roda os testes de cálculo (unidades, custo, preço, estoque) |
| `npm run typecheck` | Confere os tipos sem compilar |
| `npm run db:up` / `db:down` | Liga/desliga o Postgres local (Docker) |
| `npm run db:migrate` | Cria e aplica migration nova |
| `npm run db:deploy` | Aplica migrations existentes (usado em produção) |
| `npm run db:seed` | Popula insumos, categorias e a usuária inicial |
| `npm run db:studio` | Abre o Prisma Studio pra olhar o banco |

---

## Stack

- **Next.js 16** (App Router) + TypeScript — front e back no mesmo projeto
- **PostgreSQL** + **Prisma 7** (com driver adapter `@prisma/adapter-pg`)
- **Tailwind CSS v4** + **shadcn/ui**
- **decimal.js** em todo cálculo de dinheiro — float arredonda errado e some com centavo
- **Vitest** nos módulos de cálculo
- Autenticação própria: **bcrypt** + **JWT** (`jose`) em cookie httpOnly

---

## Como o projeto está organizado

```
prisma/
  schema.prisma        modelo de dados (comentado)
  migrations/          histórico do banco, com CHECK constraints
  seed.ts              insumos de confeitaria + categorias + usuária
src/
  app/
    (app)/             telas de dentro do sistema (exigem login)
    entrar/            login
    api/sair/          logout (POST)
  components/
    ui/                shadcn
    navegacao/         barra lateral, barra inferior do celular, cabeçalho
    marca.tsx          logo em SVG
  lib/
    db.ts              cliente do Prisma
    auth.ts            sessão (server), senha
    sessao.ts          assinatura do JWT (funciona no Edge)
    unidades.ts        conversão kg↔g, xícara→g
    format.ts          formatação em português (R$, datas, números)
    navegacao.ts       mapa único do menu
  proxy.ts             porteiro das rotas (o antigo middleware)
tests/                 testes de cálculo
```

### Duas regras que sustentam o resto

1. **Estoque vive sempre na unidade base do insumo** (g, ml ou un).
   Kg, litro, xícara e colher são só formas de digitar — convertidas na entrada
   por `src/lib/unidades.ts` e nunca gravadas.

2. **Dinheiro nunca passa por `number`.** Custo por grama é da ordem de
   R$ 0,0056 — em float, multiplicar isso mil vezes acumula erro. Tudo usa
   `Decimal` (decimal.js), e o banco guarda `Decimal(14,6)` pra custo unitário
   e `Decimal(12,2)` pra valores em reais.

---

## Estado atual

| Fase | Módulo | Situação |
|---|---|---|
| 0 | Fundação, login, layout, PWA, deploy | ✅ pronta |
| 1 | Insumos, Compras, Estoque | ✅ pronta |
| 2 | Fichas técnicas e Precificação | ✅ pronta |
| 3 | Produção e Financeiro | ⏳ a construir |
| 4 | Vendas e Encomendas | ⏳ a construir |
| 5 | Câmeras ao vivo | ⏳ a construir |

O modelo de dados de **todas** as fases já está no `schema.prisma` e migrado —
as fases seguintes são só telas e regras em cima dele.

---

## Deploy (Railway)

Um serviço web + um Postgres. Variáveis necessárias:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | referência ao Postgres do projeto |
| `AUTH_SECRET` | **outro** valor aleatório, diferente do local |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_SENHA` | só pro primeiro seed |

O `railway.json` já roda `prisma migrate deploy` antes de subir o app, então as
migrations sobem junto com o deploy.
