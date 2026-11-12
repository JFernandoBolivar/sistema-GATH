"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Label } from "@/shared/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/components/radio-group";

import { actualizarTieneHijosAction } from "../../infrastructure/actions/personal-actions";

interface FormTieneHijosUpdateDialogProps {
  cedula: string;
  tieneHijos: boolean | null | undefined;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

type Opcion = "si" | "no" | "";

function aOpcion(valor: boolean | null | undefined): Opcion {
  if (valor === true) return "si";
  if (valor === false) return "no";
  return "";
}

export default function FormTieneHijosUpdateDialog({
  cedula,
  tieneHijos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: FormTieneHijosUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [opcion, setOpcion] = useState<Opcion>(aOpcion(tieneHijos));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const alCambiarApertura = (abierto: boolean) => {
    if (abierto) {
      setOpcion(aOpcion(tieneHijos));
      setError(null);
    }
    setOpen(abierto);
  };

  const guardar = () => {
    if (!opcion) {
      setError("Seleccione Sí o No.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const resultado = await actualizarTieneHijosAction(cedula, opcion === "si");
      if (resultado && "error" in resultado) {
        setError(resultado.error);
        toast.error(resultado.error);
        return;
      }
      toast.success("Dato actualizado exitosamente");
      setOpen(false);
      onGuardado();
    });
  };

  return (
    <Dialog open={open} onOpenChange={alCambiarApertura}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Tiene hijos?</DialogTitle>
          <DialogDescription>Indique si el trabajador tiene hijos.</DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded bg-red-100 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <RadioGroup
          value={opcion}
          onValueChange={(v) => setOpcion(v as Opcion)}
          className="flex flex-row gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="si" id="tiene-hijos-si" />
            <Label htmlFor="tiene-hijos-si">Sí</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id="tiene-hijos-no" />
            <Label htmlFor="tiene-hijos-no">No</Label>
          </div>
        </RadioGroup>

        <Button type="button" className="w-full cursor-pointer" disabled={isPending} onClick={guardar}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Actualizando Información" : "Guardar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
