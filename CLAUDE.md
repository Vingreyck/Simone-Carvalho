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

## ⚡ Atalhos de agilidade (Fase 6)

O sistema funcionava, mas cada compra custava ~120 toques. A Fase 6 atacou isso.

### Sem IA (sempre funcionam)

- **Repetir última compra** — traz os itens, com **preço em branco de propósito**
  (repetir o valor antigo faria o custo parecer certo estando errado).
- **Colar lista** — `farinha 5kg 28` por linha, interpretado por regex em
  `interpretarLista`. Sem IA: determinístico e de graça.
- **Mais usados no topo** dos seletores (`src/server/frequentes.ts`) — uso em
  receita pesa 2×, porque indica o que ela produz de verdade.
- **"Fez o de sempre?"** na produção — repete a última num toque.
- **Orçamento pro WhatsApp** (`src/lib/orcamento.ts`) — gera o texto formatado
  e o link `wa.me`.

### Com IA (opcional — dois provedores atrás da mesma porta)

`src/lib/ia/cliente.ts` expõe **um** `extrair()`; os provedores ficam em
`provedor-gemini.ts` e `provedor-claude.ts` (import dinâmico — só carrega o SDK
que estiver em uso). Instruções e esquemas Zod vivem num lugar só, então trocar
de provedor **não mexe em prompt nem em validação**.

| Chave | Provedor | Modelo | Custo |
|---|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio | `gemini-3.5-flash` | camada gratuita |
| `ANTHROPIC_API_KEY` | Anthropic | `claude-opus-5` | pago |

Se as duas estiverem preenchidas, **vale o Gemini** — não gastar é o padrão.
`GEMINI_MODELO` troca o modelo sem deploy.

**Por que 3.5 e não 3.7:** medido no mesmo nota, leitura idêntica — 3.5 em 11 s,
3.7 em 48 s. Resultado empatado, ganha o rápido. (`thinking_level: "minimal"`
existe só no 3.5; o 3.7 e o 2.5 aceitam apenas high/low/medium.)

Medições reais das três leituras (agosto/2026): nota 9,1 s · conversa 10,0 s ·
receita 10,5 s.

⚠️ **Pegadinha do Gemini:** ele não entende `anyOf`, e o Zod gera exatamente isso
pra campo anulável (`z.string().nullable()` → `anyOf:[string,null]`). Sem tradução
a API devolve 400 e o atalho morre. `src/lib/ia/esquema-gemini.ts` converte pro
subconjunto aceito (`{type:"string", nullable:true}`) e descarta o que ele não
conhece — schema com palavra estranha é recusado inteiro. Coberto por teste,
inclusive uma varredura que falha se algum esquema passar a emitir palavra-chave
não suportada.

