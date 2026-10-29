/** Enlace "Saltar al contenido": visible solo al recibir foco por teclado. */
export function SkipLink({ destino = "contenido-principal" }: { destino?: string }) {
  return (
    <a
      href={`#${destino}`}
      className="sr-only z-[100] rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Saltar al contenido
    </a>
  );
}
