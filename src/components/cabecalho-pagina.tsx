/** Título da seção + ação principal. Padroniza o topo de todas as listas. */
export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">{titulo}</h2>
        {descricao ? (
          <p className="text-muted-foreground mt-0.5 text-sm">{descricao}</p>
        ) : null}
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </div>
  );
}
