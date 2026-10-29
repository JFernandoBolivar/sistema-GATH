"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ItemBorrador, SeccionCodigo } from "../../domain/entities/solicitud-actualizacion";
import {
  diferencias,
  itemsARegistros,
  reemplazarRegistrosDeEntidad,
  type RegistroBorrador,
} from "../../domain/services/borrador";
import { etiquetaCampo, type EntidadDef } from "../../domain/value-objects/campos-seccion";
import type { MiExpedienteDTO } from "../../application/dtos/mi-expediente-dto";
import { esquemaDeEntidad } from "../schema/schema-solicitud";
import { formatearValor, type NombresCatalogo } from "../formato-solicitud";
import { registrosFicha, type FichaRegistro } from "./ficha-editable";
import { FormularioRegistro } from "./formulario-registro";

interface Props {
  seccion: SeccionCodigo;
  definicion: EntidadDef;
  ficha: MiExpedienteDTO;
  items: ItemBorrador[];
  nombres: NombresCatalogo;
  onItems: (items: ItemBorrador[]) => void;
}

type Abierto = { tipo: "modificar"; id: string | null } | { tipo: "nuevo" } | null;

function resumenCambios(valores: Record<string, unknown>, nombres: NombresCatalogo): string {
  return Object.entries(valores)
    .map(
      ([campo, valor]) =>
        `${etiquetaCampo(campo)}: ${formatearValor(valor as never, campo, nombres)}`,
    )
    .join(" · ");
}

