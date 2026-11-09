"use client";

import { useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/components/alert-dialog";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import type {
  ItemBorrador,
  SeccionAutogestionEntity,
  SeccionCodigo,
  SolicitudDetalleEntity,
} from "../../domain/entities/solicitud-actualizacion";
import { cambiosAItems } from "../../domain/services/borrador";
import { seccionesSinSoporte } from "../../domain/services/reglas-solicitud";
import {
  SECCIONES_DEF,
  esSeccionConocida,
  nombreSeccion,
} from "../../domain/value-objects/campos-seccion";
import {
  agruparTiposSoporte,
  tiposDeSeccion,
} from "../../domain/value-objects/tipos-soporte";
import { getMiExpedienteAction } from "../../infrastructure/actions/autogestion-actions";
import {
  enviarSolicitudAction,
  guardarBorradorAction,
  listarTiposSoporteAction,
} from "../../infrastructure/actions/solicitudes-actions";
import { EditorEntidad } from "./editor-entidad";
import { FotoSeccion, SoportesSeccion } from "./soportes-seccion";
import { useNombresCatalogo } from "./use-nombres-catalogo";

interface Props {
  detalle: SolicitudDetalleEntity;
  secciones: SeccionAutogestionEntity[];
  /** Recarga el detalle tras guardar, subir o enviar. */
  onActualizar: () => void;
}

