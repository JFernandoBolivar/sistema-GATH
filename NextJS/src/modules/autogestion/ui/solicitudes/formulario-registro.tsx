"use client";

import { useEffect, useId, useMemo } from "react";
import useSWR from "swr";
import { Controller, useForm, type FieldValues, type Resolver } from "react-hook-form";
import { ZodObject, type ZodTypeAny } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import {
  CAMPO_PADRE,
  type CampoDef,
  type ClaveCatalogo,
  type EntidadDef,
} from "../../domain/value-objects/campos-seccion";
import { CLASE_CONTROL, SelectorCatalogo } from "./selector-catalogo";
import { opcionesCatalogo } from "./opciones-catalogo";
import { valorATexto } from "../schema/schema-solicitud";
import { cn } from "@/lib/utils";

type Valores = Record<string, unknown>;

/** Resolver RHF sobre un esquema Zod con entradas de texto; los errores se muestran por campo. */
function resolverZod(esquema: ZodTypeAny): Resolver<Valores> {
  return async (valores) => {
    const resultado = esquema.safeParse(valores);
    if (resultado.success) return { values: resultado.data as Valores, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of resultado.error.issues) {
      const campo = String(issue.path[0] ?? "");
      if (campo && !errors[campo]) errors[campo] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors } as ReturnType<Resolver<Valores>> extends Promise<infer R>
      ? R
      : never;
  };
}

interface Props {
  seccion: string;
  definicion: EntidadDef;
  esquema: ZodTypeAny;
  modo: "MODIFICAR" | "CREAR";
  /** Valores vigentes (MODIFICAR) o ya propuestos; en CREAR suele ir vacío. */
  inicial: Record<string, unknown>;
  textoGuardar: string;
  onGuardar: (valores: Record<string, unknown>) => void;
  onCancelar: () => void;
}

