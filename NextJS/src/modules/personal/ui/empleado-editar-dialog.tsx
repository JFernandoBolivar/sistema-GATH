"use client";

/**
 * Diálogo de edición del expediente, embebido en `empleado-detalle-sheet.tsx`
 * — paridad con el legado (`tableEmployees/detail-info.tsx`), donde la
 * edición vivía en diálogos dentro del Sheet de detalle, nunca en el
 * listado. Simplificación deliberada frente al legado: allá había 8
 * diálogos pequeños (uno por sección: básicos, vivienda, salud, físico,
 * académica, complementaria, antecedentes, contrato); aquí es un solo
 * diálogo con todas las secciones, reutilizando `ExpedienteCampos` — misma
 * cobertura funcional, menos superficie de componentes que mantener.
 */
import { useState, useTransition } from "react";
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

import type { CatalogosExpedienteDTO, EmpleadoDTO, GuardarEmpleadoInputDTO } from "../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../infrastructure/actions/personal-actions";
import { ExpedienteCampos } from "./expediente-campos";
import { empleadoSchema, type EmpleadoFormType } from "./schema/schema-empleado";

interface EmpleadoEditarDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
}

export default function EmpleadoEditarDialog({ empleado, catalogos, onGuardado }: EmpleadoEditarDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EmpleadoFormType>({
    resolver: zodResolver(empleadoSchema),
    defaultValues: {
      cedula: empleado.cedula,
      nombres: empleado.nombres,
      apellidos: empleado.apellidos,
      sexoId: empleado.sexoId,
      fechaNacimiento: empleado.fechaNacimiento ?? undefined,
      correo: empleado.correo,
      telefonoMovil: empleado.telefonoMovil,
      telefonoHabitacion: empleado.telefonoHabitacion,
      estadoCivilId: empleado.estadoCivilId ?? undefined,
      carnetPatria: empleado.carnetPatria,
      datosVivienda: empleado.datosVivienda ?? {
        estadoId: undefined,
        municipioId: undefined,
        parroquiaId: undefined,
        direccionExacta: "",
        condicionViviendaId: undefined,
        codigoPostalId: undefined,
      },
      perfilSalud: empleado.perfilSalud ?? { grupoSanguineoId: undefined, alergias: [], patologiasCronicas: [], discapacidades: [] },
      perfilFisico: empleado.perfilFisico ?? { tallaCamisaId: undefined, tallaPantalonId: undefined, tallaZapatosId: undefined, tallaChaquetaId: undefined },
      formacionAcademica: empleado.formacionAcademica ?? [],
      formacionComplementaria: empleado.formacionComplementaria ?? [],
      contactoEmergencia: empleado.contactoEmergencia ?? [],
      antecedentes: empleado.antecedentes ?? [],
      contrato: [],
    },
  });

  const onGuardar = (data: EmpleadoFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = await actualizarEmpleadoAction(empleado.cedula, data as unknown as Partial<GuardarEmpleadoInputDTO>);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setOpen(false);
      onGuardado();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-4" aria-hidden="true" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar expediente — {empleado.nombreCompleto}</DialogTitle>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-6" noValidate>
          <ExpedienteCampos form={form} catalogos={catalogos} isPending={isPending} soloDatosExtendidos />
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
