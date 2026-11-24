"use client";

import { useState, useTransition } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_OBSERVACIONES,
  MAX_REFERENCIA,
  validarConstancia,
  type Constancia,
  type DatosConstancia,
  type ResultadoAccion,
} from "../../domain/solicitud";
import { ConstanciaDeclarada } from "./seccion-constancia-lectura";

interface Props {
  constancia: Constancia | null;
  puedeDeclarar: boolean;
  onDeclarar: (formData: FormData) => Promise<ResultadoAccion<unknown>>;
  onDescargar: () => Promise<ResultadoAccion<{ base64: string; nombre: string }>>;
  onAviso: (tipo: "exito" | "error", mensaje: string) => void;
}

const VACIO: DatosConstancia = { referencia: "", observaciones: "", adjunto: null };

/** Sección «Disponibilidad presupuestaria»: la constancia declarada y el formulario para declararla o corregirla. */
export function SeccionDisponibilidad({ constancia, puedeDeclarar, onDeclarar, onDescargar, onAviso }: Props) {
  const [v, setV] = useState<DatosConstancia>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [clave, setClave] = useState(0);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    const e = validarConstancia(v);
    setErrores(e);
    setErrorServidor(null);
    if (Object.keys(e).length > 0) return;
    const form = new FormData();
    form.set("referencia", v.referencia.trim());
    if (v.observaciones.trim()) form.set("observaciones", v.observaciones.trim());
    if (v.adjunto) form.set("adjunto", v.adjunto);
    iniciar(async () => {
      const r = await onDeclarar(form);
      if (!r.ok) {
        setErrorServidor(r.error);
        return;
      }
      setV(VACIO);
      setClave((k) => k + 1);
      onAviso("exito", "Disponibilidad presupuestaria declarada.");
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="titulo-disponibilidad">
      <h3 id="titulo-disponibilidad" className="flex items-center gap-2 text-lg font-semibold">
        <Wallet className="size-5 text-primary" aria-hidden /> Disponibilidad presupuestaria
      </h3>

      {constancia ? (
        <ConstanciaDeclarada constancia={constancia} onDescargar={onDescargar} onAviso={onAviso} />
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="sin-constancia">
          Aún no se ha declarado la disponibilidad presupuestaria.
        </p>
      )}

      {puedeDeclarar ? (
        <form
          className="flex flex-col gap-4 border-t pt-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <h4 className="font-semibold">{constancia ? "Corregir la constancia" : "Declarar la disponibilidad"}</h4>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="constancia-referencia">Referencia (partida u oficio) *</Label>
            <Input
              id="constancia-referencia"
              value={v.referencia}
              maxLength={MAX_REFERENCIA}
              onChange={(e) => setV((p) => ({ ...p, referencia: e.target.value }))}
              aria-invalid={Boolean(errores.referencia)}
              aria-describedby={errores.referencia ? "error-referencia" : undefined}
              placeholder="Ej.: Partida 4.01.01 · Oficio PRES-2026-0123"
            />
            {errores.referencia ? <p id="error-referencia" className="text-sm text-danger">{errores.referencia}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="constancia-observaciones">Observaciones (opcional)</Label>
            <Textarea
              id="constancia-observaciones"
              value={v.observaciones}
              maxLength={MAX_OBSERVACIONES}
              onChange={(e) => setV((p) => ({ ...p, observaciones: e.target.value }))}
              className="h-24"
              aria-invalid={Boolean(errores.observaciones)}
            />
            {errores.observaciones ? <p className="text-sm text-danger">{errores.observaciones}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="constancia-adjunto">Constancia en PDF (opcional, hasta 10 MB)</Label>
            <Input
              key={clave}
              id="constancia-adjunto"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setV((p) => ({ ...p, adjunto: e.target.files?.[0] ?? null }))}
              aria-invalid={Boolean(errores.adjunto)}
              aria-describedby={errores.adjunto ? "error-adjunto" : undefined}
            />
            {errores.adjunto ? <p id="error-adjunto" className="text-sm text-danger">{errores.adjunto}</p> : null}
            {constancia?.tieneAdjunto ? <p className="text-xs text-muted-foreground">Si no adjunta otro, se conserva el PDF anterior.</p> : null}
          </div>
          {errorServidor ? (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{errorServidor}</p>
          ) : null}
          <Button type="submit" disabled={pendiente} className="w-full sm:w-fit">
            {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {constancia ? "Guardar corrección" : "Declarar disponibilidad"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
