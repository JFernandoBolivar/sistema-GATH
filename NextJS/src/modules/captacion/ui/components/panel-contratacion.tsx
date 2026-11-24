"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Loader2, UserCheck } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resumenAntesDeContratar, rutaFichaTrabajador, textoCuenta, type ResultadoContratacion } from "../../domain/contratacion";

export function DialogoContratar({
  abierto, pendiente, error, nombre, puestoCodigo, onConfirmar, onCancelar,
}: {
  abierto: boolean;
  pendiente: boolean;
  error: string | null;
  nombre: string;
  puestoCodigo?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <AlertDialog open={abierto} onOpenChange={(a) => (!a && !pendiente ? onCancelar() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Contratar a {nombre} y asignar el puesto?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-left">
              <p>Al confirmar, todo ocurre en un solo paso (si algo falla, no queda nada a medias):</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {resumenAntesDeContratar(puestoCodigo).map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={pendiente} onClick={(e) => { e.preventDefault(); onConfirmar(); }}>
            {pendiente && <Loader2 className="animate-spin" aria-hidden />} Contratar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const TONO = {
  exito: "border-success/40 bg-success-soft text-success",
  atencion: "border-warning/40 bg-warning-soft text-warning",
  info: "border-info/40 bg-info-soft text-info",
} as const;

/** Resultado de la contratación: qué se hizo y qué falta con la cuenta de acceso. */
export function PanelExitoContratacion({ resultado, nombre, onCerrar }: { resultado: ResultadoContratacion; nombre: string; onCerrar: () => void }) {
  const cuenta = textoCuenta(resultado.cuenta);
  const Icono = cuenta.tono === "atencion" ? AlertTriangle : cuenta.tono === "exito" ? CheckCircle2 : Info;
  return (
    <section aria-label="Contratación completada" data-testid="panel-contratacion" className="flex flex-col gap-4 rounded-xl border-2 border-success/50 bg-success-soft/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success text-white"><UserCheck className="size-6" aria-hidden /></span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold">¡Contratación completada! {nombre} ya forma parte de CONATEL</h3>
          <p className="text-sm text-muted-foreground">{resultado.esReingreso ? "Es un reingreso: se reutilizó su ficha existente." : "Se creó su ficha de trabajador."}</p>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div><dt className="text-sm text-muted-foreground">Cédula</dt><dd className="font-mono font-semibold">{resultado.cedula}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Puesto asignado</dt><dd className="font-semibold" data-testid="contratacion-puesto">{resultado.puesto.codigo || `N.º ${resultado.puesto.id}`}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Familiares copiados</dt><dd className="font-semibold">{resultado.familiaresCopiados}</dd></div>
      </dl>
      <div className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", TONO[cuenta.tono])} data-testid="contratacion-cuenta">
        <Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0"><p className="font-semibold">{cuenta.titulo}</p><p className="text-pretty text-foreground">{cuenta.detalle}</p></div>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button asChild variant="outline"><Link href={rutaFichaTrabajador(resultado.cedula)}>Ver la ficha del trabajador <ExternalLink aria-hidden /></Link></Button>
        <Button type="button" onClick={onCerrar}>Entendido</Button>
      </div>
    </section>
  );
}
