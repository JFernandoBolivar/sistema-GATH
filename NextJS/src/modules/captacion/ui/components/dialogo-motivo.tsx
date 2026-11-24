"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITES_TEXTO } from "@/shared/domain/validation/limites-texto";

interface Props {
  titulo: string;
  descripcion?: string;
  etiquetaConfirmar: string;
  peligro?: boolean;
  pendiente?: boolean;
  error?: string | null;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
  /** Contenido extra bajo el motivo (p. ej. cómo se entrega el acceso). */
  children?: React.ReactNode;
}

/** Diálogo con motivo obligatorio (devolver, rechazar, observar faltantes…). Se monta solo mientras está abierto. */
export function DialogoMotivo({
  titulo,
  descripcion,
  etiquetaConfirmar,
  peligro = false,
  pendiente = false,
  error,
  onConfirmar,
  onCancelar,
  children,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [tocado, setTocado] = useState(false);
  const limpio = motivo.trim();
  const invalido = limpio.length < LIMITES_TEXTO.motivo.min;

  function confirmar() {
    setTocado(true);
    if (!invalido) onConfirmar(limpio);
  }

  return (
    <Dialog open onOpenChange={(a) => (!a && !pendiente ? onCancelar() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo-transicion">Motivo *</Label>
          <Textarea
            id="motivo-transicion"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setTocado(true)}
            maxLength={LIMITES_TEXTO.motivo.max}
            placeholder="Explique el motivo con claridad: el postulante o el equipo lo leerán."
            aria-invalid={tocado && invalido}
            aria-describedby="motivo-ayuda"
            className="h-32"
          />
          <p id="motivo-ayuda" className={tocado && invalido ? "text-sm text-danger" : "text-sm text-muted-foreground"}>
            {tocado && invalido
              ? `El motivo es obligatorio (mínimo ${LIMITES_TEXTO.motivo.min} caracteres).`
              : `Obligatorio, mínimo ${LIMITES_TEXTO.motivo.min} caracteres.`}
          </p>
        </div>
        {children}
        {error ? (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancelar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="button" variant={peligro ? "destructive" : "default"} onClick={confirmar} disabled={pendiente}>
            {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {etiquetaConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
