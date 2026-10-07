"use client";

/**
 * Diálogo "Contactos De Emergencia" del detalle del trabajador
 * (/personal/consultar). Reemplaza la lista completa de contactos del
 * expediente (el backend borra y recrea `contacto_emergencia`); guardar con la
 * lista vacía elimina todos los contactos.
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
import { Form } from "@/shared/ui/components/form";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";
import { ContactosEmergenciaCampos } from "../contactos-emergencia-campos";
import {
  contactosEmergenciaFormSchema,
  contactosFormADto,
  type ContactosEmergenciaFormType,
} from "../schema/schema-contacto-emergencia";

interface Props {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function FormEmergencyContactsUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const valoresIniciales = (): ContactosEmergenciaFormType => ({
    contacto_emergencia: (empleado.contactoEmergencia ?? []).map((c) => ({
      nombres: c.nombres ?? "",
      apellidos: c.apellidos ?? "",
      telefono: c.telefono ?? "",
      relacion_id: c.relacionId ?? 0,
    })),
  });

  const form = useForm<ContactosEmergenciaFormType>({
    resolver: zodResolver(contactosEmergenciaFormSchema),
    defaultValues: valoresIniciales(),
  });

  const onSubmit = (data: ContactosEmergenciaFormType) => {
    startTransition(async () => {
      try {
        const result = await actualizarEmpleadoAction(empleado.cedula, {
          contactoEmergencia: contactosFormADto(data.contacto_emergencia),
        });
        if (result && typeof result === "object" && "error" in result) {
          toast.error((result as { error: string }).error);
          return;
        }
        toast.success("Contactos de emergencia actualizados exitosamente");
        setOpen(false);
        onGuardado();
      } catch {
        toast.error("Error al actualizar los contactos de emergencia.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(abierto) => {
        if (abierto) form.reset(valoresIniciales());
        setOpen(abierto);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl p-0">
        <DialogTitle className="sr-only">Actualizar Contactos De Emergencia</DialogTitle>
        <Card className="w-full h-full border-0 shadow-none">
          <CardHeader>
            <CardTitle>Contactos De Emergencia</CardTitle>
          </CardHeader>
          <CardContent>
            <CardAction className="text-gray-500 mb-3">
              Personas de enlace en caso de contingencias médicas o laborales
            </CardAction>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <ContactosEmergenciaCampos parentescos={catalogos?.parentescos ?? []} isLoading={!catalogos} />
                <Button className="w-full cursor-pointer" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                  {isPending ? "Actualizando Información" : "Actualizar"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
