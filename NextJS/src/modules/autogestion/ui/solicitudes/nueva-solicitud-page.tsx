"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { PageHeader } from "@/shared/ui/components/page-header";
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
import { usePoliticaAutogestion } from "./use-politica-autogestion";
import { solicitudNuevaSchema, type SolicitudNuevaValores } from "../schema/schema-solicitud";
import { useGuia } from "@/shared/ui/guias";
import { GUIA_NUEVA_SOLICITUD } from "../guias/definiciones-guias";
import { useRegistrarGuia } from "../guias/contexto-guia";

/** «Solicitar actualización»: elegir los campos concretos a actualizar y explicar el motivo. */
export default function NuevaSolicitudPage() {
  const router = useRouter();
  const { politica, isLoading: cargandoPolitica } = usePoliticaAutogestion();
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

  const { iniciarGuia } = useGuia({
    guia: GUIA_NUEVA_SOLICITUD,
    autoIniciar: true,
  });
  useRegistrarGuia(iniciarGuia);

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

  if (!cargandoPolitica && politica && !politica.habilitado) {
    return (
      <div className="flex w-full flex-col gap-6">
        <PageHeader titulo="Solicitar actualización de datos" />
        <VistaVacia
          titulo="Las solicitudes no están habilitadas para su condición"
          descripcion="Bienestar Social todavía no habilitó la actualización de datos para su condición. Si ya tiene una solicitud en curso, puede continuarla desde «Mis solicitudes»."
        />
      </div>
    );
  }

  const permitidas = new Set(politica?.secciones ?? []);
  const seccionesDisponibles = (data ?? []).filter(
    (s) => esSeccionConocida(s.codigo) && (permitidas.size === 0 || permitidas.has(s.codigo)),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        titulo="Solicitar actualización de datos"
        descripcion="Elija qué datos necesita actualizar y cuéntenos el motivo. Bienestar Social le habilitará un plazo para cargar los cambios y sus soportes."
      />
      {isLoading || cargandoPolitica ? (
        <VistaCargando mensaje="Cargando los campos disponibles…" onReintentar={() => mutate()} />
      ) : null}
      {error ? (
        <VistaError
          mensaje="No se pudieron cargar las secciones disponibles."
          onReintentar={() => mutate()}
        />
      ) : null}
      {data ? (
        <form onSubmit={handleSubmit(enviar)} noValidate className="flex w-full flex-col gap-6">
          <fieldset data-guia-id="solicitud-selector-campos" className="flex flex-col gap-3">
            <legend className="text-lg font-semibold">¿Qué datos desea actualizar?</legend>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Marque los campos que necesita cambiar. En grupo familiar, contactos de emergencia y formaciones, elija si desea agregar, corregir o quitar registros. Su
              correo institucional lo cambia Recursos Humanos, no puede solicitarlo aquí.
            </p>
            <Controller
              control={control}
              name="campos"
              render={({ field }) => (
                <ul className="grid gap-4 lg:grid-cols-2">
                  {seccionesDisponibles.map((s) => {
                      const def = SECCIONES_DEF[s.codigo as keyof typeof SECCIONES_DEF];
                      return (
                        <SelectorCamposSolicitud
                          key={s.codigo}
                          seccion={def}
                          requiereSoporte={s.requiereSoporte}
                          valor={field.value}
                          onCambio={field.onChange}
                          bloqueos={politica?.bloqueos ?? []}
                          esperas={politica?.esperas ?? []}
                          alcance={politica?.bloqueo_alcance ?? "registro"}
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

          <div data-guia-id="solicitud-motivo" className="flex max-w-3xl flex-col gap-1.5">
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

          <Button
            data-guia-id="solicitud-boton-enviar"
            type="submit"
            size="lg"
            className="w-full sm:w-fit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando solicitud…" : "Enviar solicitud"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
