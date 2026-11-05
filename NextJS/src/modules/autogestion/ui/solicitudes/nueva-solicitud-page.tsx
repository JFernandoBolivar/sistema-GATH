"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { PageHeader } from "@/shared/ui/components/page-header";
import { cumpleCondicion } from "@/shared/lib/evaluador-iam";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { SECCIONES_DEF, esSeccionConocida } from "../../domain/value-objects/campos-seccion";
import {
  MOTIVO_MAX_CARACTERES,
  MOTIVO_MIN_MSG,
} from "../../domain/services/validar-motivo";
import {
  listarSeccionesAction,
  solicitarActualizacionAction,
} from "../../infrastructure/actions/solicitudes-actions";
import { SelectorCamposSolicitud } from "./selector-campos-solicitud";
import { solicitudNuevaSchema, type SolicitudNuevaValores } from "../schema/schema-solicitud";

/** «Solicitar actualización»: elegir los campos concretos a actualizar y explicar el motivo. */
export default function NuevaSolicitudPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { data, error, isLoading, mutate } = useSWR("secciones-autogestion", async () => {
    const res = await listarSeccionesAction();
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  const form = useForm<SolicitudNuevaValores>({
    resolver: zodResolver(solicitudNuevaSchema),
    defaultValues: { campos: [], motivo: "" },
  });
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function enviar(valores: SolicitudNuevaValores) {
    const res = await solicitarActualizacionAction(valores);
    if (res.ok) {
      toast.success(res.mensaje);
      router.push("/autogestion/solicitudes");
    } else {
      setError("root", { message: res.mensaje });
      if (res.errores) {
        aplicarErroresServidor(form, res.errores, {
          motivo: "motivo",
          campos: "campos",
        });
      }
    }
  }

  if (status === "authenticated" && !cumpleCondicion("ACTIVO", session?.user?.condicionTrabajador)) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader titulo="Solicitar actualización de datos" />
        <VistaVacia
          titulo="Esta opción no está disponible para su condición"
          descripcion="Solo los trabajadores activos pueden solicitar la actualización de sus datos."
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        titulo="Solicitar actualización de datos"
        descripcion="Elija qué datos necesita actualizar y cuéntenos el motivo. Bienestar Social le habilitará un plazo para cargar los cambios y sus soportes."
      />
      {isLoading ? <VistaCargando mensaje="Cargando los campos disponibles…" onReintentar={() => mutate()} /> : null}
      {error ? (
        <VistaError
          mensaje="No se pudieron cargar las secciones disponibles."
          onReintentar={() => mutate()}
        />
      ) : null}
      {data ? (
        <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-lg font-semibold">¿Qué datos desea actualizar?</legend>
            <p className="text-sm text-muted-foreground">
              Marque los campos que necesita cambiar. En grupo familiar, contactos de emergencia y formaciones, elija si desea agregar, corregir o quitar registros. Su
              correo institucional lo cambia Recursos Humanos, no puede solicitarlo aquí.
            </p>
            <Controller
              control={control}
              name="campos"
              render={({ field }) => (
                <ul className="flex flex-col gap-4">
                  {data
                    .filter((s) => esSeccionConocida(s.codigo))
                    .map((s) => {
                      const def = SECCIONES_DEF[s.codigo as keyof typeof SECCIONES_DEF];
                      return (
                        <SelectorCamposSolicitud
                          key={s.codigo}
                          seccion={def}
                          requiereSoporte={s.requiereSoporte}
                          valor={field.value}
                          onCambio={field.onChange}
                        />
                      );
                    })}
                </ul>
              )}
            />
            {errors.campos ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {errors.campos.message}
              </p>
            ) : null}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivo" className="text-lg font-semibold">
              Motivo de la actualización
            </label>
            <Textarea
              id="motivo"
              rows={4}
              maxLength={MOTIVO_MAX_CARACTERES}
              className="resize-none"
              aria-invalid={errors.motivo ? true : undefined}
              aria-describedby={errors.motivo ? "motivo-error" : undefined}
              {...register("motivo")}
            />
            <p className="text-sm text-muted-foreground">{MOTIVO_MIN_MSG}.</p>
            {errors.motivo ? (
              <p id="motivo-error" className="text-sm font-medium text-danger">
                {errors.motivo.message}
              </p>
            ) : null}
          </div>

          {errors.root ? (
            <p
              role="alert"
              className="rounded-md bg-danger-soft p-3 text-base font-medium text-danger"
            >
              {errors.root.message}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Enviando solicitud…" : "Enviar solicitud"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
