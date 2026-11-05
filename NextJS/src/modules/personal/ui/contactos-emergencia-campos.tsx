"use client";

/**
 * Lista editable de contactos de emergencia (nombres, apellidos, teléfono y
 * parentesco). Compartida por el paso 1 del wizard de registro y el diálogo
 * de actualización de /personal/consultar; requiere un `<Form>` (FormProvider)
 * cuyo schema incluya `contacto_emergencia` (`schema-contacto-emergencia.ts`).
 */
import { useEffect, useState } from "react";
import { useFieldArray, useFormContext, type FieldValues } from "react-hook-form";
import { useSession } from "next-auth/react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/form";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { crearParentescoAction } from "@/modules/catalogos/infrastructure/actions/catalogos-actions";

import type { CatalogoEmpleadoDTO } from "../application/dtos/empleado-dto";
import { contactoEmergenciaVacio } from "./schema/schema-contacto-emergencia";

const NOMBRE = "contacto_emergencia";
const MAXIMO = 5;
const OPCION_OTROS = "__otros__";

export function ContactosEmergenciaCampos({
  parentescos,
  isLoading = false,
}: {
  parentescos: CatalogoEmpleadoDTO[];
  isLoading?: boolean;
}) {
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, "catalogos.crear");

  const [listaParentescos, setListaParentescos] = useState<CatalogoEmpleadoDTO[]>(parentescos);
  const [creandoEnIndex, setCreandoEnIndex] = useState<number | null>(null);
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  useEffect(() => {
    setListaParentescos(parentescos);
  }, [parentescos]);

  const cancelarCreacion = () => {
    setCreandoEnIndex(null);
    setNuevoTexto("");
    setErrorNuevo(null);
  };

  const crearParentesco = async (index: number, onChange: (id: number) => void) => {
    const desc = nuevoTexto.trim();
    if (desc.length < 2 || desc.length > 60) {
      setErrorNuevo("La descripción debe tener entre 2 y 60 caracteres.");
      return;
    }
    const yaExiste = listaParentescos.some(
      (p) => p.nombre.trim().toUpperCase() === desc.toUpperCase()
    );
    if (yaExiste) {
      setErrorNuevo("Ya existe un parentesco con esa descripción.");
      return;
    }

    setGuardandoNuevo(true);
    setErrorNuevo(null);
    try {
      const res = await crearParentescoAction(desc, "contacto");
      if (res.success && res.data) {
        const nuevoItem: CatalogoEmpleadoDTO = {
          id: res.data.id,
          nombre: res.data.nombre,
          codigo: null,
        };
        setListaParentescos((prev) =>
          [...prev, nuevoItem].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        );
        onChange(nuevoItem.id);
        toast.success("Parentesco registrado correctamente.");
        cancelarCreacion();
      } else {
        setErrorNuevo(res.message || "No se pudo crear el parentesco.");
      }
    } catch {
      setErrorNuevo("No se pudo registrar el parentesco.");
    } finally {
      setGuardandoNuevo(false);
    }
  };

  // El formulario anfitrión es distinto en cada uso (wizard/diálogo); solo se
  // exige que tenga el arreglo `contacto_emergencia`.
  const { control } = useFormContext<FieldValues>();
  const { fields, append, remove } = useFieldArray({ control, name: NOMBRE });

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No se registran contactos de emergencia.</p>
      )}
      {fields.map((item, index) => (
        <div key={item.id} className="@container flex flex-col gap-4 rounded-lg border p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Contacto {index + 1}</span>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="size-8 cursor-pointer"
              onClick={() => {
                if (creandoEnIndex === index) cancelarCreacion();
                remove(index);
              }}
              aria-label={`Quitar contacto de emergencia ${index + 1}`}
            >
              <X />
            </Button>
          </div>
          {/* Fila 1: nombres y apellidos. Fila 2: teléfono (país + código + número) y parentesco. */}
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
            <FormField
              control={control}
              name={`${NOMBRE}.${index}.nombres`}
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Nombres *</FormLabel>
                  <FormControl>
                    <Input placeholder="Maria Jose" maxLength={60} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${NOMBRE}.${index}.apellidos`}
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Apellidos *</FormLabel>
                  <FormControl>
                    <Input placeholder="Perez Gutierrez" maxLength={60} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
            <FormField
              control={control}
              name={`${NOMBRE}.${index}.telefono`}
              render={({ field, fieldState }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Teléfono *</FormLabel>
                  <FormControl>
                    <CampoTelefono
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalido={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${NOMBRE}.${index}.relacion_id`}
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Parentesco *</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => {
                      if (v === OPCION_OTROS) {
                        setCreandoEnIndex(index);
                        setNuevoTexto("");
                        setErrorNuevo(null);
                        return;
                      }
                      if (creandoEnIndex === index) cancelarCreacion();
                      field.onChange(Number.parseInt(v));
                    }}
                  >
                    <FormControl>
                      <SelectTrigger
                        className="w-full truncate"
                        aria-label={`Parentesco del contacto ${index + 1}`}
                      >
                        <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {listaParentescos.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                      {puedeCrear && (
                        <SelectItem value={OPCION_OTROS}>Otros…</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />

                  {creandoEnIndex === index && (
                    <div className="flex flex-col gap-2 rounded-md border p-3 mt-2 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Input
                          autoFocus
                          value={nuevoTexto}
                          maxLength={60}
                          placeholder="Nuevo parentesco (ej: COMPAÑERO DE TRABAJO)"
                          aria-label="Nuevo parentesco"
                          aria-invalid={errorNuevo ? true : undefined}
                          disabled={guardandoNuevo}
                          onChange={(e) => {
                            setNuevoTexto(e.target.value);
                            setErrorNuevo(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void crearParentesco(index, field.onChange);
                            }
                            if (e.key === "Escape") cancelarCreacion();
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={guardandoNuevo}
                          onClick={() => void crearParentesco(index, field.onChange)}
                        >
                          {guardandoNuevo ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={guardandoNuevo}
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
                </FormItem>
              )}
            />
          </div>
        </div>
      ))}
      {fields.length < MAXIMO && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start cursor-pointer"
          onClick={() => append(contactoEmergenciaVacio())}
        >
          <Plus className="size-4" /> Agregar contacto de emergencia
        </Button>
      )}
    </div>
  );
}
