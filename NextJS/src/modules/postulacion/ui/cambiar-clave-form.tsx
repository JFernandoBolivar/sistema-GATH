"use client";

/**
 * Cambio obligatorio de la contraseña temporal (D-6), con las reglas de la clave nueva en vivo.
 * Al cambiarla, el servidor renueva la sesión con el token nuevo y se pasa al inicio.
 */
import { useId, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AlertCircle, Check, Circle, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputPassword } from "@/shared/ui/components/input-password";
import { cn } from "@/lib/utils";
import { clavesCoinciden, evaluarClaveNueva, LONGITUD_MAXIMA_CLAVE } from "../domain/clave";
import { RUTA_ACCESO_POSTULANTE, RUTA_POSTULACION } from "../domain/acceso-ruta";
import { cambiarClaveAction } from "../infrastructure/actions/postulacion-actions";

interface Valores {
  claveActual: string;
  claveNueva: string;
  confirmacion: string;
}

export function CambiarClaveForm({ cedula }: { cedula: string }) {
  const idReglas = useId();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);

  const form = useForm<Valores>({
    defaultValues: { claveActual: "", claveNueva: "", confirmacion: "" },
  });
  const { register, handleSubmit, control, setError: marcar, formState } = form;
  const [claveActual, claveNueva, confirmacion] = useWatch({
    control,
    name: ["claveActual", "claveNueva", "confirmacion"],
  });

  const evaluacion = evaluarClaveNueva(claveNueva, { cedula, claveActual });
  const coinciden = clavesCoinciden(claveNueva, confirmacion);
  const errorConfirmacion =
    formState.errors.confirmacion?.message ??
    (tocado && confirmacion.length > 0 && !coinciden ? "Las contraseñas no coinciden." : undefined);

  function enviar(valores: Valores) {
    setTocado(true);
    setError(null);
    if (!evaluacion.valida || !coinciden) return;
    iniciar(async () => {
      const r = await cambiarClaveAction(valores);
      if (r.ok) {
        window.location.href = RUTA_POSTULACION;
        return;
      }
      if (r.sesionCaida) {
        window.location.href = `${RUTA_ACCESO_POSTULANTE}?motivo=sesion`;
        return;
      }
      const porCampo: Array<[keyof Valores, string]> = [
        ["claveActual", "clave_actual"],
        ["claveNueva", "clave_nueva"],
        ["confirmacion", "confirmacion"],
      ];
      let marcado = false;
      for (const [campo, clave] of porCampo) {
        const mensaje = r.errores?.[clave]?.[0];
        if (mensaje) {
          marcar(campo, { message: mensaje });
          marcado = true;
        }
      }
      if (!marcado) setError(r.mensaje);
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-balance">Crea tu contraseña personal</h1>
          <p className="mt-2 text-base text-muted-foreground text-pretty">
            La contraseña temporal solo sirve para entrar la primera vez. Elige una que solo tú conozcas.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-5" noValidate>
          <Campo
            id="clave-actual"
            etiqueta="Contraseña temporal"
            ayuda="La que te entregó Captación."
            error={formState.errors.claveActual?.message}
          >
            <InputPassword
              id="clave-actual"
              autoComplete="current-password"
              maxLength={LONGITUD_MAXIMA_CLAVE}
              className="h-12 text-base"
              aria-invalid={!!formState.errors.claveActual}
              aria-describedby="clave-actual-msg"
              {...register("claveActual", { required: "Escribe tu contraseña temporal." })}
            />
          </Campo>

          <Campo
            id="clave-nueva"
            etiqueta="Contraseña nueva"
            error={formState.errors.claveNueva?.message}
          >
            <InputPassword
              id="clave-nueva"
              autoComplete="new-password"
              maxLength={LONGITUD_MAXIMA_CLAVE}
              className="h-12 text-base"
              aria-invalid={!!formState.errors.claveNueva || (tocado && !evaluacion.valida)}
              aria-describedby={`clave-nueva-msg ${idReglas}`}
              {...register("claveNueva", { required: "Escribe tu contraseña nueva." })}
            />
          </Campo>

          <ul
            id={idReglas}
            aria-live="polite"
            aria-label="Reglas de la contraseña nueva"
            className="grid gap-1.5 rounded-lg bg-muted/60 p-3 text-sm"
          >
            {evaluacion.reglas.map((regla) => {
              const estado = claveNueva.length === 0 ? "pendiente" : regla.cumple ? "cumple" : "falta";
              return (
                <li
                  key={regla.id}
                  className={cn(
                    "flex items-center gap-2",
                    estado === "cumple" && "text-emerald-700 dark:text-emerald-400",
                    estado === "falta" && "text-destructive",
                    estado === "pendiente" && "text-muted-foreground",
                  )}
                >
                  {estado === "cumple" ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <Circle className="size-4 shrink-0" aria-hidden />
                  )}
                  <span>{regla.texto}</span>
                  <span className="sr-only">{estado === "cumple" ? "(cumple)" : "(pendiente)"}</span>
                </li>
              );
            })}
          </ul>

          <Campo
            id="confirmacion"
            etiqueta="Repite la contraseña nueva"
            error={errorConfirmacion}
          >
            <InputPassword
              id="confirmacion"
              autoComplete="new-password"
              maxLength={LONGITUD_MAXIMA_CLAVE}
              className="h-12 text-base"
              aria-invalid={!!errorConfirmacion}
              aria-describedby="confirmacion-msg"
              {...register("confirmacion", { required: "Repite la contraseña nueva." })}
            />
          </Campo>

          <Button type="submit" size="lg" disabled={pendiente} className="w-full">
            {pendiente ? "Guardando…" : "Guardar y continuar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && <p className="text-sm text-muted-foreground">{ayuda}</p>}
      <p id={`${id}-msg`} role={error ? "alert" : undefined} className="text-sm text-destructive empty:hidden">
        {error}
      </p>
    </div>
  );
}
