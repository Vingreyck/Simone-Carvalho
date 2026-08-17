import { cn } from "@/lib/utils";

/**
 * Marca da doceria.
 *
 * Recriação em SVG do monograma (oval + "SC" + ramo de oliveira) pra ficar
 * nítida em qualquer tamanho e acompanhar o tema. Quando o arquivo original
 * do logo entrar em `public/marca/`, basta trocar o corpo do `MarcaIcone`
 * por um `<Image>` — o resto do sistema não muda.
 */

/**
 * Id fixo de propósito. Toda instância define exatamente o mesmo gradiente,
 * então compartilhar o id é inofensivo — o navegador resolve pela primeira
 * definição e o desenho sai idêntico. Gerar id incremental exigiria mutar
 * estado durante o render (impuro) e `useId` não existe em Server Component.
 */
const ID_OURO = "marca-ouro";

export function MarcaIcone({
  className,
  titulo = "Simone Carvalho Doceria",
}: {
  className?: string;
  titulo?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-9 w-9", className)}
      role="img"
      aria-label={titulo}
    >
      <defs>
        <linearGradient id={ID_OURO} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.5426 0.0983 84.4)" />
          <stop offset="35%" stopColor="oklch(0.8826 0.101 96.9)" />
          <stop offset="62%" stopColor="oklch(0.7665 0.1387 91.1)" />
          <stop offset="100%" stopColor="oklch(0.5426 0.0983 84.4)" />
        </linearGradient>
      </defs>

      {/* Moldura oval */}
      <ellipse
        cx="46"
        cy="50"
        rx="31"
        ry="40"
        fill="none"
        stroke={`url(#${ID_OURO})`}
        strokeWidth="2.4"
      />

      {/* Monograma — usa a manuscrita da marca */}
      <text
        x="45"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill={`url(#${ID_OURO})`}
        style={{
          fontFamily: "var(--font-parisienne), cursive",
          fontSize: "52px",
        }}
      >
        SC
      </text>

      {/* Ramo de oliveira saindo da lateral direita do oval */}
      <g
        fill="none"
        stroke={`url(#${ID_OURO})`}
        strokeWidth="1.9"
        strokeLinecap="round"
      >
        <path d="M70 20 C 76 34, 78 50, 73 66" />
        <path d="M71 29 C 78 26, 84 28, 86 33 C 80 36, 74 34, 71 29 Z" fill={`url(#${ID_OURO})`} stroke="none" />
        <path d="M74 41 C 81 39, 87 41, 89 46 C 83 49, 77 46, 74 41 Z" fill={`url(#${ID_OURO})`} stroke="none" />
        <path d="M74 54 C 81 52, 87 55, 88 60 C 82 62, 76 59, 74 54 Z" fill={`url(#${ID_OURO})`} stroke="none" />
        <path d="M69 24 C 63 21, 58 22, 56 26 C 61 29, 66 28, 69 24 Z" fill={`url(#${ID_OURO})`} stroke="none" />
      </g>
    </svg>
  );
}

/** Marca completa — usada no login e no topo da barra lateral. */
export function MarcaCompleta({
  className,
  tamanho = "md",
}: {
  className?: string;
  tamanho?: "sm" | "md" | "lg";
}) {
  const escala = {
    sm: { icone: "h-8 w-8", nome: "text-xl", sub: "text-[9px] tracking-[0.32em]" },
    md: { icone: "h-11 w-11", nome: "text-2xl", sub: "text-[10px] tracking-[0.34em]" },
    lg: { icone: "h-16 w-16", nome: "text-4xl", sub: "text-xs tracking-[0.38em]" },
  }[tamanho];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <MarcaIcone className={escala.icone} />

      <div className="flex flex-col leading-none">
        <span
          className={cn("text-gradient-gold font-script", escala.nome)}
          style={{ fontFamily: "var(--font-parisienne), cursive" }}
        >
          Simone Carvalho
        </span>
        <span
          className={cn(
            "text-muted-foreground mt-1 font-medium uppercase",
            escala.sub,
          )}
        >
          Doceria
        </span>
      </div>
    </div>
  );
}