/** Edición del borrador dentro de la ventana habilitada (o devuelta), solo de los campos habilitados; la ficha real no cambia hasta la aprobación. */
export function EditorBorrador({ detalle, secciones, onActualizar }: Props) {
  const {
    data: ficha,
    error,
    isLoading,
    mutate,
  } = useSWR("mi-expediente-trabajador", () => getMiExpedienteAction());
  const { data: tiposSoporte } = useSWR("tipos-soporte-autogestion", async () => {
    const res = await listarTiposSoporteAction();
    if (!res.ok) throw new Error(res.mensaje);
    return agruparTiposSoporte(res.datos);
  });
  const inicial = useMemo(() => cambiosAItems(detalle.cambios), [detalle.cambios]);
  const [items, setItems] = useState<ItemBorrador[]>(inicial);
  const [guardado, setGuardado] = useState<string>(JSON.stringify(inicial));
  const [versionVista, setVersionVista] = useState(detalle.version);
  const [guardando, iniciarGuardado] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const nombres = useNombresCatalogo(
    items.map((i) => ({ campo: i.campo, valorPropuesto: i.valor })),
  );

  // Si el servidor devuelve una versión nueva (p. ej. tras guardar), el borrador local se alinea con ella.
  if (detalle.version !== versionVista) {
    setVersionVista(detalle.version);
    setItems(inicial);
    setGuardado(JSON.stringify(inicial));
  }

  const sucio = JSON.stringify(items) !== guardado;
  const ordenMap = useMemo(() => {
    return new Map<string, number>(secciones.map((s, i) => [s.codigo, (s as { orden?: number }).orden ?? i]));
  }, [secciones]);

  const habilitadas = useMemo(() => {
    return [...detalle.seccionesHabilitadas]
      .filter(esSeccionConocida)
      .sort((a, b) => (ordenMap.get(a) ?? 99) - (ordenMap.get(b) ?? 99));
  }, [detalle.seccionesHabilitadas, ordenMap]);

  function guardar(): Promise<boolean> {
    return new Promise((resolver) => {
      iniciarGuardado(async () => {
        const res = await guardarBorradorAction(detalle.id, items, detalle.version);
        if (res.ok) {
          setErrores([]);
          setGuardado(JSON.stringify(items));
          setVersionVista(res.datos.version);
          toast.success(res.mensaje);
          onActualizar();
          resolver(true);
        } else {
          const lista = res.errores
            ? Object.entries(res.errores).flatMap(([k, msgs]) => msgs.map((m) => `${k}: ${m}`))
            : [res.mensaje];
          setErrores(lista.length > 0 ? lista : [res.mensaje]);
          resolver(false);
        }
      });
    });
  }

  function intentarEnviar() {
    const hayFoto = detalle.soportes.some((s) => s.seccion === "foto");
    const problemas = seccionesSinSoporte(detalle, secciones).map(
      (c) => `La sección «${nombreSeccion(c)}» exige adjuntar al menos un soporte.`,
    );
    if (items.length === 0 && detalle.cambios.length === 0 && !hayFoto) {
      problemas.unshift("Proponga al menos un cambio antes de enviar la solicitud.");
    }
    if (problemas.length > 0) {
      setErrores(problemas);
      return;
    }
    setErrores([]);
    setConfirmar(true);
  }

  function enviar() {
    setConfirmar(false);
    iniciarEnvio(async () => {
      if (sucio && !(await guardar())) return;
      const res = await enviarSolicitudAction(detalle.id);
      if (res.ok) {
        toast.success(res.mensaje);
        onActualizar();
      } else {
        const lista = res.errores
          ? Object.entries(res.errores).flatMap(([k, msgs]) => msgs.map((m) => `${k}: ${m}`))
          : [res.mensaje];
        setErrores(lista.length > 0 ? lista : [res.mensaje]);
      }
    });
  }

  if (isLoading) return <VistaCargando mensaje="Cargando sus datos actuales…" onReintentar={() => mutate()} />;
  if (error || !ficha) {
    return (
      <VistaError
        mensaje="No se pudieron cargar sus datos actuales."
        onReintentar={() => mutate()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-28 sm:pb-8">
      {habilitadas.map((codigo: SeccionCodigo) => {
        const def = SECCIONES_DEF[codigo];
        const tipos = tiposDeSeccion(tiposSoporte, codigo);
        const requiereSoporte =
          secciones.find((s) => s.codigo === codigo)?.requiereSoporte ?? false;
        return (
          <section
            key={codigo}
            aria-labelledby={`seccion-${codigo}`}
            className="flex flex-col gap-4"
          >
            <div>
              <h2 id={`seccion-${codigo}`} className="text-xl font-bold">
                {def.nombre}
              </h2>
              <p className="text-base text-muted-foreground">{def.descripcion}</p>
            </div>
            {codigo === "foto" ? (
              <FotoSeccion
                solicitudId={detalle.id}
                soportes={detalle.soportes}
                onCambio={onActualizar}
              />
            ) : (
              <>
                {def.entidades.map((entidad) => (
                  <EditorEntidad
                    key={`${codigo}-${entidad.entidad}`}
                    seccion={codigo}
                    definicion={entidad}
                    ficha={ficha}
                    items={items}
                    nombres={nombres}
                    camposHabilitados={detalle.camposHabilitados}
                    onItems={setItems}
                    solicitudId={detalle.id}
                    soportes={detalle.soportes}
                    tiposSoporte={tipos}
                    onCambioSoportes={onActualizar}
                  />
                ))}
                {tipos.length > 0 ? (
                  <SoportesSeccion
                    solicitudId={detalle.id}
                    seccion={codigo}
                    soportes={detalle.soportes}
                    obligatorio={requiereSoporte}
                    tipos={tipos}
                    onCambio={onActualizar}
                  />
                ) : null}
              </>
            )}
          </section>
        );
      })}

      {errores.length > 0 ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-danger"
        >
          <p className="font-semibold">Revise antes de continuar:</p>
          <ul className="mt-1 list-disc pl-5">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="sticky bottom-2 z-30 flex flex-col gap-2 rounded-lg border bg-card/95 backdrop-blur-xs p-2.5 shadow-md sm:bottom-4 sm:flex-row sm:items-center sm:gap-3 sm:p-3">
        <div className="flex w-full min-w-0 flex-row items-stretch gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal py-2 sm:flex-initial"
            onClick={() => void guardar()}
            disabled={guardando || enviando || !sucio}
          >
            <Save aria-hidden className="size-4 shrink-0" />{" "}
            <span className="min-w-0 leading-tight">
              {guardando ? "Guardando…" : sucio ? "Guardar borrador" : "Borrador guardado"}
            </span>
          </Button>
          <Button
            type="button"
            size="default"
            className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal py-2 sm:flex-initial"
            onClick={intentarEnviar}
            disabled={guardando || enviando}
          >
            <Send aria-hidden className="size-4 shrink-0" />{" "}
            <span className="min-w-0 leading-tight">
              {enviando ? "Enviando…" : "Enviar a Bienestar Social"}
            </span>
          </Button>
        </div>
        {sucio ? (
          <p className="text-center text-xs text-warning sm:text-left sm:text-sm">
            Tiene cambios sin guardar.
          </p>
        ) : null}
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar su solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Al enviarla se cierra el plazo de edición y Bienestar Social revisará cada campo. No
              podrá cambiar los datos después de enviarlos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={enviar}>Sí, enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
