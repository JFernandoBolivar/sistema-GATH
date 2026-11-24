"use client";

import { useId } from "react";
import { AlertTriangle, Mail, UserRound } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  correoUtilizable,
  ENTREGA_CORREO,
  ENTREGA_PERSONA,
  RECORDATORIO_CORREO,
  type TipoEntrega,
} from "../../domain/entrega";

interface Props {
  valor: TipoEntrega;
  onCambio: (valor: TipoEntrega) => void;
  /** Correo registrado del postulante (o el que se está escribiendo en el alta). */
  correo: string | null | undefined;
  /** Texto de la ayuda cuando no hay correo (cambia entre el alta y el detalle). */
  ayudaSinCorreo?: string;
  disabled?: boolean;
}

/**
 * Cómo se entrega el acceso: «en persona» (contraseña temporal) o «por correo» (enlace de activación).
 * Tarjetas tipo radio con el patrón `RadioGroupItem id` + `Label htmlFor` HERMANA y el radio con `relative z-10`:
 * los radios anidados dentro de un label no cambiaban el valor con el tacto en el teléfono.
 */
export function SelectorEntrega({
  valor,
  onCambio,
  correo,
  ayudaSinCorreo = "Esta persona no tiene un correo registrado. Regístrelo para poder enviarle el enlace.",
  disabled = false,
}: Props) {
  const base = useId();
  const idPersona = `${base}-persona`;
  const idCorreo = `${base}-correo`;
  const idTitulo = `${base}-titulo`;
  const hayCorreo = correoUtilizable(correo);
  const correoLimpio = (correo ?? "").trim();
  const elegido = hayCorreo || valor !== ENTREGA_CORREO ? valor : ENTREGA_PERSONA;

  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0" data-testid="selector-entrega">
      <legend id={idTitulo} className="mb-1 text-sm font-medium">
        ¿Cómo entregará el acceso al postulante?
      </legend>
      <RadioGroup
        value={elegido}
        onValueChange={(v) => onCambio(v as TipoEntrega)}
        aria-labelledby={idTitulo}
        disabled={disabled}
        className="grid gap-3 sm:grid-cols-2"
      >
        <div
          className={cn(
            "relative flex min-h-11 items-start gap-3 rounded-lg border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            elegido === ENTREGA_PERSONA && "border-primary bg-primary/5",
          )}
        >
          <RadioGroupItem id={idPersona} value={ENTREGA_PERSONA} className="relative z-10 mt-1" />
          <Label htmlFor={idPersona} className="flex-1 cursor-pointer flex-col items-start gap-1 text-base font-medium after:absolute after:inset-0">
            <span className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" aria-hidden /> Entregar en persona
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              Verá una contraseña temporal, una sola vez, para dársela a la persona.
            </span>
          </Label>
        </div>

        <div
          className={cn(
            "relative flex min-h-11 items-start gap-3 rounded-lg border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            elegido === ENTREGA_CORREO && "border-primary bg-primary/5",
            !hayCorreo && "opacity-70",
          )}
        >
          <RadioGroupItem id={idCorreo} value={ENTREGA_CORREO} disabled={!hayCorreo || disabled} className="relative z-10 mt-1" />
          <Label
            htmlFor={idCorreo}
            className={cn(
              "flex-1 flex-col items-start gap-1 text-base font-medium after:absolute after:inset-0",
              hayCorreo ? "cursor-pointer" : "cursor-not-allowed",
            )}
          >
            <span className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" aria-hidden /> Enviar enlace por correo
            </span>
            {hayCorreo ? (
              <span className="text-sm font-normal text-muted-foreground">
                El correo no lleva contraseña: la persona crea la suya con el enlace.
              </span>
            ) : (
              <span className="text-sm font-normal text-muted-foreground" data-testid="entrega-sin-correo">
                {ayudaSinCorreo}
              </span>
            )}
          </Label>
        </div>
      </RadioGroup>

      {hayCorreo ? (
        <div
          role={elegido === ENTREGA_CORREO ? "note" : undefined}
          data-testid="entrega-correo-destino"
          className={cn(
            "flex items-start gap-2 rounded-md border p-3 text-sm",
            elegido === ENTREGA_CORREO ? "border-warning/50 bg-warning-soft text-foreground" : "bg-muted/40 text-muted-foreground",
          )}
        >
          <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", elegido === ENTREGA_CORREO && "text-warning")} aria-hidden />
          <p className="min-w-0">
            Correo de destino: <strong className="break-all text-foreground">{correoLimpio}</strong>.{" "}
            <strong className="text-foreground">{RECORDATORIO_CORREO}.</strong>
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
