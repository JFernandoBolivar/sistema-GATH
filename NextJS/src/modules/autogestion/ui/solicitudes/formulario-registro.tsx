"use client";

import { useEffect, useId, useMemo } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { ZodObject, type ZodTypeAny } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CAMPO_PADRE,
  type CampoDef,
  type EntidadDef,
} from "../../domain/value-objects/campos-seccion";
import { CLASE_CONTROL, SelectorCatalogo } from "./selector-catalogo";
import { valorATexto } from "../schema/schema-solicitud";

type Valores = Record<string, string>;

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
    defaultValues: Object.fromEntries(campos.map((c) => [c.campo, valorATexto(inicial[c.campo])])),
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
          <Textarea rows={3} className="resize-none" {...comunes} {...register(c.campo)} />
        ) : (
          <Input
            type={
              c.tipo === "fecha"
                ? "date"
                : c.tipo === "correo"
                  ? "email"
                  : c.tipo === "telefono"
                    ? "tel"
                    : "text"
            }
            inputMode={c.tipo === "telefono" ? "tel" : undefined}
            autoComplete="off"
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
