"use client";

import Link from "next/link";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type {
  BloqueoSolicitudDTO,
  EsperaSolicitudDTO,
} from "../../application/dtos/solicitud-dto";
import {
  ACCIONES_SOLICITABLES,
  ENTIDADES_DE_LISTA,
  claveAccion,
  claveCampo,
  esEntidadDeLista,
  type SeccionDef,
} from "../../domain/value-objects/campos-seccion";

interface Props {
  seccion: SeccionDef;
  requiereSoporte: boolean;
  /** Claves marcadas (`entidad.campo` o `entidad.@ACCION`) de TODA la solicitud. */
  valor: string[];
  onCambio: (valor: string[]) => void;
  /** O48: solicitudes abiertas que impiden volver a pedir el mismo campo/sección. */
  bloqueos?: BloqueoSolicitudDTO[];
  /** O48: secciones con espera tras una aprobación reciente. */
  esperas?: EsperaSolicitudDTO[];
  /** O48 / PRUEBAS-USUARIO 1: alcance del bloqueo ('registro' | 'seccion' | 'desactivado'). */
  alcance?: "registro" | "seccion" | "desactivado";
}

const CLASE_OPCION =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-accent";

/**
 * Paso 1 de la solicitud: las secciones simples piden campos; las de lista (grupo familiar, contactos,
 * formaciones) piden acciones (Agregar, Corregir, Quitar), porque un campo suelto no dice de quién ni qué hacer.
 */
export function SelectorCamposSolicitud({
  seccion,
  requiereSoporte,
  valor,
  onCambio,
  bloqueos = [],
  esperas = [],
  alcance = "registro",
}: Props) {
  const bloqueoSeccion = bloqueos.find((b) => b.clave === seccion.codigo);
  const espera = esperas.find((e) => e.seccion === seccion.codigo);

  // PRUEBAS-USUARIO 1:
  // - Si el alcance es "seccion": todos los bloqueos de esta sección (deduplicados por solicitud_id).
  // - Si el alcance es "registro": solo bloqueos a toda la sección (b.clave === seccion.codigo).
  //   Los avisos de campos individuales van junto a cada control bloqueado, no repetidos en la sección.
  const bloqueosAvisoSeccion = (() => {
    const candidatos = bloqueos.filter(
      (b) =>
        b.seccion === seccion.codigo &&
        (alcance === "seccion" || b.clave === seccion.codigo),
    );
    const mapa = new Map<string, BloqueoSolicitudDTO>();
    for (const b of candidatos) {
      if (!mapa.has(b.solicitud_id)) {
        mapa.set(b.solicitud_id, b);
      }
    }
    return Array.from(mapa.values());
  })();

  function bloqueoDe(clave: string, accion: string) {
    const porCampo = bloqueos.find((b) => b.clave === clave);
    if (porCampo || bloqueoSeccion) return porCampo ?? bloqueoSeccion;
    if (espera && (espera.acciones.length === 0 || espera.acciones.includes(accion))) {
      return espera;
    }
    return undefined;
  }

  function alternar(clave: string, marcar: boolean) {
    onCambio(marcar ? [...valor, clave] : valor.filter((x) => x !== clave));
  }

  return (
    <li className="rounded-lg border bg-card p-4">
      <p className="text-base font-semibold">{seccion.nombre}</p>
      <p className="text-sm text-muted-foreground">{seccion.descripcion}</p>
      {requiereSoporte ? (
        <p className="mt-1 text-sm font-medium text-warning">Exige adjuntar un soporte</p>
      ) : null}
      {bloqueosAvisoSeccion.length > 0 || espera ? (
        <div className="mt-2 flex flex-col gap-1 rounded-md border border-warning/40 bg-warning-soft p-2 text-sm">
          {bloqueosAvisoSeccion.map((bloqueo) => (
            <p key={`${bloqueo.clave}-${bloqueo.solicitud_id}`}>
              {bloqueo.mensaje}{" "}
              <Link
                href={`/autogestion/solicitudes/${bloqueo.solicitud_id}`}
                className="font-semibold underline"
              >
                Ver solicitud
              </Link>
            </p>
          ))}
          {espera ? <p>{espera.mensaje}</p> : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-4">
        {seccion.entidades.map((e) =>
          esEntidadDeLista(e.entidad) ? (
            <fieldset key={e.entidad} className="flex flex-col gap-2">
              <legend className="text-sm font-medium">
                {ENTIDADES_DE_LISTA[e.entidad].grupo}: ¿qué desea hacer?
              </legend>
              <ul className="grid gap-2 sm:grid-cols-3">
                {ACCIONES_SOLICITABLES.map((a) => {
                  const clave = claveAccion(e.entidad, a.accion);
                  const accion =
                    a.accion === "CREAR"
                      ? "agregar"
                      : a.accion === "ELIMINAR"
                        ? "quitar"
                        : "corregir";
                  const porCampo = bloqueos.find((b) => b.clave === clave);
                  const bloqueo = bloqueoDe(clave, accion);
                  const esBloqueoItem =
                    alcance === "registro" &&
                    Boolean(porCampo && "solicitud_id" in porCampo);
                  return (
                    <li key={clave} className="flex flex-col gap-1">
                      <label
                        className={cn(
                          CLASE_OPCION,
                          bloqueo && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={valor.includes(clave)}
                          onCheckedChange={(v) => alternar(clave, v === true)}
                          className="size-5"
                          disabled={Boolean(bloqueo)}
                          aria-label={`${ENTIDADES_DE_LISTA[e.entidad].grupo}: ${a.etiqueta}`}
                        />
                        <span className="text-base">{a.etiqueta}</span>
                      </label>
                      {porCampo && esBloqueoItem ? (
                        <p className="text-xs text-warning">
                          {porCampo.mensaje}{" "}
                          <Link
                            href={`/autogestion/solicitudes/${porCampo.solicitud_id}`}
                            className="font-semibold underline"
                          >
                            Ver solicitud
                          </Link>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : (
            <ul key={e.entidad} className="grid gap-2 sm:grid-cols-2">
              {e.campos.map((c) => {
                const clave = claveCampo(e.entidad, c.campo);
                const porCampo = bloqueos.find((b) => b.clave === clave);
                const bloqueo = bloqueoDe(clave, "corregir");
                const esBloqueoItem =
                  alcance === "registro" &&
                  Boolean(porCampo && "solicitud_id" in porCampo);
                return (
                  <li key={clave} className="flex flex-col gap-1">
                    <label
                      className={cn(
                        CLASE_OPCION,
                        bloqueo && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={valor.includes(clave)}
                        onCheckedChange={(v) => alternar(clave, v === true)}
                        className="size-5"
                        disabled={Boolean(bloqueo)}
                        aria-label={`${seccion.nombre}: ${c.etiqueta}`}
                      />
                      <span className="text-base">
                        {e.unica || e.campos.length === 1
                          ? c.etiqueta
                          : `${e.etiqueta}: ${c.etiqueta}`}
                      </span>
                    </label>
                    {porCampo && esBloqueoItem ? (
                      <p className="text-xs text-warning">
                        {porCampo.mensaje}{" "}
                        <Link
                          href={`/autogestion/solicitudes/${porCampo.solicitud_id}`}
                          className="font-semibold underline"
                        >
                          Ver solicitud
                        </Link>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ),
        )}
      </div>
    </li>
  );
}
