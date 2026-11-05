"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/shared/ui/components/combobox";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { crearParentescoAction } from "@/modules/catalogos/infrastructure/actions/catalogos-actions";
import type { ClaveCatalogo } from "../../domain/value-objects/campos-seccion";
import { opcionesCatalogo } from "./opciones-catalogo";
import { cn } from "@/lib/utils";
import type { UseFormRegisterReturn } from "react-hook-form";

interface Props {
  id: string;
  etiqueta: string;
  catalogo: ClaveCatalogo;
  /** Valor del campo del que depende (cascada); sin él, las listas dependientes se deshabilitan. */
  padreId?: number | null;
  dependeDePadre?: boolean;
  requerido?: boolean;
  error?: string;
  registro: UseFormRegisterReturn;
  /** Valor actual y cambio (para la lista con buscador; la nativa usa `registro`). */
  valor?: string | number | null;
  onCambio?: (valor: string) => void;
}

/** Con más opciones que esto la lista se muestra con buscador (código postal, parroquias…). */
const OPCIONES_CON_BUSCADOR = 12;
/** Ubicación: siempre con buscador, sea cual sea la cantidad de opciones. */
const CATALOGOS_CON_BUSCADOR = new Set<ClaveCatalogo>([
  "estados",
  "municipios",
  "parroquias",
  "codigosPostales",
]);

const OPCION_OTROS = "__otros__";

export const CLASE_CONTROL =
  "min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground disabled:cursor-not-allowed disabled:opacity-60";

/** Lista desplegable nativa (accesible y cómoda en móvil) alimentada por un catálogo del servidor. */
export function SelectorCatalogo({
  id,
  etiqueta,
  catalogo,
  padreId,
  dependeDePadre = false,
  requerido,
  error,
  registro,
  valor,
  onCambio,
}: Props) {
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, "catalogos.crear");
  const admiteOtros = puedeCrear && catalogo === "parentescos";

  const [creando, setCreando] = useState(false);
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const esperaPadre = dependeDePadre && !padreId;
  const {
    data,
    error: fallo,
    isLoading,
    mutate,
  } = useSWR(
    esperaPadre ? null : ["catalogo-autogestion", catalogo, padreId ?? 0],
    () => opcionesCatalogo(catalogo, padreId ?? undefined),
    { revalidateOnFocus: false },
  );

  const cancelarCreacion = () => {
    setCreando(false);
    setNuevoTexto("");
    setErrorNuevo(null);
  };

  const handleCrearParentesco = async () => {
    const desc = nuevoTexto.trim();
    if (desc.length < 2 || desc.length > 60) {
      setErrorNuevo("La descripción debe tener entre 2 y 60 caracteres.");
      return;
    }
    const yaExiste = (data ?? []).some(
      (o) => o.nombre.trim().toUpperCase() === desc.toUpperCase()
    );
    if (yaExiste) {
      setErrorNuevo("Ya existe un parentesco con esa descripción.");
      return;
    }

    setGuardando(true);
    setErrorNuevo(null);
    try {
      const res = await crearParentescoAction(desc, "contacto");
      if (res.success && res.data) {
        await mutate();
        if (onCambio) {
          onCambio(String(res.data.id));
        }
        toast.success("Parentesco registrado correctamente.");
        cancelarCreacion();
      } else {
        setErrorNuevo(res.message || "No se pudo crear el parentesco.");
      }
    } catch {
      setErrorNuevo("No se pudo registrar el parentesco.");
    } finally {
      setGuardando(false);
    }
  };

  const opcionesCombobox = (data ?? []).map((o) => ({ value: String(o.id), label: o.nombre }));
  if (admiteOtros) {
    opcionesCombobox.push({ value: OPCION_OTROS, label: "Otros…" });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-medium">
        {etiqueta}
        {requerido ? <span aria-hidden> *</span> : null}
      </label>
      {onCambio &&
      (CATALOGOS_CON_BUSCADOR.has(catalogo) || (data?.length ?? 0) > OPCIONES_CON_BUSCADOR) ? (
        <Combobox
          id={id}
          className={cn("min-h-11 bg-card text-base", error && "border-danger")}
          options={opcionesCombobox}
          value={valor === null || valor === undefined ? "" : String(valor)}
          onChange={(v) => {
            if (v === OPCION_OTROS) {
              setCreando(true);
              setNuevoTexto("");
              setErrorNuevo(null);
              return;
            }
            if (creando) cancelarCreacion();
            onCambio(v);
          }}
          placeholder="Seleccione…"
          searchPlaceholder={`Buscar ${etiqueta.toLowerCase()}…`}
          emptyText="No hay coincidencias."
          invalido={Boolean(error)}
          describedBy={error ? `${id}-error` : undefined}
        />
      ) : (
        <select
          id={id}
          className={cn(CLASE_CONTROL, error && "border-danger")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={esperaPadre || isLoading || Boolean(fallo)}
          {...registro}
          onChange={(e) => {
            if (e.target.value === OPCION_OTROS) {
              setCreando(true);
              setNuevoTexto("");
              setErrorNuevo(null);
              return;
            }
            if (creando) cancelarCreacion();
            registro.onChange(e);
          }}
        >
          <option value="">
            {esperaPadre
              ? "Elija primero la opción anterior"
              : isLoading
                ? "Cargando opciones…"
                : "Seleccione…"}
          </option>
          {(data ?? []).map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.nombre}
            </option>
          ))}
          {admiteOtros && <option value={OPCION_OTROS}>Otros…</option>}
        </select>
      )}

      {creando && (
        <div className="flex flex-col gap-2 rounded-md border p-3 mt-1 bg-muted/20">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={nuevoTexto}
              maxLength={60}
              placeholder="Nuevo parentesco (ej: COMPAÑERO DE TRABAJO)"
              aria-label="Nuevo parentesco"
              aria-invalid={errorNuevo ? true : undefined}
              disabled={guardando}
              onChange={(e) => {
                setNuevoTexto(e.target.value);
                setErrorNuevo(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCrearParentesco();
                }
                if (e.key === "Escape") cancelarCreacion();
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={guardando}
              onClick={() => void handleCrearParentesco()}
            >
              {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={guardando}
              onClick={cancelarCreacion}
            >
              Cancelar
            </Button>
          </div>
          {errorNuevo && (
            <p className="text-xs font-medium text-destructive">{errorNuevo}</p>
          )}
        </div>
      )}

      {fallo ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">
          <span>
            No se pudieron cargar las opciones. Si el problema continúa, comuníquese con Bienestar
            Social.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => mutate()}>
            Reintentar
          </Button>
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
