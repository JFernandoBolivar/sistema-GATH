"use client";

/**
 * Diálogo único de alta/edición de una carga familiar. A diferencia de personal,
 * el legado (`personal-trabajador/familiares/agregar-familiar/page.tsx`)
 * exponía el alta en una ruta propia — aquí se mantiene como diálogo porque
 * el formulario es mucho más chico (identidad + parentesco, sin las
 * secciones de vivienda/salud/físico/formación que personal sí tiene) y la
 * carga familiar siempre está anidada bajo el empleado ya seleccionado en
 * `familiares-page.tsx`: no hay necesidad real de una ruta independiente
 * para un formulario de 9 campos. Mismo componente sirve para crear
 * (`familiar` ausente) y editar (`familiar` presente).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import type { CatalogosFamiliarDTO, FamiliarDTO, GuardarFamiliarInputDTO } from "../application/dtos/familiar-dto";
import {
  actualizarFamiliarAction,
  crearFamiliarAction,
  getCatalogosFamiliarAction,
} from "../infrastructure/actions/familiares-actions";
import { familiarSchema, type FamiliarFormType } from "./schema/schema-familiar";
import { CatalogoFamiliarSelect } from "./catalogo-familiar-select";

interface FamiliarFormDialogProps {
  /** Presente = editar; ausente = crear (requiere `empleadoCedula`). */
  familiar?: FamiliarDTO;
  empleadoCedula?: string;
  onGuardado: (familiar: FamiliarDTO) => void;
}

function valoresIniciales(familiar: FamiliarDTO | undefined, empleadoCedula: string | undefined): FamiliarFormType {
  if (familiar) {
    return {
      empleadoCedula: familiar.empleadoCedula,
      cedulaFamiliar: familiar.cedulaFamiliar,
      primerNombre: familiar.primerNombre,
      segundoNombre: familiar.segundoNombre,
      primerApellido: familiar.primerApellido,
      segundoApellido: familiar.segundoApellido,
      parentescoId: familiar.parentescoId,
      fechaNacimiento: familiar.fechaNacimiento,
      sexoId: familiar.sexoId,
      mismoEnte: familiar.mismoEnte,
      heredero: familiar.heredero,
      observaciones: familiar.observaciones,
    };
  }
  return {
    empleadoCedula: empleadoCedula ?? "",
    cedulaFamiliar: null,
    primerNombre: "",
    segundoNombre: null,
    primerApellido: "",
    segundoApellido: null,
    parentescoId: 0,
    fechaNacimiento: "",
    sexoId: 0,
    mismoEnte: false,
    heredero: false,
    observaciones: null,
  };
}

export function FamiliarFormDialog({ familiar, empleadoCedula, onGuardado }: FamiliarFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosFamiliarDTO | null>(null);
  const editando = !!familiar;

  useEffect(() => {
    if (!open || catalogos) return;
    getCatalogosFamiliarAction().then(setCatalogos).catch(() => setCatalogos({ parentescos: [], sexos: [] }));
  }, [open, catalogos]);

  const form = useForm<FamiliarFormType>({
    resolver: zodResolver(familiarSchema),
    defaultValues: valoresIniciales(familiar, empleadoCedula),
  });

  const onAbrir = (siguiente: boolean) => {
    setOpen(siguiente);
    if (siguiente) {
      setError(null);
      form.reset(valoresIniciales(familiar, empleadoCedula));
    }
  };

  const onGuardar = (data: FamiliarFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = editando
        ? await actualizarFamiliarAction(familiar.id, data as Partial<GuardarFamiliarInputDTO>)
        : await crearFamiliarAction(data as GuardarFamiliarInputDTO);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setOpen(false);
      onGuardado(resultado as FamiliarDTO);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onAbrir}>
      <DialogTrigger asChild>
        {editando ? (
          <Button size="sm" variant="outline">
            <Pencil className="size-4" aria-hidden="true" /> Editar
          </Button>
        ) : (
          <Button disabled={!empleadoCedula}>
            <Plus className="size-4" aria-hidden="true" /> Nuevo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar carga familiar" : "Nueva carga familiar"}</DialogTitle>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field>
              <Label htmlFor="cedulaFamiliar">Cédula del familiar</Label>
              <Input id="cedulaFamiliar" {...form.register("cedulaFamiliar")} />
            </Field>
            <Field data-invalid={!!form.formState.errors.primerNombre}>
              <Label htmlFor="primerNombre">Primer nombre</Label>
              <Input id="primerNombre" {...form.register("primerNombre")} aria-invalid={!!form.formState.errors.primerNombre} />
              {form.formState.errors.primerNombre && <p role="alert" className="text-sm text-destructive">{form.formState.errors.primerNombre.message}</p>}
            </Field>
            <Field>
              <Label htmlFor="segundoNombre">Segundo nombre</Label>
              <Input id="segundoNombre" {...form.register("segundoNombre")} />
            </Field>
            <Field data-invalid={!!form.formState.errors.primerApellido}>
              <Label htmlFor="primerApellido">Primer apellido</Label>
              <Input id="primerApellido" {...form.register("primerApellido")} aria-invalid={!!form.formState.errors.primerApellido} />
              {form.formState.errors.primerApellido && <p role="alert" className="text-sm text-destructive">{form.formState.errors.primerApellido.message}</p>}
            </Field>
            <Field>
              <Label htmlFor="segundoApellido">Segundo apellido</Label>
              <Input id="segundoApellido" {...form.register("segundoApellido")} />
            </Field>
            <Field data-invalid={!!form.formState.errors.parentescoId}>
              <Label htmlFor="parentescoId">Parentesco</Label>
              <CatalogoFamiliarSelect
                id="parentescoId"
                value={form.watch("parentescoId")}
                onChange={(v) => form.setValue("parentescoId", v, { shouldValidate: true })}
                options={catalogos?.parentescos ?? []}
                placeholder="Seleccione parentesco"
              />
              {form.formState.errors.parentescoId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.parentescoId.message}</p>}
            </Field>
            <Field data-invalid={!!form.formState.errors.fechaNacimiento}>
              <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
              <Input type="date" id="fechaNacimiento" {...form.register("fechaNacimiento")} aria-invalid={!!form.formState.errors.fechaNacimiento} />
              {form.formState.errors.fechaNacimiento && <p role="alert" className="text-sm text-destructive">{form.formState.errors.fechaNacimiento.message}</p>}
            </Field>
            <Field data-invalid={!!form.formState.errors.sexoId}>
              <Label htmlFor="sexoId">Sexo</Label>
              <CatalogoFamiliarSelect
                id="sexoId"
                value={form.watch("sexoId")}
                onChange={(v) => form.setValue("sexoId", v, { shouldValidate: true })}
                options={catalogos?.sexos ?? []}
                placeholder="Seleccione sexo"
              />
              {form.formState.errors.sexoId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.sexoId.message}</p>}
            </Field>
            <Field>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Input id="observaciones" {...form.register("observaciones")} />
            </Field>
          </div>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register("mismoEnte")} className="size-4" /> Mismo ente
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register("heredero")} className="size-4" /> Heredero
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : editando ? <Pencil className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
              {editando ? "Guardar cambios" : "Crear"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
