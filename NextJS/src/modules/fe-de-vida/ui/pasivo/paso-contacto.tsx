"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MiExpedienteDTO } from "@/modules/autogestion/application/dtos/mi-expediente-dto";
import { oficinaDeAdscripcion } from "../../domain/services/reglas";
import { datosContactoSchema, type DatosContactoValores } from "../schema/schema-fe-de-vida";

interface Props {
  ficha: MiExpedienteDTO;
  valoresIniciales: Partial<Omit<DatosContactoValores, "tieneHijos">> & {
    tieneHijos?: "si" | "no" | "";
  };
  guardando: boolean;
  onContinuar: (valores: DatosContactoValores) => void;
}

function DatoSoloLectura({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null | undefined;
}) {
  return (
    <div className="rounded-md bg-muted p-3">
      <dt className="text-sm font-medium text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-1 break-words text-base">{valor || "Sin dato"}</dd>
    </div>
  );
}

/** Paso 1: datos personales (solo lectura), contacto editable, correo alternativo y «¿tiene hijos?». */
export function PasoContacto({ ficha, valoresIniciales, guardando, onContinuar }: Props) {
  const e = ficha.empleado;
  const asignacion = e.asignaciones?.[0];
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosContactoValores>({
    resolver: zodResolver(datosContactoSchema),
    defaultValues: {
      telefonoMovil: valoresIniciales.telefonoMovil ?? "",
      telefonoHabitacion: valoresIniciales.telefonoHabitacion ?? "",
      correoAlternativo: valoresIniciales.correoAlternativo ?? "",
      tieneHijos: (valoresIniciales.tieneHijos || undefined) as "si" | "no" | undefined,
    },
  });

  return (
    <form onSubmit={handleSubmit(onContinuar)} noValidate className="flex flex-col gap-6">
      <section aria-labelledby="datos-fijos" className="flex flex-col gap-3">
        <h2 id="datos-fijos" className="text-xl font-semibold">
          Sus datos registrados
        </h2>
        <p className="text-base text-muted-foreground">
          Estos datos no se pueden cambiar aquí. Si alguno es incorrecto, avise a Bienestar Social.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <DatoSoloLectura etiqueta="Cédula" valor={e.cedula} />
          <DatoSoloLectura etiqueta="Nombres y apellidos" valor={e.nombre_completo} />
          <DatoSoloLectura etiqueta="Fecha de nacimiento" valor={e.fecha_nacimiento} />
          <DatoSoloLectura etiqueta="Correo principal (para ingresar)" valor={e.correo} />
          <DatoSoloLectura
            etiqueta="Tipo de pensión o jubilación"
            valor={asignacion?.tipo_nomina}
          />
          <DatoSoloLectura etiqueta="Cargo" valor={asignacion?.denominacion_cargo} />
          <DatoSoloLectura
            etiqueta="Oficina de adscripción"
            valor={oficinaDeAdscripcion(asignacion)}
          />
        </dl>
      </section>

      <section aria-labelledby="datos-contacto" className="flex flex-col gap-4">
        <h2 id="datos-contacto" className="text-xl font-semibold">
          Contacto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fv-movil" className="text-base font-medium">
              Teléfono celular
            </label>
            <Input
              id="fv-movil"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={errors.telefonoMovil ? true : undefined}
              aria-describedby={errors.telefonoMovil ? "fv-movil-error" : undefined}
              {...register("telefonoMovil")}
            />
            {errors.telefonoMovil ? (
              <p id="fv-movil-error" role="alert" className="text-sm font-medium text-danger">
                {errors.telefonoMovil.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fv-habitacion" className="text-base font-medium">
              Teléfono de habitación
            </label>
            <Input
              id="fv-habitacion"
              inputMode="tel"
              aria-invalid={errors.telefonoHabitacion ? true : undefined}
              aria-describedby={errors.telefonoHabitacion ? "fv-habitacion-error" : undefined}
              {...register("telefonoHabitacion")}
            />
            {errors.telefonoHabitacion ? (
              <p id="fv-habitacion-error" role="alert" className="text-sm font-medium text-danger">
                {errors.telefonoHabitacion.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fv-correo-alt" className="text-base font-medium">
            Correo alternativo (personal o de emergencia)
          </label>
          <Input
            id="fv-correo-alt"
            type="email"
            autoComplete="email"
            aria-invalid={errors.correoAlternativo ? true : undefined}
            aria-describedby={errors.correoAlternativo ? "fv-correo-error" : "fv-correo-ayuda"}
            {...register("correoAlternativo")}
          />
          <p id="fv-correo-ayuda" className="text-sm text-muted-foreground">
            También recibirá en este correo una copia de su constancia.
          </p>
          {errors.correoAlternativo ? (
            <p id="fv-correo-error" role="alert" className="text-sm font-medium text-danger">
              {errors.correoAlternativo.message}
            </p>
          ) : null}
        </div>
      </section>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={errors.tieneHijos ? "fv-hijos-error" : undefined}
      >
        <legend className="text-xl font-semibold">¿Tiene hijos?</legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["si", "Sí, tengo hijos"],
              ["no", "No tengo hijos"],
            ] as const
          ).map(([valor, texto]) => (
            <label
              key={valor}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-base"
            >
              <input type="radio" value={valor} className="size-5" {...register("tieneHijos")} />
              {texto}
            </label>
          ))}
        </div>
        {errors.tieneHijos ? (
          <p id="fv-hijos-error" role="alert" className="text-sm font-medium text-danger">
            {errors.tieneHijos.message}
          </p>
        ) : null}
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" className="min-h-11" disabled={guardando}>
          {guardando ? "Guardando…" : "Continuar"} <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