⚠️ **Privacidade da camada gratuita:** o Google usa o conteúdo enviado pra
melhorar os produtos dele e revisores humanos podem ler ([docs de preços](https://ai.google.dev/gemini-api/docs/pricing)).
Nota e receita é um risco; **conversa do WhatsApp leva nome e telefone de
cliente** — dado de terceiro, não dela. Se isso pesar, é essa leitura que
justifica pôr a chave paga.

Quatro leituras em `src/lib/ia/extracoes.ts`:

1. **Foto da nota → compra** — e o insumo que ela ainda não tem é **criado
   junto**, com o `nomeLimpo` que a IA sugere ("ACUC REFINADO UNIAO 1KG" →
   "Açúcar refinado"). Antes disso a foto travava: item desconhecido obrigava
   ela a parar e cadastrar na mão.
   O insumo só nasce quando ela **confirma a compra**, não na leitura — foto
   descartada não deixa lixo no cadastro. Nasce com `alergenosRevisados: false`:
   ninguém olhou o rótulo ainda.

   ⚠️ **Duas coisas que só apareceram testando uma NFC-e de supermercado real:**

   - **A nota costuma não trazer o peso.** A linha diz "2 UN X 1,75" e o peso só
     está na embalagem. Como o insumo é medido em grama, a conversão falhava com
     uma mensagem inútil. Agora vem `precisaPeso`, o campo nasce **vazio** (um
     "1" seria plausível e errado) e a linha pede o peso em azul.
   - **Nota de mercado mistura a compra da casa.** Fósforo, esponja e macarrão
     vinham na mesma nota e virariam insumo de confeitaria. `ehIngrediente` na
     leitura separa, e só os ingredientes entram no formulário.

   ⚠️ **Mas `ehIngrediente` da IA não manda sozinho.** Três travas, porque o
   erro dessa classificação é o item **sumir em silêncio**, que é o pior tipo:

   1. Item que **casou com insumo do cadastro dela** é ingrediente e ponto — o
      cadastro dela vale mais que o palpite. (Num teste a IA marcou "FARINHA
      FEIRA NOVA" como compra de casa.)
   2. O que fica de fora aparece **pelo nome** no aviso, não como contagem. Se
      ela ainda não tem o insumo cadastrado, a trava 1 não protege — só o nome
      à vista deixa ela perceber e adicionar.
   3. Se a IA disser que **nada** na nota é ingrediente, o palpite é ignorado e
      tudo entra: nota de fornecedor de confeitaria é só ingrediente, e engolir
      a compra inteira seria bem pior que ela apagar algumas linhas.
2. **Foto do caderno / texto solto → ficha técnica**
3. **Conversa do WhatsApp → pedido**
4. **Foto do rótulo → alergênicos** (`lerRotulo`)

A leitura 4 é **transcrição, não dedução**: a embalagem é obrigada por lei a
trazer a frase pronta ("ALÉRGICOS: CONTÉM LEITE"), e a IA só copia. Por isso é
confiável num campo que existe por causa de alergia — diferente de adivinhar
alergênico pelo nome do produto, que eu me recusei a fazer no seed.

`interpretarAlergeno()` traduz o texto do rótulo pro valor da norma
("castanha-de-caju", "leite e derivados" → `CASTANHA_DE_CAJU`, `LEITE`). O que
não reconhece vira `null` e aparece na tela como "não reconheci: X" — nunca
some em silêncio.

⚠️ **`thinking_level` mexe MUITO no tempo.** No mesmo rótulo: `medium` levou
100 s, `low` levou 30 s, leitura idêntica. Todas as extrações usam `low` por
padrão — são transcrição, não raciocínio.

⚠️ **REGRA QUE NÃO SE NEGOCIA: a IA nunca grava.** Toda extração abre no
formulário normal pra ela conferir. Um "1,5 kg" lido como "15 kg" corromperia o
custo médio → o preço de todo produto que usa o insumo → e ela não descobriria
por quê. Sem a chave, os botões de IA somem e o resto funciona igual.

### Casamento texto → insumo (`src/lib/correspondencia.ts`)

"ACUC REFINADO UNIAO 1KG" → "Açúcar refinado". **Não usa IA** — é comparação de
texto, determinística e instantânea. Dois detalhes que custaram iteração:

- **Prefixo vale 0,9 fixo**, sem penalizar tamanho: abreviação de nota é sempre
  bem mais curta que a palavra ("cond" de condensado).
- **Peso por raridade + piso 1 no denominador.** "leite" aparece em 3 insumos e
  quase não identifica; "condensado" aparece em 1 e praticamente decide. O piso
  evita que um insumo só de palavras comuns ("Leite em pó") ganhe nota alta de
  graça e empate com quem casou a palavra distintiva.
- Quando ela corrige um casamento, vira `ApelidoInsumo` — naquele texto o
  sistema nunca mais erra.

## ⚠️ Alergênicos (RDC 26/2015 da ANVISA)

Obrigatório por lei desde 2016. O Anexo lista **18 itens** — a lista é fechada,
não inventar nem tirar. Item 1 é um grupo só (trigo, centeio, cevada, aveia), por
isso vira o valor único `GLUTEN`. Item 18 é látex natural (entra pela luva).

Frases exatas dos arts. 6º e 7º: `ALÉRGICOS: CONTÉM x` e `ALÉRGICOS: PODE CONTER x`.

**Como funciona:** ela marca o alergênico **uma vez** no insumo. A ficha técnica
soma sozinha, entrando nas sub-receitas — que é onde o alergênico se esconde
(o bolo "só" tem massa e recheio; o leite está lá no fundo do brigadeiro).

**A decisão que sustenta isso:** `alergenosRevisados` existe porque lista vazia é
ambígua. Açúcar realmente não tem alergênico; insumo recém-cadastrado também
está vazio — e são coisas MUITO diferentes quando o resultado é aviso de alergia.
Sem essa marca, o sistema afirmaria "não contém nada" sem ninguém ter olhado.
Enquanto houver insumo não conferido, a tela mostra o aviso **junto** com a
ressalva — não escondida, porque lista curta parece tranquilizadora e é aí que
mora o perigo.

O seed já marca 26 dos 65 insumos (o que é da natureza do ingrediente: farinha
tem glúten, leite condensado tem leite). Os 16 que variam por marca — fermento
químico às vezes leva amido de trigo, corante e pasta americana mudam de fórmula —
ficam **de propósito** como não conferidos. Chutar ali seria pior que deixar em
branco: ela confiaria no chute. O "pode conter" nunca é semeado: depende do
rótulo da marca comprada.

Regra invertida em relação ao custo: **na dúvida, avisar a mais**. Custo errado dá
prejuízo; alergênico esquecido manda alguém pro hospital.

## 🛒 Como ela vende de verdade (contado pelo Vinícius em 26/ago/2026)

Isso muda prioridade, então está escrito aqui:

- Clientes vêm de **boca a boca** e falam por **WhatsApp**. São poucos e muito fiéis.
- Ela **não quer mais clientes** — não dá conta do volume. Por isso não entrou em
  iFood nem em plataforma de venda.
- Três formas de vender: a pessoa **vai na casa dela, escolhe e leva**; ela mesma
  **entrega quando tem tempo**; ou pede pelo WhatsApp e ela **atende quando dá**.

⚠️ **O gargalo dela é tempo, não demanda.** Só vale o que economiza tempo dela.
Qualquer coisa que atraia cliente novo (cardápio público, catálogo com link,
integração de delivery) resolve um problema que ela **não tem** — e pode piorar
o que ela tem. Isso derrubou o "cardápio digital" que a pesquisa de mercado
apontava como prioridade 2.

**Venda agora** (`/vendas/agora`) nasceu daí: a venda de balcão é a mais comum
dela e era a que o sistema tratava pior — o fluxo de encomenda
(orçamento → confirmado → produzindo → pronto → entregue + registrar pagamento)
são 6 passos pra uma venda **que já acabou**. A tela nova grava direto como
ENTREGUE e paga, por baixo no mesmo `salvarPedido`, então custo congelado e
lançamento no financeiro continuam iguais.

Dois detalhes que vieram de pensar no balcão:
- Digitar **mais** que o total é troco (nota de R$ 50 numa venda de R$ 42,50),
  não receita — o excedente é descartado e a tela mostra o troco.
- Digitar **menos** é desconto de cliente fiel; fica registrado, porque some do
  lucro e ela precisa enxergar.
- No financeiro, pagamento que cobre o pedido inteiro é descrito como
  **"Venda #N"**, não "Sinal" — senão ela procuraria um resto que não existe.

## 🔔 Aviso de alta de preço — o coração do sistema

Depois de salvar uma compra, se algum insumo encareceu, abre um diálogo:
*"Farinha de trigo subiu 70% — TESTE Bolo simples passou a dar prejuízo:
custa R$ 8,50, você vende por R$ 8,00, devia ser R$ 16,67."*

É a razão do projeto existir. Ela **não tem como perceber isso sozinha** — o
prejuízo só aparece meses depois, no bolso, sem explicação.

Decisões que sustentam o aviso:

1. **Compara o custo MÉDIO, não o preço da embalagem.** Se ela tinha 10 kg de
   farinha barata e comprou 1 kg cara, o custo dos doces mal se mexe. Avisar
   "subiu 70%" ali seria mentira e viraria alarme falso.
2. **Piso de 5% (`ALTA_MINIMA_PARA_AVISAR`).** Preço oscila centavo o tempo
   todo; avisar de 0,4% treina ela a fechar sem ler — e aí a alta de 20% passa
   junto.
3. **Prejuízo primeiro na lista.** Se ela ler só a primeira linha, que seja a
   que dói. Quem já estava no prejuízo antes não conta como novidade.
4. **A IA... digo, o sistema nunca reprecifica sozinho.** Só avisa. Repassar
   preço envolve cliente fiel, e isso o sistema não sabe pesar.
5. O cálculo roda **fora da transação**: se ele falhar, a compra já está salva.
   Perder o aviso é ruim; perder a compra que ela digitou seria pior.

`receitasAfetadasPor` em `custo.ts` existia desde a Fase 2 e **nunca tinha sido
ligada em lugar nenhum** — o cálculo hoje vive em `src/lib/impacto-preco.ts`.

## 📋 "O que fazer" (`/producao/plano`)

Responde as duas perguntas da manhã dela: **o que preciso assar** e **o que
preciso comprar**. Junta encomendas + fichas técnicas + estoque, que já
existiam separados.

- Só entra pedido **CONFIRMADO/EM_PRODUCAO/PRONTO**. Orçamento fica de fora:
  assar o que a cliente não confirmou é desperdício.
- Agrupa o mesmo produto de pedidos diferentes, mas mostra pra quem é cada um.
- O grupo herda a **urgência mais apertada** — 2 atrasados + 4 pra amanhã é
  "Atrasado".
- Urgência compara só a data: entrega de hoje às 9h ainda é "hoje" às 15h. Ela
  produz quando dá.
- A lista de compras tem botão de copiar, pra ela levar no mercado.
- `totalDeItens` = tipos de doce; `totalDeUnidades` = quantidade. O painel usa o
  segundo — "6 bolos" diz o tamanho do dia, "1 tipo" não diz nada.

### Botão "Já fiz" — fecha o ciclo

Antes dele o ciclo ficava aberto: a tela mandava fazer 6 bolos, ela fazia, e o
estoque **não baixava** — teria que ir em Produção e digitar tudo de novo. Pior
que o trabalho dobrado: quando ela esquecesse, o saldo viraria ficção e a
própria lista de compras passaria a mentir.

Reusa `registrarProducao`, então mantém baixa FIFO, custo real e recálculo do
custo médio.

⚠️ **Pedido PRONTO não entra no plano.** Com ele na lista, o item continuava na
tela depois do "Já fiz" — e ela clicaria de novo, baixando o estoque **duas
vezes**. Descoberto testando no navegador.

O "Já fiz" só marca o pedido como PRONTO quando **todos** os itens dele são
aquele produto. Pedido com dois doces fica como está: dizer que está pronto com
metade feita sumiria com a outra metade da lista dela.

## 🗺️ Fases

| Fase | Módulo | Situação |
|---|---|---|
| 0 | Fundação, login, layout, PWA, deploy | ✅ pronta |
| 1 | Insumos, Compras, Estoque | ✅ pronta |
| 2 | Fichas técnicas e Precificação | ✅ pronta |
| 3 | Produção e Financeiro | ✅ pronta |
| 4 | Vendas e Encomendas | ✅ pronta |
| 5 | Câmeras ao vivo | ✅ pronta |
| 6 | Atalhos de agilidade (IA + sem IA) | ✅ pronta |
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

## 🚀 Produção (no ar desde 17/ago/2026)

- **URL:** https://simone-carvalho-production.up.railway.app
- **Railway:** projeto `bountiful-happiness`, ambiente `production`
  - serviço `Simone-Carvalho` (app, conectado ao GitHub → auto-deploy por push)
  - serviço `Postgres`
- **Login:** `simone@doceria.local` / senha em `SEED_ADMIN_SENHA` no Railway.
- `NODE_ENV=production` confirmado no contêiner → cookie de sessão sai com `Secure`.
  ⚠️ **NÃO** definir `NODE_ENV` manualmente no Railway: isso faria o npm pular as
  devDependencies e o build quebraria (Next, TypeScript e Tailwind são devDeps).

### Pegadinhas do Railway que já custaram tempo

1. `railway run <cmd>` roda o comando **na máquina local** com as variáveis do Railway.
   Como `DATABASE_URL` aponta pra `postgres.railway.internal`, dá `DatabaseNotReachable`.
   Pra mexer no banco de produção use **`railway ssh`** (roda dentro do contêiner).
2. `railway ssh` não aceita `node -e "..."` (o shell interno quebra nos parênteses) nem
   `VAR=x cmd`. Pra sobrescrever variável use **`railway ssh ... env VAR=valor cmd`**.
3. Mudar variável no painel **não reinicia** o contêiner na hora — o processo antigo
   continua com o valor velho. Confirme com `railway ssh ... printenv VAR`.
4. O seed **não roda** no deploy (só `prisma migrate deploy`). Depois de subir banco novo:
   `railway ssh --service Simone-Carvalho npm run db:seed`.

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
