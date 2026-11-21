import Image from "next/image";
import { LogOut } from "lucide-react";
import { cerrarSesionPostulanteAction } from "../infrastructure/actions/postulacion-actions";

/** Encabezado institucional simple del área del postulante: sin menú del personal. */
export function EncabezadoPostulante({ nombre }: { nombre?: string }) {
  return (
    <header className="border-b-4 border-brand-gold bg-brand-deep text-white">
      <div className="mx-auto flex min-h-16 w-full max-w-4xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="size-10 rounded-md bg-white/10" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-bold">CONATEL</p>
            <p className="truncate text-xs text-white/80">Portal del postulante</p>
          </div>
        </div>
        {nombre && (
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden max-w-[16rem] truncate text-sm sm:block" title={nombre}>
              {nombre}
            </span>
            <form action={cerrarSesionPostulanteAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/40 px-3 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              >
                <LogOut className="size-4" aria-hidden />
                Salir
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
