# Câmeras da loja — o que comprar e como ligar no sistema

Guia prático pra colocar as câmeras da doceria dentro do sistema, acessíveis do
celular de qualquer lugar.

---

## Resumo da arquitetura

```
[Câmeras RTSP na loja]
        │  rede local (cabo ou Wi-Fi)
        ▼
[Mini-PC rodando go2rtc]      ← converte RTSP em algo que o navegador entende
        │  Cloudflare Tunnel  ← saída segura, sem abrir porta no roteador
        ▼
[https://cameras.suadoceria.com]
        │
        ▼
[Sistema no Railway] → aba "Câmeras"
```

**Por que não mandar o vídeo direto pro Railway:** vídeo 24/7 geraria custo de
banda alto e desnecessário. Neste desenho o vídeo vai **direto da loja pro celular
dela** — o Railway só entrega a página.

---

## 1. O que comprar

### Câmeras

O requisito que não pode faltar é **RTSP nativo**. Câmera que só funciona pelo app
do fabricante não dá pra integrar de verdade.

| Onde | Modelos | Observação |
|---|---|---|
| Interna | **Intelbras iM4 C** / **iM5 S**, ou **TP-Link Tapo C210 / C212** | RTSP em `rtsp://usuario:senha@IP:554/stream1` |
| Externa | **Intelbras iM7 S** ou **TP-Link Tapo C520WS** | resistente a chuva, visão noturna colorida |

Compre um **cartão microSD** pra cada uma (32–128 GB). A gravação fica local, sem
mensalidade de nuvem.

> **Antes de fechar a compra**, confirme na caixa ou no manual que o modelo tem
> RTSP/ONVIF. Alguns fabricantes tiram esse recurso em revisões de hardware.

### O computador da loja

Qualquer um destes serve:

- **Notebook velho** que esteja parado (a opção grátis)
- **Mini-PC** tipo Intel N100 — R$ 500 a R$ 800
- **Raspberry Pi 4/5** — funciona bem até ~4 câmeras

Ele precisa ficar **ligado o tempo todo** e na mesma rede das câmeras.

---

## 2. Ligar as câmeras

1. Instale as câmeras e configure pelo app do fabricante (Wi-Fi, senha).
2. No app, **ative o RTSP** e crie uma senha específica pra ele.
3. Anote o **IP de cada câmera** e deixe fixo — no roteador, procure por
   "DHCP reservation" ou "IP fixo". Sem isso o IP muda e o vídeo some do nada.
