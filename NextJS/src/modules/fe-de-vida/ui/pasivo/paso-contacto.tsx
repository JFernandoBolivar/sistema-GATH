"use client";

import { useEffect, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  Calendar,
  Contact2,
  IdCard,
  Loader2,
  Mail,
  Phone,
  Smartphone,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import type { MiExpedienteDTO } from "@/modules/autogestion/application/dtos/mi-expediente-dto";
import { oficinaDeAdscripcion } from "../../domain/services/reglas";
import { datosContactoSchema, type DatosContactoValores } from "../schema/schema-fe-de-vida";

interface Props {
  ficha: MiExpedienteDTO;
  valoresIniciales: Partial<Omit<DatosContactoValores, "tieneHijos">> & {
    tieneHijos?: "si" | "no" | "";
  };
  erroresServidor?: Record<string, string[]>;
  guardando: boolean;
  onContinuar: (valores: DatosContactoValores) => void;
}

function DatoSoloLectura({
  etiqueta,
  valor,
  icono,
}: {
  etiqueta: string;
  valor: string | null | undefined;
  icono?: ReactNode;
}) {
  return (
    <div className="rounded-md bg-muted p-3">
      <dt className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {icono ? <span className="size-4 shrink-0 text-muted-foreground" aria-hidden>{icono}</span> : null}
        <span>{etiqueta}</span>
      </dt>
      <dd className="mt-1 break-words text-base font-medium text-foreground">{valor || "Sin dato"}</dd>
    </div>
  );
}

/** Paso 1: datos personales (solo lectura), contacto editable, correo alternativo y «¿tiene hijos?». */
export function PasoContacto({ ficha, valoresIniciales, erroresServidor, guardando, onContinuar }: Props) {
  const e = ficha.empleado;
  const asignacion = e.asignaciones?.[0];

  const form = useForm<DatosContactoValores>({
    resolver: zodResolver(datosContactoSchema),
    defaultValues: {
      telefonoMovil: valoresIniciales.telefonoMovil ?? "",
      telefonoHabitacion: valoresIniciales.telefonoHabitacion ?? "",
      correoAlternativo: valoresIniciales.correoAlternativo ?? "",
      tieneHijos: (valoresIniciales.tieneHijos || undefined) as "si" | "no" | undefined,
    },
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (erroresServidor) {
      aplicarErroresServidor(form, erroresServidor, {
        telefono_movil: "telefonoMovil",
        telefono_habitacion: "telefonoHabitacion",
        correo_alternativo: "correoAlternativo",
        tiene_hijos: "tieneHijos",
      });
    }
  }, [erroresServidor, form]);

  return (
    <form onSubmit={handleSubmit(onContinuar)} noValidate className="flex flex-col gap-6">
      <section aria-labelledby="datos-fijos" className="flex flex-col gap-3">
        <h2 id="datos-fijos" className="text-xl font-semibold flex items-center gap-2">
          <User className="size-5 text-primary" aria-hidden />
          Sus datos registrados
        </h2>
        <p className="text-base text-muted-foreground">
          Estos datos no se pueden cambiar aquí. Si alguno es incorrecto, avise a Bienestar Social.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <DatoSoloLectura etiqueta="Cédula" valor={e.cedula} icono={<IdCard className="size-4" />} />
          <DatoSoloLectura etiqueta="Nombres y apellidos" valor={e.nombre_completo} icono={<User className="size-4" />} />
          <DatoSoloLectura etiqueta="Fecha de nacimiento" valor={e.fecha_nacimiento} icono={<Calendar className="size-4" />} />
          <DatoSoloLectura etiqueta="Correo principal (para ingresar)" valor={e.correo} icono={<Mail className="size-4" />} />
          <DatoSoloLectura
            etiqueta="Tipo de pensión o jubilación"
            valor={asignacion?.tipo_nomina}
            icono={<Award className="size-4" />}
          />
          <DatoSoloLectura etiqueta="Cargo" valor={asignacion?.denominacion_cargo} icono={<Briefcase className="size-4" />} />
          <DatoSoloLectura
            etiqueta="Oficina de adscripción"
            valor={oficinaDeAdscripcion(asignacion)}
            icono={<Building2 className="size-4" />}
          />
        </dl>
      </section>

      <section aria-labelledby="datos-contacto" className="flex flex-col gap-4">
        <h2 id="datos-contacto" className="text-xl font-semibold flex items-center gap-2">
          <Contact2 className="size-5 text-primary" aria-hidden />
          Contacto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fv-movil" className="text-base font-medium flex items-center gap-1.5">
              <Smartphone className="size-4 text-primary" aria-hidden />
              <span>Teléfono celular <span aria-hidden>*</span></span>
            </label>
            <Controller
              control={control}
              name="telefonoMovil"
              render={({ field }) => (
                <CampoTelefono
                  tipo="movil"
                  id="fv-movil"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalido={Boolean(errors.telefonoMovil)}
                  aria-describedby={errors.telefonoMovil ? "fv-movil-error" : "fv-movil-ayuda"}
                />
              )}
            />
            <p id="fv-movil-ayuda" className="text-xs text-muted-foreground">
              Ejemplo: 0412-1234567, 0414-9876543 o 0416-5551234 (11 dígitos).
            </p>
            {errors.telefonoMovil ? (
              <p id="fv-movil-error" role="alert" className="text-sm font-medium text-danger">
                {errors.telefonoMovil.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fv-habitacion" className="text-base font-medium flex items-center gap-1.5">
              <Phone className="size-4 text-primary" aria-hidden />
              <span>Teléfono de habitación</span>
            </label>
            <Controller
              control={control}
              name="telefonoHabitacion"
              render={({ field }) => (
                <CampoTelefono
                  id="fv-habitacion"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalido={Boolean(errors.telefonoHabitacion)}
                  aria-describedby={errors.telefonoHabitacion ? "fv-habitacion-error" : "fv-habitacion-ayuda"}
                />
              )}
            />
            <p id="fv-habitacion-ayuda" className="text-xs text-muted-foreground">
              Ejemplo: 0212-5551234 o 0241-8765432 (con código de área).
            </p>
            {errors.telefonoHabitacion ? (
              <p id="fv-habitacion-error" role="alert" className="text-sm font-medium text-danger">
                {errors.telefonoHabitacion.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fv-correo-alt" className="text-base font-medium flex items-center gap-1.5">
            <Mail className="size-4 text-primary" aria-hidden />
            <span>Correo alternativo (personal o de emergencia)</span>
          </label>
          <Input
            id="fv-correo-alt"
            type="email"
            autoComplete="email"
            placeholder="ejemplo@correo.com"
            aria-invalid={errors.correoAlternativo ? true : undefined}
            aria-describedby={errors.correoAlternativo ? "fv-correo-error" : "fv-correo-ayuda"}
            {...register("correoAlternativo")}
          />
          <p id="fv-correo-ayuda" className="text-xs text-muted-foreground">
            Ejemplo: minombre@gmail.com. Recibirá en este correo un duplicado de su constancia.
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
        aria-describedby={errors.tieneHijos ? "fv-hijos-error" : "fv-hijos-ayuda"}
      >
        <legend className="text-xl font-semibold flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden />
          ¿Tiene hijos?
        </legend>
        <p id="fv-hijos-ayuda" className="text-sm text-muted-foreground">
          Indique «Sí» si tiene hijos (menores de edad o dependientes) para verificar o registrar sus datos.
        </p>
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
          {guardando ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {guardando ? "Guardando…" : "Continuar"} <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
