"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { describirContacto } from "../../domain/contacto";

interface Props {
  contacto: { contactoPendiente: boolean; contactoPendienteDesde: string | null; contactoAtrasado: boolean };
  ahora: Date;
  pendiente?: boolean;
  error?: string | null;
  onRegistrar: (nota: string) => void;
  onCerrarError: () => void;
}

/** Aviso de «contactar al postulante»: antigüedad, atraso y «Ya lo contacté» con nota opcional. */
export function BannerContacto({ contacto, ahora, pendiente = false, error, onRegistrar, onCerrarError }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const e = describirContacto(contacto, ahora);
  if (!e.pendiente) return null;
  return (
    <>
      <div
        role="note"
        data-testid="banner-contacto"
        data-atrasado={e.atrasado ? "true" : "false"}
        className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between", e.atrasado ? "border-danger/40 bg-danger-soft" : "border-warning/40 bg-warning-soft")}
      >
        <div className="flex min-w-0 items-start gap-3">
          {e.atrasado ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden /> : <PhoneCall className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
          <div className="min-w-0">
            <p className="font-semibold">Hay que contactar al postulante</p>
            <p className="text-sm text-pretty">{e.texto} Avísele que ya puede completar sus datos complementarios y entréguele su contraseña temporal.</p>
          </div>
        </div>
        <Button type="button" onClick={() => setAbierto(true)} className="w-full shrink-0 sm:w-auto">
          <PhoneCall aria-hidden /> Ya lo contacté
        </Button>
      </div>
      <Dialog open={abierto} onOpenChange={(a) => (!a && !pendiente ? (setAbierto(false), onCerrarError()) : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar el contacto</DialogTitle>
            <DialogDescription>Quedará en el historial del expediente y se cerrará el aviso para todo el equipo.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nota-contacto">Nota (opcional)</Label>
            <Textarea id="nota-contacto" value={nota} onChange={(ev) => setNota(ev.target.value)} maxLength={500} placeholder="Ej. Llamé por teléfono y quedó en ingresar hoy." className="h-28" />
          </div>
          {error && <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => { setAbierto(false); onCerrarError(); }} disabled={pendiente}>Cancelar</Button>
            <Button type="button" onClick={() => onRegistrar(nota)} disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" aria-hidden />} Confirmar contacto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
