"use client";

import { Checkbox } from "@/components/ui/checkbox";
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
}

const CLASE_OPCION =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-accent";

/**
 * Paso 1 de la solicitud: las secciones simples piden campos; las de lista (grupo familiar, contactos,
 * formaciones) piden acciones (Agregar, Corregir, Quitar), porque un campo suelto no dice de quién ni qué hacer.
 */
export function SelectorCamposSolicitud({ seccion, requiereSoporte, valor, onCambio }: Props) {
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
                  return (
                    <li key={clave}>
                      <label className={CLASE_OPCION}>
                        <Checkbox
                          checked={valor.includes(clave)}
                          onCheckedChange={(v) => alternar(clave, v === true)}
                          className="size-5"
                          aria-label={`${ENTIDADES_DE_LISTA[e.entidad].grupo}: ${a.etiqueta}`}
                        />
                        <span className="text-base">{a.etiqueta}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : (
            <ul key={e.entidad} className="grid gap-2 sm:grid-cols-2">
              {e.campos.map((c) => {
                const clave = claveCampo(e.entidad, c.campo);
                return (
                  <li key={clave}>
                    <label className={CLASE_OPCION}>
                      <Checkbox
                        checked={valor.includes(clave)}
                        onCheckedChange={(v) => alternar(clave, v === true)}
                        className="size-5"
                        aria-label={`${seccion.nombre}: ${c.etiqueta}`}
                      />
                      <span className="text-base">
                        {e.unica || e.campos.length === 1
                          ? c.etiqueta
                          : `${e.etiqueta}: ${c.etiqueta}`}
                      </span>
                    </label>
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
