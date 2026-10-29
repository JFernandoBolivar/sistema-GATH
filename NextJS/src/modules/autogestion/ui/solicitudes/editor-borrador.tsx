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
import { getMiExpedienteAction } from "../../infrastructure/actions/autogestion-actions";
import {
  enviarSolicitudAction,
  guardarBorradorAction,
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

/** Edición del borrador por sección dentro de la ventana habilitada; la ficha real no cambia hasta la aprobación. */
export function EditorBorrador({ detalle, secciones, onActualizar }: Props) {
  const {
    data: ficha,
    error,
    isLoading,
    mutate,
  } = useSWR("mi-expediente-trabajador", () => getMiExpedienteAction());
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
  const habilitadas = detalle.seccionesHabilitadas.filter(esSeccionConocida);

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
          setErrores([res.mensaje]);
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
        setErrores([res.mensaje]);
      }
    });
  }

  if (isLoading) return <VistaCargando mensaje="Cargando sus datos actuales…" />;
  if (error || !ficha) {
    return (
      <VistaError
        mensaje="No se pudieron cargar sus datos actuales."
        onReintentar={() => mutate()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {habilitadas.map((codigo: SeccionCodigo) => {
        const def = SECCIONES_DEF[codigo];
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
                    onItems={setItems}
                  />
                ))}
                <SoportesSeccion
                  solicitudId={detalle.id}
                  seccion={codigo}
                  soportes={detalle.soportes}
                  obligatorio={requiereSoporte}
                  onCambio={onActualizar}
                />
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

      <div className="sticky bottom-20 z-30 flex flex-wrap gap-3 rounded-lg border bg-card p-3 shadow-md lg:bottom-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void guardar()}
          disabled={guardando || enviando || !sucio}
        >
          <Save aria-hidden />{" "}
          {guardando ? "Guardando…" : sucio ? "Guardar borrador" : "Borrador guardado"}
        </Button>
        <Button type="button" size="lg" onClick={intentarEnviar} disabled={guardando || enviando}>
          <Send aria-hidden /> {enviando ? "Enviando…" : "Enviar a Bienestar Social"}
        </Button>
        {sucio ? (
          <p className="self-center text-sm text-warning">Tiene cambios sin guardar.</p>
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
