"use client";

/**
 * Selector de «Motivo» de un movimiento.
 *
 * Carga SOLO los motivos de la categoría que el backend asigna a la `operacion`
 * (sin filtrar por texto) y ofrece «Otros…» para escribir un motivo nuevo, que se
 * crea en esa misma categoría (requiere el permiso `catalogos.crear`).
 * El valor es el id del motivo; úsalo dentro de un `FormControl` de react-hook-form.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { crearMotivoAction, getMotivosAction } from "../../infrastructure/actions/cargos-actions";
import {
  MOTIVO_NOMBRE_MAX,
  validarNombreMotivoNuevo,
  type OperacionMotivo,
} from "../../domain/value-objects/operacion-motivo";

const OPCION_OTROS = "__otros__";

interface Motivo {
  id: number;
  nombre: string;
}

export interface MotivoSelectProps {
  operacion: OperacionMotivo;
  value: number | null | undefined;
  onChange: (id: number) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  className?: string;
}

export function MotivoSelect({
  operacion,
  value,
  onChange,
  id,
  placeholder = "Seleccione un motivo",
  disabled,
  "aria-invalid": ariaInvalid,
  className,
}: MotivoSelectProps) {
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, "catalogos.crear");

  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setErrorCarga(false);
    getMotivosAction(operacion)
      .then((lista) => {
        if (activo) setMotivos(lista.map((m) => ({ id: m.id, nombre: m.nombre })));
      })
      .catch(() => {
        if (activo) setErrorCarga(true);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [operacion]);

  const cancelar = useCallback(() => {
    setEscribiendo(false);
    setNuevo("");
    setErrorNuevo(null);
  }, []);

  const crear = async () => {
    const error = validarNombreMotivoNuevo(nuevo, motivos.map((m) => m.nombre));
    if (error) {
      setErrorNuevo(error);
      return;
    }
    setGuardando(true);
    setErrorNuevo(null);
    try {
      const r = await crearMotivoAction(nuevo.trim(), operacion);
      if (r.success && r.data) {
        const creado = { id: r.data.id, nombre: r.data.nombre };
        setMotivos((previos) => [...previos, creado].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
        onChange(creado.id);
        cancelar();
      } else {
        setErrorNuevo(r.errores?.movimiento?.[0] ?? r.message ?? "No se pudo crear el motivo.");
      }
    } finally {
      setGuardando(false);
    }
  };

  const seleccionado = value && value > 0 && motivos.some((m) => m.id === value) ? String(value) : "";

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={seleccionado}
        onValueChange={(v) => {
          if (v === OPCION_OTROS) {
            setEscribiendo(true);
            return;
          }
          cancelar();
          onChange(Number(v));
        }}
        disabled={disabled || cargando}
      >
        <SelectTrigger id={id} aria-invalid={ariaInvalid} className={className ?? "w-full truncate"}>
          <SelectValue placeholder={cargando ? "Cargando motivos..." : errorCarga ? "No se pudieron cargar" : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {motivos.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              {m.nombre}
            </SelectItem>
          ))}
          {puedeCrear && <SelectItem value={OPCION_OTROS}>Otros…</SelectItem>}
        </SelectContent>
      </Select>

      {escribiendo && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <Input
            autoFocus
            value={nuevo}
            maxLength={MOTIVO_NOMBRE_MAX + 20}
            placeholder="Escriba el nuevo motivo"
            aria-label="Nuevo motivo"
            aria-invalid={errorNuevo ? true : undefined}
            disabled={guardando}
            onChange={(e) => {
              setNuevo(e.target.value);
              setErrorNuevo(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void crear();
              }
              if (e.key === "Escape") cancelar();
            }}
          />
          {errorNuevo && (
            <p role="alert" className="text-sm text-destructive">
              {errorNuevo}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void crear()} disabled={guardando}>
              {guardando ? "Guardando..." : "Agregar motivo"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancelar} disabled={guardando}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