/** Edita los registros de una entidad dentro del borrador (modificar existentes o proponer uno nuevo). */
export function EditorEntidad({ seccion, definicion, ficha, items, nombres, onItems }: Props) {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const esquema = esquemaDeEntidad(seccion, definicion.entidad);
  const vigentes = useMemo(
    () => registrosFicha(ficha, definicion.entidad),
    [ficha, definicion.entidad],
  );
  const registros = useMemo(
    () =>
      itemsARegistros(
        items.filter((i) => i.seccion === seccion && i.entidad === definicion.entidad),
      ),
    [items, seccion, definicion.entidad],
  );
  if (!esquema) return null;

  const modificaciones = registros.filter((r) => r.accion === "MODIFICAR");
  const nuevos = registros.filter((r) => r.accion === "CREAR");
  // Una entidad única sin registro vigente (p. ej. vivienda) se propone completa con CREAR.
  const unicaSinRegistro = definicion.unica && vigentes.length === 0;

  function guardar(registrosNuevos: RegistroBorrador[]) {
    onItems(reemplazarRegistrosDeEntidad(items, seccion, definicion.entidad, registrosNuevos));
    setAbierto(null);
  }

  function guardarModificacion(vigente: FichaRegistro | null, valores: Record<string, unknown>) {
    const id = vigente?.id ?? null;
    const otros = registros.filter((r) => !(r.accion === "MODIFICAR" && r.entidadId === id));
    if (!vigente) {
      guardar([
        ...otros,
        {
          seccion,
          entidad: definicion.entidad,
          entidadId: null,
          accion: "CREAR",
          valores: limpiarNulos(valores),
        },
      ]);
      return;
    }
    const cambios = diferencias(vigente.valores, valores);
    guardar(
      Object.keys(cambios).length === 0
        ? otros
        : [
            ...otros,
            {
              seccion,
              entidad: definicion.entidad,
              entidadId: id,
              accion: "MODIFICAR",
              valores: cambios,
            },
          ],
    );
  }

  function guardarNuevo(valores: Record<string, unknown>) {
    guardar([
      ...registros,
      {
        seccion,
        entidad: definicion.entidad,
        entidadId: null,
        accion: "CREAR",
        valores: limpiarNulos(valores),
      },
    ]);
  }

  function quitarModificacion(id: string | null) {
    guardar(registros.filter((r) => !(r.accion === "MODIFICAR" && r.entidadId === id)));
  }

  function quitarNuevo(indice: number) {
    guardar([...modificaciones, ...nuevos.filter((_, i) => i !== indice)]);
  }

  function filaVigente(v: FichaRegistro | null) {
    const id = v?.id ?? null;
    const propuesto = modificaciones.find((m) => m.entidadId === id);
    const editando = abierto?.tipo === "modificar" && abierto.id === id;
    return (
      <li key={id ?? "unico"} className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Dato actual</p>
            <p className="break-words text-base">{v?.resumen ?? "Aún no hay datos registrados."}</p>
            {propuesto ? (
              <p className="mt-2 rounded-md bg-info-soft p-2 text-sm text-info">
                <span className="font-semibold">Cambio propuesto:</span>{" "}
                {resumenCambios(propuesto.valores, nombres)}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {propuesto ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quitarModificacion(id)}
              >
                <Undo2 aria-hidden /> Quitar cambio
              </Button>
            ) : null}
            {!editando ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAbierto({ tipo: "modificar", id })}
              >
                <Pencil aria-hidden /> {propuesto ? "Editar cambio" : "Modificar"}
              </Button>
            ) : null}
          </div>
        </div>
        {editando ? (
          <div className="mt-3">
            <FormularioRegistro
              seccion={seccion}
              definicion={definicion}
              esquema={esquema!}
              modo="MODIFICAR"
              inicial={{ ...(v?.valores ?? {}), ...(propuesto?.valores ?? {}) }}
              textoGuardar="Guardar cambio"
              onGuardar={(valores) => guardarModificacion(v, valores)}
              onCancelar={() => setAbierto(null)}
            />
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{definicion.etiqueta}</h3>

      {unicaSinRegistro ? (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-base">Aún no tiene este dato registrado.</p>
          {nuevos[0] ? (
            <p className="mt-2 rounded-md bg-info-soft p-2 text-sm text-info">
              <span className="font-semibold">Registro propuesto:</span>{" "}
              {resumenCambios(nuevos[0].valores, nombres)}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            {nuevos[0] ? (
              <Button type="button" variant="outline" size="sm" onClick={() => quitarNuevo(0)}>
                <Undo2 aria-hidden /> Quitar registro
              </Button>
            ) : null}
            {abierto === null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAbierto({ tipo: "nuevo" })}
              >
                <Plus aria-hidden /> {nuevos[0] ? "Editar registro" : "Registrar"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {vigentes.length > 0
            ? vigentes.map((v) => filaVigente(v))
            : definicion.unica
              ? [filaVigente(null)]
              : null}
        </ul>
      )}

      {nuevos.length > 0 && !unicaSinRegistro ? (
        <ul className="flex flex-col gap-2">
          {nuevos.map((n, i) => (
            <li
              key={i}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-info/40 bg-info-soft p-3"
            >
              <p className="min-w-0 break-words text-sm text-info">
                <span className="font-semibold">Registro nuevo:</span>{" "}
                {resumenCambios(n.valores, nombres)}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => quitarNuevo(i)}>
                <Undo2 aria-hidden /> Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {abierto?.tipo === "nuevo" ? (
        <FormularioRegistro
          seccion={seccion}
          definicion={definicion}
          esquema={esquema}
          modo="CREAR"
          inicial={unicaSinRegistro ? (nuevos[0]?.valores ?? {}) : {}}
          textoGuardar="Agregar al borrador"
          onGuardar={(valores) =>
            unicaSinRegistro ? guardarNuevoUnico(valores) : guardarNuevo(valores)
          }
          onCancelar={() => setAbierto(null)}
        />
      ) : null}

      {definicion.creable && !definicion.unica && abierto === null ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => setAbierto({ tipo: "nuevo" })}
        >
          <Plus aria-hidden /> Agregar {definicion.etiqueta.toLowerCase()}
        </Button>
      ) : null}
    </div>
  );

  function guardarNuevoUnico(valores: Record<string, unknown>) {
    guardar([
      {
        seccion,
        entidad: definicion.entidad,
        entidadId: null,
        accion: "CREAR",
        valores: limpiarNulos(valores),
      },
    ]);
  }
}

function limpiarNulos(valores: Record<string, unknown>): Record<string, never> {
  return Object.fromEntries(
    Object.entries(valores).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  ) as Record<string, never>;
}
