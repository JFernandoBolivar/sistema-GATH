"use client";

/**
 * Bloque principal del egreso de pasivo: buscar por cédula y mostrar el pasivo
 * elegido en una tarjeta resumen con la opción «Cambiar». Es de presentación:
 * la consulta la hace la pantalla que lo usa.
 */
import { useId, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeftRight, Loader2, Search, UserSearch } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

export interface PasivoSeleccionado {
  nombreCompleto: string;
  cedula: string;
  tipoPasivo?: string | null;
}

interface SelectorPasivoProps {
  pasivo: PasivoSeleccionado | null;
  buscando: boolean;
  /** Mensaje de «sin resultados» o de fallo de la consulta. */
  error: string | null;
  onBuscar: (cedula: string) => void;
  onCambiar: () => void;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function SelectorPasivo({ pasivo, buscando, error, onBuscar, onCambiar }: SelectorPasivoProps) {
  const [texto, setTexto] = useState("");
  const inputId = useId();
  const ayudaId = `${inputId}-ayuda`;
  const errorId = `${inputId}-error`;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (limpio && !buscando) onBuscar(limpio);
  };

  if (pasivo) {
    return (
      <section aria-label="Pasivo seleccionado" className="rounded-xl border bg-muted/30 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
          >
            {iniciales(pasivo.nombreCompleto)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pasivo seleccionado</p>
            <p className="break-words text-lg font-semibold leading-tight">{pasivo.nombreCompleto}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                C.I. <span className="font-medium text-foreground">{pasivo.cedula}</span>
              </span>
              {pasivo.tipoPasivo ? <Badge variant="secondary">{pasivo.tipoPasivo}</Badge> : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTexto("");
              onCambiar();
            }}
            className="w-full sm:w-auto"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Cambiar
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Buscar pasivo" className="rounded-xl border bg-muted/30 p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <UserSearch className="size-5" />
        </span>
        <div className="min-w-0">
          <Label htmlFor={inputId} className="text-base font-semibold">
            Pasivo a egresar
          </Label>
          <p id={ayudaId} className="text-sm text-muted-foreground">
            Escriba la cédula del jubilado o pensionado para cargar sus datos y registrar el egreso.
          </p>
        </div>
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Cédula, p. ej. 12345678"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={buscando}
            aria-describedby={error ? `${ayudaId} ${errorId}` : ayudaId}
            aria-invalid={error ? true : undefined}
            className="h-11 bg-background pl-9"
          />
        </div>
        <Button type="submit" disabled={buscando || !texto.trim()} className="h-11 sm:min-w-32">
          {buscando ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
          {buscando ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      <div aria-live="polite" className="min-h-5">
        {error ? (
          <p id={errorId} role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default SelectorPasivo;
