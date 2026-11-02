"use client";

/**
 * Diálogo de edición de una carga familiar existente, abierto desde el Sheet
 * de detalle (`detalle-familiar.tsx`). El alta vive en su propia ruta
 * (`/familiares/registrar`, paridad con `familiares/agregar-familiar/page.tsx`
 * del legado) — este diálogo ya no cubre creación.
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";

import { CATALOGOS_FAMILIAR_VACIOS, type CatalogosFamiliarDTO, type FamiliarDTO, type GuardarFamiliarInputDTO } from "../application/dtos/familiar-dto";
import {
  actualizarFamiliarAction,
  getCatalogosFamiliarAction,
} from "../infrastructure/actions/familiares-actions";
import { familiarSchema, type FamiliarFormType } from "./schema/schema-familiar";
import { FamiliarCampos } from "./familiar-campos";

interface FamiliarFormDialogProps {
  familiar: FamiliarDTO;
  onGuardado: (familiar: FamiliarDTO) => void;
}

function valoresIniciales(familiar: FamiliarDTO): FamiliarFormType {
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

export function FamiliarFormDialog({ familiar, onGuardado }: FamiliarFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosFamiliarDTO | null>(null);

  useEffect(() => {
    if (!open || catalogos) return;
    getCatalogosFamiliarAction().then(setCatalogos).catch(() => setCatalogos(CATALOGOS_FAMILIAR_VACIOS));
  }, [open, catalogos]);

  const form = useForm<FamiliarFormType>({
    resolver: zodResolver(familiarSchema),
    defaultValues: valoresIniciales(familiar),
  });

  const onAbrir = (siguiente: boolean) => {
    setOpen(siguiente);
    if (siguiente) {
      setError(null);
      form.reset(valoresIniciales(familiar));
    }
  };

  const onGuardar = (data: FamiliarFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = await actualizarFamiliarAction(familiar.id, data as Partial<GuardarFamiliarInputDTO>);
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
        <Button size="sm" variant="outline">
          <Pencil className="size-4" aria-hidden="true" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar carga familiar</DialogTitle>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-4" noValidate>
          <FamiliarCampos form={form} catalogos={catalogos} />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />}
              Guardar cambios
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
