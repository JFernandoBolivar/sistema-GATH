"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  ItemBorrador,
  SeccionCodigo,
  SoporteEntity,
} from "../../domain/entities/solicitud-actualizacion";
import {
  diferencias,
  itemsARegistros,
  reemplazarRegistrosDeEntidad,
  type RegistroBorrador,
} from "../../domain/services/borrador";
import {
  claveCampo,
  etiquetaCampo,
  type EntidadDef,
} from "../../domain/value-objects/campos-seccion";
import type { MiExpedienteDTO } from "../../application/dtos/mi-expediente-dto";
import { esquemaDeEntidad } from "../schema/schema-solicitud";
import { formatearValor, type NombresCatalogo } from "../formato-solicitud";
import { registrosFicha, type FichaRegistro } from "./ficha-editable";
import { FormularioRegistro } from "./formulario-registro";
import { SoporteRegistro } from "./soportes-seccion";

interface Props {
  seccion: SeccionCodigo;
  definicion: EntidadDef;
  ficha: MiExpedienteDTO;
  items: ItemBorrador[];
  nombres: NombresCatalogo;
  /** Campos `entidad.campo` que Bienestar habilitó: solo ellos se editan (decisión G). */
  camposHabilitados: string[];
  onItems: (items: ItemBorrador[]) => void;
  solicitudId?: string;
  soportes?: SoporteEntity[];
  onCambioSoportes?: () => void;
}

type Abierto =
  | { tipo: "modificar"; id: string | null }
  | { tipo: "nuevo" }
  | { tipo: "quitar"; id: string }
  | null;

/** Entidades cuyos cambios exigen un documento por registro. */
const CON_DOCUMENTO = new Set(["familiar", "formacion_academica", "formacion_complementaria"]);
const MOTIVO_QUITAR_MIN = 10;
const MOTIVO_QUITAR_MAX = 300;

function resumenCambios(valores: Record<string, unknown>, nombres: NombresCatalogo): string {
  return Object.entries(valores)
    .map(
      ([campo, valor]) =>
        `${etiquetaCampo(campo)}: ${formatearValor(valor as never, campo, nombres)}`,
    )
    .join(" · ");
}

