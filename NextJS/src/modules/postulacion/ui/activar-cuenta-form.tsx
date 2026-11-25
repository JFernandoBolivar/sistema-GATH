"use client";

/**
 * Activación del acceso con el enlace del correo (D-10): el postulante confirma su cédula y crea su contraseña.
 * Mismo estilo que el acceso. Los errores del enlace (vencido, usado, bloqueado, inválido) cambian la pantalla a
 * «Pide a Captación un enlace nuevo»; la cédula que no coincide se marca en el campo sin revelar nada más.
 */
import { useId, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, Circle, Clock, KeyRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputPassword } from "@/shared/ui/components/input-password";
import { cn } from "@/lib/utils";
import { esquemaActivacion, reglasDeActivacion, type ValoresActivacion } from "../domain/activacion";
import { LONGITUD_MAXIMA_CLAVE } from "../domain/clave";
import { RUTA_ACCESO_POSTULANTE, RUTA_POSTULACION } from "../domain/acceso-ruta";
import { enlaceAgotado, type CodigoEnlace } from "../domain/errores-enlace";
import { activarCuentaAction } from "../infrastructure/actions/postulacion-actions";
import { EnlaceNoDisponible } from "./enlace-no-disponible";

function fechaLegible(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "America/Caracas",
  }).format(f);
}

export function ActivarCuentaForm({ token, numero, venceEl }: { token: string; numero: string; venceEl: string }) {
  const idReglas = useId();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [agotado, setAgotado] = useState<CodigoEnlace | null>(null);

  const form = useForm<ValoresActivacion>({
    resolver: zodResolver(esquemaActivacion),
    defaultValues: { cedula: "", claveNueva: "", confirmacion: "" },
  });
  const { register, handleSubmit, control, setError, formState } = form;
  const [cedula, claveNueva] = useWatch({ control, name: ["cedula", "claveNueva"] });
  const { reglas } = reglasDeActivacion(claveNueva ?? "", (cedula ?? "").trim());

  if (agotado) return <EnlaceNoDisponible codigo={agotado} />;

  function enviar(valores: ValoresActivacion) {
    setAviso(null);
    iniciar(async () => {
      const r = await activarCuentaAction({ token, ...valores });
      if (r.ok) {
        // Navegación dura: el layout del servidor se dibuja de nuevo con la sesión nueva.
        window.location.href = r.conSesion ? RUTA_POSTULACION : `${RUTA_ACCESO_POSTULANTE}?motivo=creada`;
        return;
      }
      if (enlaceAgotado(r.codigo)) {
        setAgotado(r.codigo);
        return;
      }
      const porCampo: Array<[keyof ValoresActivacion, string]> = [
        ["cedula", "cedula"],
        ["claveNueva", "claveNueva"],
        ["confirmacion", "confirmacion"],
      ];
      let marcado = false;
      for (const [campo, clave] of porCampo) {
        const mensaje = r.errores?.[clave]?.[0];
        if (mensaje) {
          setError(campo, { message: mensaje });
          marcado = true;
        }
      }
      if (r.codigo === "ACTIVACION_DATOS_INCORRECTOS" && !marcado) setError("cedula", { message: r.mensaje });
      setAviso({ titulo: r.titulo, mensaje: r.mensaje });
    });
  }

  const e = formState.errors;
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="size-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-balance">Crea tu contraseña</h1>
          <p className="mt-2 text-base text-muted-foreground text-pretty">
            Captación de CONATEL te invitó a completar tu postulación N.º <strong className="text-foreground">{numero}</strong>.
          </p>
          {fechaLegible(venceEl) ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-4" aria-hidden /> Este enlace vence el {fechaLegible(venceEl)}
            </p>
          ) : null}
        </div>

        {aviso && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle aria-hidden />
            <AlertTitle>{aviso.titulo}</AlertTitle>
            <AlertDescription>{aviso.mensaje}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-5" noValidate>
          <Campo id="activar-cedula" etiqueta="Cédula de identidad" ayuda="Solo números, sin puntos ni letras." error={e.cedula?.message}>
            <Input
              id="activar-cedula"
              inputMode="numeric"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={10}
              placeholder="Ej. 12345678"
              className="h-12 text-base"
              aria-invalid={!!e.cedula}
              aria-describedby="activar-cedula-msg"
              {...register("cedula", { onChange: (ev) => (ev.target.value = ev.target.value.replace(/\D/g, "")) })}
            />
          </Campo>

          <Campo id="activar-clave" etiqueta="Contraseña nueva" error={e.claveNueva?.message}>
            <InputPassword
              id="activar-clave"
              autoComplete="new-password"
              maxLength={LONGITUD_MAXIMA_CLAVE}
              className="h-12 text-base"
              aria-invalid={!!e.claveNueva}
              aria-describedby={`activar-clave-msg ${idReglas}`}
              {...register("claveNueva")}
            />
          </Campo>

          <ul
            id={idReglas}
            aria-live="polite"
            aria-label="Reglas de la contraseña nueva"
            className="grid gap-1.5 rounded-lg bg-muted/60 p-3 text-sm"
          >
            {reglas.map((regla) => {
              const estado = (claveNueva ?? "").length === 0 ? "pendiente" : regla.cumple ? "cumple" : "falta";
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
                  {estado === "cumple" ? <Check className="size-4 shrink-0" aria-hidden /> : <Circle className="size-4 shrink-0" aria-hidden />}
                  <span>{regla.texto}</span>
                  <span className="sr-only">{estado === "cumple" ? "(cumple)" : "(pendiente)"}</span>
                </li>
              );
            })}
          </ul>

          <Campo id="activar-confirmacion" etiqueta="Repite la contraseña nueva" error={e.confirmacion?.message}>
            <InputPassword
              id="activar-confirmacion"
              autoComplete="new-password"
              maxLength={LONGITUD_MAXIMA_CLAVE}
              className="h-12 text-base"
              aria-invalid={!!e.confirmacion}
              aria-describedby="activar-confirmacion-msg"
              {...register("confirmacion")}
            />
          </Campo>

          <Button type="submit" size="lg" disabled={pendiente} className="w-full">
            {pendiente ? "Creando tu contraseña…" : "Crear contraseña y entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Campo({ id, etiqueta, ayuda, error, children }: { id: string; etiqueta: string; ayuda?: string; error?: string; children: React.ReactNode }) {
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
