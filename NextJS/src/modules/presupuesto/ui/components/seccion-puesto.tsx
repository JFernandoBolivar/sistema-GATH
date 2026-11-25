"use client";

import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatearFechaHora } from "@/modules/captacion/domain/formato";
import { reservaVigente, type FiltrosVacantes, type PaginaVacantes, type Reserva, type ResultadoAccion } from "../../domain/solicitud";
import { DialogoVacantes } from "./dialogo-vacantes";
import { FichaPuesto } from "./ficha-puesto";

interface Props {
  reserva: Reserva | null;
  /** Permiso de reservar y expediente en EN_PRESUPUESTO. */
  puedeEditar: boolean;
  cargarVacantes: (filtros: FiltrosVacantes) => Promise<ResultadoAccion<PaginaVacantes>>;
  /** Devuelve el error en español o `null`. */
  onReservar: (puestoId: number) => Promise<string | null>;
  onLiberar: () => Promise<string | null>;
  /** Caché del panel de vacantes (por expediente). */
  claveCache?: string;
}

/** Sección «Puesto»: elegir, cambiar o liberar la reserva. */
export function SeccionPuesto({ reserva, puedeEditar, cargarVacantes, onReservar, onLiberar, claveCache }: Props) {
  const [eligiendo, setEligiendo] = useState(false);
  const [confirmaLiberar, setConfirmaLiberar] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vigente = reservaVigente(reserva);

  async function liberar() {
    setLiberando(true);
    setError(null);
    const e = await onLiberar();
    setLiberando(false);
    setConfirmaLiberar(false);
    if (e) setError(e);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="titulo-puesto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="titulo-puesto" className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="size-5 text-primary" aria-hidden /> Puesto
        </h3>
        {puedeEditar && !vigente ? (
          <Button type="button" onClick={() => setEligiendo(true)}>Elegir puesto</Button>
        ) : null}
      </div>

      {vigente && reserva?.puesto ? (
        <>
          <FichaPuesto puesto={reserva.puesto} />
          <p className="text-sm text-muted-foreground" data-testid="reserva-vence">
            Reservado por {reserva.reservadoPor || "Presupuesto"} · vence el <strong>{formatearFechaHora(reserva.venceEl)}</strong>
          </p>
          {puedeEditar ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setEligiendo(true)}>Cambiar</Button>
              <Button type="button" variant="outline" onClick={() => setConfirmaLiberar(true)} disabled={liberando}>
                {liberando ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Liberar
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="sin-reserva">
          {reserva && reserva.estado === "ACTIVA"
            ? "La reserva anterior venció. Elija un puesto vacante de nuevo."
            : "Todavía no hay un puesto reservado para este postulante."}
        </p>
      )}

      {error ? <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}

      {eligiendo ? (
        <DialogoVacantes
          claveCache={claveCache}
          titulo={vigente ? "Cambiar el puesto reservado" : "Elegir el puesto"}
          cargar={cargarVacantes}
          onReservar={async (id) => {
            const e = await onReservar(id);
            if (!e) setEligiendo(false);
            return e;
          }}
          onCerrar={() => setEligiendo(false)}
        />
      ) : null}

      <AlertDialog open={confirmaLiberar} onOpenChange={(a) => (!a && !liberando ? setConfirmaLiberar(false) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar la reserva</AlertDialogTitle>
            <AlertDialogDescription>
              El puesto {reserva?.puesto?.codigo ?? ""} volverá a estar disponible y deberá elegir otro antes de emitir el Punto de Cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={liberando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={liberando}
              onClick={(e) => {
                e.preventDefault();
                void liberar();
              }}
            >
              {liberando ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Liberar puesto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