/** Edita los registros de una entidad dentro del borrador (modificar existentes o proponer uno nuevo). */
export function EditorEntidad({
  seccion,
  definicion: definicionCompleta,
  ficha,
  items,
  nombres,
  camposHabilitados,
  onItems,
  solicitudId,
  soportes = [],
  onCambioSoportes,
}: Props) {
  const definicion = useMemo<EntidadDef>(
    () => ({
      ...definicionCompleta,
      campos: definicionCompleta.campos.filter((c) =>
        camposHabilitados.includes(claveCampo(definicionCompleta.entidad, c.campo)),
      ),
    }),
    [definicionCompleta, camposHabilitados],
  );
  // Crear un registro nuevo exige tener habilitados todos sus campos obligatorios.
  const puedeCrearBase = definicionCompleta.campos
    .filter((c) => c.requeridoAlCrear)
    .every((c) => camposHabilitados.includes(claveCampo(definicionCompleta.entidad, c.campo)));
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
  if (!esquema || definicion.campos.length === 0) return null;

  const modificaciones = registros.filter((r) => r.accion === "MODIFICAR");
  const nuevos = registros.filter((r) => r.accion === "CREAR");
  const eliminados = registros.filter((r) => r.accion === "ELIMINAR");
  // Una entidad única sin registro vigente (p. ej. vivienda) se propone completa con CREAR.
  const unicaSinRegistro = definicion.unica && vigentes.length === 0;
  const eliminado = (id: string | null) =>
    eliminados.some((r) => r.accion === "ELIMINAR" && r.entidadId === id);
  const puedeCrear =
    puedeCrearBase &&
    !(
      definicionCompleta.entidad === "contacto_emergencia" &&
      vigentes.length + nuevos.length - eliminados.length >= 3
    );

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
        referencia: crypto.randomUUID(),
      },
    ]);
  }

  function quitarRegistro(id: string, motivo: string) {
    const otros = registros.filter(
      (r) => !(r.entidadId === id && (r.accion === "MODIFICAR" || r.accion === "ELIMINAR")),
    );
    guardar([
      ...otros,
      {
        seccion,
        entidad: definicion.entidad,
        entidadId: id,
        accion: "ELIMINAR",
        valores: {},
        motivo,
      },
    ]);
  }

  function quitarModificacion(id: string | null) {
    guardar(registros.filter((r) => !(r.accion === "MODIFICAR" && r.entidadId === id)));
  }

  function quitarNuevo(indice: number) {
    guardar([...modificaciones, ...eliminados, ...nuevos.filter((_, i) => i !== indice)]);
  }

  function filaVigente(v: FichaRegistro | null) {
    const id = v?.id ?? null;
    const propuesto = modificaciones.find((m) => m.entidadId === id);
    const editando = abierto?.tipo === "modificar" && abierto.id === id;
    const quitando = abierto?.tipo === "quitar" && abierto.id === id;
    const yaQuitado = eliminado(id);
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
            {yaQuitado ? (
              <p className="mt-2 rounded-md bg-danger-soft p-2 text-sm text-danger">
                <span className="font-semibold">Se propone quitar este registro.</span> Se eliminará
                al aprobarse la solicitud.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
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
            {!editando && !yaQuitado ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAbierto({ tipo: "modificar", id })}
              >
                <Pencil aria-hidden /> {propuesto ? "Editar cambio" : "Modificar"}
              </Button>
            ) : null}
            {v && definicion.creable && !definicion.unica && !yaQuitado ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => id && setAbierto({ tipo: "quitar", id })}
              >
                <Trash2 aria-hidden /> Quitar
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
        {quitando && id ? (
          <FormularioQuitar
            onGuardar={(motivo) => quitarRegistro(id, motivo)}
            onCancelar={() => setAbierto(null)}
          />
        ) : null}
        {v && CON_DOCUMENTO.has(definicion.entidad) && !yaQuitado && solicitudId ? (
          <SoporteRegistro
            solicitudId={solicitudId}
            seccion={seccion}
            entidadId={id}
            soportes={soportes}
            onCambio={onCambioSoportes ?? (() => {})}
          />
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
          {!puedeCrear ? (
            <p className="mt-2 text-sm text-warning">
              Para registrar este dato debió solicitar todos sus campos obligatorios.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            {nuevos[0] ? (
              <Button type="button" variant="outline" size="sm" onClick={() => quitarNuevo(0)}>
                <Undo2 aria-hidden /> Quitar registro
              </Button>
            ) : null}
            {abierto === null && puedeCrear ? (
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
              className="flex flex-col gap-2 rounded-lg border border-info/40 bg-info-soft p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm text-info">
                  <span className="font-semibold">Registro nuevo:</span>{" "}
                  {resumenCambios(n.valores, nombres)}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => quitarNuevo(i)}>
                  <Undo2 aria-hidden /> Quitar
                </Button>
              </div>
              {CON_DOCUMENTO.has(definicion.entidad) && solicitudId ? (
                <SoporteRegistro
                  solicitudId={solicitudId}
                  seccion={seccion}
                  referencia={n.referencia}
                  soportes={soportes}
                  onCambio={onCambioSoportes ?? (() => {})}
                />
              ) : null}
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

      {definicion.creable && !definicion.unica && abierto === null && puedeCrear ? (
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
        referencia: crypto.randomUUID(),
      },
    ]);
  }
}

/** Motivo obligatorio para pedir que se quite un registro (10 a 300 caracteres). */
function FormularioQuitar({
  onGuardar,
  onCancelar,
}: {
  onGuardar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enviar() {
    const texto = motivo.trim();
    if (texto.length < MOTIVO_QUITAR_MIN) {
      setError(`El motivo debe tener al menos ${MOTIVO_QUITAR_MIN} caracteres.`);
      return;
    }
    if (texto.length > MOTIVO_QUITAR_MAX) {
      setError(`El motivo no puede superar ${MOTIVO_QUITAR_MAX} caracteres.`);
      return;
    }
    setError(null);
    onGuardar(texto);
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-danger/40 bg-danger-soft p-3">
      <label htmlFor="motivo-quitar" className="text-base font-medium">
        Motivo para quitar este registro
      </label>
      <Textarea
        id="motivo-quitar"
        rows={2}
        maxLength={MOTIVO_QUITAR_MAX}
        value={motivo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "motivo-quitar-error" : undefined}
        onChange={(e) => setMotivo(e.target.value)}
        className="resize-none"
      />
      <p className="text-sm text-muted-foreground">
        Entre {MOTIVO_QUITAR_MIN} y {MOTIVO_QUITAR_MAX} caracteres. Lo revisará Bienestar Social.
      </p>
      {error ? (
        <p id="motivo-quitar-error" role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={enviar}>
          Guardar «Quitar»
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function limpiarNulos(valores: Record<string, unknown>): Record<string, never> {
  return Object.fromEntries(
    Object.entries(valores).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  ) as Record<string, never>;
}