4. Teste no computador com o [VLC](https://www.videolan.org):
   `Mídia → Abrir fluxo de rede → rtsp://usuario:senha@192.168.0.50:554/stream1`

Se abrir no VLC, funciona no resto.

---

## 3. Instalar o go2rtc

No computador da loja. Escolha o sistema:

**Linux / Raspberry Pi:**

```bash
mkdir -p ~/go2rtc && cd ~/go2rtc && curl -L -o go2rtc "https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_amd64" && chmod +x go2rtc
```

**Windows:** baixe `go2rtc_win64.zip` em
<https://github.com/AlexxIT/go2rtc/releases> e descompacte numa pasta.

Crie o arquivo **`go2rtc.yaml`** na mesma pasta:

```yaml
streams:
  balcao: rtsp://usuario:senha@192.168.0.50:554/stream1
  salao: rtsp://usuario:senha@192.168.0.51:554/stream1
  cozinha: rtsp://usuario:senha@192.168.0.52:554/stream1

api:
  listen: ":1984"
```

O nome à esquerda (`balcao`, `salao`) é o **nome do stream** que você vai digitar
no sistema depois. Use nomes simples, sem acento e sem espaço.

Rode e teste em `http://localhost:1984` — as câmeras devem aparecer.

### Deixar rodando sozinho

**Linux** (`/etc/systemd/system/go2rtc.service`):

```ini
[Unit]
Description=go2rtc
After=network.target

[Service]
ExecStart=/home/SEU_USUARIO/go2rtc/go2rtc
WorkingDirectory=/home/SEU_USUARIO/go2rtc
Restart=always
User=SEU_USUARIO

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now go2rtc
```

**Windows:** coloque um atalho do `go2rtc.exe` na pasta que abre com o Windows
(tecla Windows + R → `shell:startup`).

---

## 4. Expor com Cloudflare Tunnel

O túnel cria um endereço `https://` público **sem abrir nenhuma porta no
roteador** — a conexão sai de dentro pra fora. É grátis.

Precisa de um domínio no Cloudflare (um `.com.br` sai ~R$ 40/ano).

```bash
cloudflared tunnel login
```

```bash
cloudflared tunnel create doceria
```

```bash
cloudflared tunnel route dns doceria cameras.suadoceria.com
```

Configure (`~/.cloudflared/config.yml`):

```yaml
tunnel: doceria
credentials-file: /home/SEU_USUARIO/.cloudflared/SEU-TUNNEL-ID.json

ingress:
  - hostname: cameras.suadoceria.com
    service: http://localhost:1984
  - service: http_status:404
```

```bash
sudo cloudflared service install
```

Teste abrindo `https://cameras.suadoceria.com` no celular, **fora do Wi-Fi da
loja**. Se as câmeras aparecerem, está pronto.

### ⚠️ Proteja esse endereço

Sem proteção, esse link mostra as câmeras pra **qualquer um que descobrir a URL**.
Escolha uma das duas:

- **Cloudflare Access** (recomendado, grátis até 50 usuários): exige login por
  e-mail pra abrir o endereço. No painel do Cloudflare: *Zero Trust → Access →
  Applications*.
- **Usuário e senha no go2rtc**, adicionando ao `go2rtc.yaml`:
  ```yaml
  api:
    listen: ":1984"
    username: simone
    password: UMA-SENHA-BEM-LONGA
  ```

---

## 5. Cadastrar no sistema

Na doceria, vá em **Câmeras → Nova câmera** e preencha:

| Campo | O que colocar |
|---|---|
| Nome | Balcão |
| Onde fica | Frente da loja |
| Como conectar | **go2rtc (recomendado)** |
| Endereço | `https://cameras.suadoceria.com` (sem barra no final) |
| Nome do stream | `balcao` — o mesmo do `go2rtc.yaml` |

Repita pra cada câmera. Elas aparecem lado a lado, e o botão de expandir abre em
tela cheia.

> O sistema **não guarda a senha das câmeras**. Quem conversa em RTSP com elas é
> o go2rtc, dentro da loja. Se o banco de dados vazar, ninguém ganha acesso às
> imagens.

---

## 6. Sobre a latência

O Cloudflare Tunnel trabalha em TCP, e o WebRTC "puro" prefere UDP. Na prática o
go2rtc percebe isso e cai pra **MSE / WebRTC-over-TCP** sozinho: a imagem chega
com cerca de **1 segundo** de atraso. Pra vigiar uma loja, é ótimo.

Se um dia precisar de latência menor (~0,3 s), a alternativa é o **Tailscale** —
uma VPN que passa UDP. O custo é que ela precisaria abrir o app do Tailscale no
celular antes de ver as câmeras. Por isso a escolha padrão aqui é o Cloudflare
Tunnel: funciona em qualquer navegador, sem instalar nada.

---

## 7. LGPD — o mínimo necessário

Câmera grava pessoas, então a lei se aplica. O básico:

- **Aviso visível** na entrada: *"Ambiente monitorado por câmeras"*.
- **Não instalar** câmera em banheiro, vestiário ou área de descanso.
- **Acesso só autenticado** — o sistema já exige login, e o endereço do túnel
  deve estar protegido (passo 4).
- **Sem nuvem de terceiros**: a gravação fica no cartão da câmera, dentro da loja.
- Guarde as imagens só pelo tempo necessário (30 dias é um prazo comum).

---

## Quando alguma coisa não funciona

| Sintoma | Provável causa |
|---|---|
| "Sem imagem" no sistema | O computador da loja desligou, ou o go2rtc parou. Abra `https://cameras...` direto. |
| Funciona no Wi-Fi da loja mas não fora | O túnel caiu. `sudo systemctl status cloudflared` |
| Uma câmera some, as outras ficam | O IP dela mudou. Fixe o IP no roteador. |
| Imagem travando | Wi-Fi fraco na câmera. Use o `stream2` (qualidade menor) ou passe cabo de rede. |
| Vídeo demora a aparecer | Normal nos primeiros 2–3 segundos: é o go2rtc negociando a conexão. |