/** Formulario de un registro dirigido por la definición de campos de la sección (RHF + Zod). */
export function FormularioRegistro({
  seccion,
  definicion,
  esquema,
  modo,
  inicial,
  textoGuardar,
  onGuardar,
  onCancelar,
}: Props) {
  const idBase = useId();
  const camposDelEsquema = Object.keys(
    (esquema as { shape?: Record<string, unknown> }).shape ?? {},
  );
  const campos = definicion.campos.filter((c) => camposDelEsquema.includes(c.campo));
  // Solo se validan los campos que la solicitud habilitó (la definición ya viene filtrada).
  const esquemaActivo = useMemo(
    () =>
      esquema instanceof ZodObject
        ? esquema.pick(Object.fromEntries(campos.map((c) => [c.campo, true as const])))
        : esquema,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `campos` depende solo de la definición
    [esquema, definicion],
  );

  const form = useForm<Valores>({
    resolver: resolverZod(esquemaActivo),
    defaultValues: Object.fromEntries(
      campos.map((c) => [
        c.campo,
        c.tipo === "multiple"
          ? Array.isArray(inicial[c.campo])
            ? (inicial[c.campo] as number[])
            : []
          : valorATexto(inicial[c.campo]),
      ]),
    ),
  });
  const { register, handleSubmit, watch, setValue, formState } = form;

  // Cascadas: al cambiar un padre se limpia el hijo (estado → municipio → parroquia, etc.).
  useEffect(() => {
    const sub = watch((_valores, { name, type }) => {
      if (!name || type !== "change") return;
      for (const [hijo, padre] of Object.entries(CAMPO_PADRE)) {
        if (padre === name && camposDelEsquema.includes(hijo)) setValue(hijo, "");
      }
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `camposDelEsquema` es estable por esquema
  }, [watch, setValue]);

  function enviar(valores: FieldValues) {
    onGuardar(valores as Record<string, unknown>);
  }

  function renderCampo(c: CampoDef) {
    const id = `${idBase}-${c.campo}`;
    const error = formState.errors[c.campo]?.message as string | undefined;
    const requerido = modo === "CREAR" && c.requeridoAlCrear;
    const etiqueta = (
      <label htmlFor={id} className="text-base font-medium">
        {c.etiqueta}
        {requerido ? <span aria-hidden> *</span> : null}
      </label>
    );
    const mensaje = error ? (
      <p id={`${id}-error`} className="text-sm font-medium text-danger">
        {error}
      </p>
    ) : null;
    const comunes = {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${id}-error` : undefined,
    } as const;

    if (c.tipo === "multiple" && c.catalogo) {
      return (
        <div key={c.campo} className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-base font-medium" id={`${id}-label`}>
            {c.etiqueta}
            {requerido ? <span aria-hidden> *</span> : null}
          </span>
          <Controller
            control={form.control}
            name={c.campo}
            render={({ field }) => (
              <SelectorMultiple
                id={id}
                catalogo={c.catalogo as ClaveCatalogo}
                etiqueta={c.etiqueta}
                valor={Array.isArray(field.value) ? (field.value as number[]) : []}
                onCambio={field.onChange}
                error={error}
                describedBy={comunes["aria-describedby"]}
              />
            )}
          />
          {mensaje}
        </div>
      );
    }
    if (c.tipo === "catalogo" && c.catalogo) {
      const padreCampo = CAMPO_PADRE[c.campo];
      const padreValor = padreCampo ? Number(watch(padreCampo)) || null : null;
      return (
        <SelectorCatalogo
          key={c.campo}
          id={id}
          etiqueta={c.etiqueta}
          catalogo={c.catalogo}
          padreId={padreValor}
          dependeDePadre={Boolean(padreCampo)}
          requerido={requerido}
          error={error}
          registro={register(c.campo)}
          valor={watch(c.campo) as string | number | null | undefined}
          onCambio={(v) => setValue(c.campo, v, { shouldValidate: true, shouldDirty: true })}
        />
      );
    }
    if (c.tipo === "booleano") {
      return (
        <div key={c.campo} className="flex flex-col gap-1.5">
          {etiqueta}
          <select className={CLASE_CONTROL} {...comunes} {...register(c.campo)}>
            <option value="">Sin declarar</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
          {mensaje}
        </div>
      );
    }
    return (
      <div key={c.campo} className="flex flex-col gap-1.5">
        {etiqueta}
        {c.tipo === "textarea" ? (
          <Textarea rows={3} maxLength={500} className="resize-none" {...comunes} {...register(c.campo)} />
        ) : c.tipo === "telefono" ? (
          <Controller
            control={form.control}
            name={c.campo}
            render={({ field }) => (
              <CampoTelefono
                id={id}
                tipo={c.campo === "telefono_movil" ? "movil" : "cualquiera"}
                value={typeof field.value === "string" ? field.value : String(field.value ?? "")}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalido={Boolean(error)}
                aria-describedby={comunes["aria-describedby"]}
              />
            )}
          />
        ) : (
          <Input
            type={c.tipo === "fecha" ? "date" : c.tipo === "correo" ? "email" : "text"}
            autoComplete="off"
            maxLength={c.tipo === "correo" ? 254 : c.tipo === "fecha" ? 10 : 250}
            {...comunes}
            {...register(c.campo)}
          />
        )}
        {mensaje}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(enviar)}
      noValidate
      aria-label={`${definicion.etiqueta} (${seccion})`}
      className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">{campos.map(renderCampo)}</div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{textoGuardar}</Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

interface PropsMultiple {
  id: string;
  catalogo: ClaveCatalogo;
  etiqueta: string;
  valor: number[];
  onCambio: (valores: number[]) => void;
  error?: string;
  describedBy?: string;
}

/** Lista de selección múltiple (alergias, patologías, discapacidades) sobre un catálogo del servidor. */
function SelectorMultiple({
  id,
  catalogo,
  etiqueta,
  valor,
  onCambio,
  error,
  describedBy,
}: PropsMultiple) {
  const { data, error: fallo, isLoading } = useSWR(
    ["catalogo-autogestion-multiple", catalogo],
    () => opcionesCatalogo(catalogo),
    { revalidateOnFocus: false },
  );
  const seleccion = new Set(valor);

  function alternar(opcion: number) {
    const siguiente = new Set(seleccion);
    if (siguiente.has(opcion)) siguiente.delete(opcion);
    else siguiente.add(opcion);
    onCambio([...siguiente].sort((a, b) => a - b));
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={etiqueta}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(
        "max-h-56 overflow-y-auto rounded-md border border-input bg-card p-2",
        error && "border-danger",
      )}
    >
      {isLoading ? (
        <p className="p-1 text-sm text-muted-foreground">Cargando opciones…</p>
      ) : fallo ? (
        <p role="alert" className="p-1 text-sm font-medium text-danger">
          No se pudieron cargar las opciones.
        </p>
      ) : (data ?? []).length === 0 ? (
        <p className="p-1 text-sm text-muted-foreground">No hay opciones registradas.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {(data ?? []).map((o) => (
            <li key={o.id}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-1 hover:bg-accent">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={seleccion.has(o.id)}
                  onChange={() => alternar(o.id)}
                />
                <span className="text-base">{o.nombre}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
