import { AlertTriangle } from "lucide-react";
import type { BloqueoVisible, PestanaDetalle } from "../../domain/bloqueos";

/** Causa del bloqueo de las acciones, bien visible (ámbar) y con enlace a la pestaña que la resuelve (M5). */
export function AvisoBloqueos({ bloqueos, onIrAPestana }: { bloqueos: BloqueoVisible[]; onIrAPestana?: (p: PestanaDetalle) => void }) {
  if (bloqueos.length === 0) return null;
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm" data-testid="aviso-bloqueo">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">Hay acciones bloqueadas</p>
        <ul className="mt-1 flex flex-col gap-1">
          {bloqueos.map((b) => (
            <li key={b.causa} className="break-words">
              <span className="font-medium">{b.accion}:</span> {b.causa}{" "}
              {b.pestana && onIrAPestana ? (
                <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={() => onIrAPestana(b.pestana as PestanaDetalle)}>
                  Ir a {b.etiquetaPestana}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
