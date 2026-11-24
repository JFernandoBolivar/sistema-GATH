"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MENSAJE_RIF_INVALIDO, normalizarRif } from "@/shared/domain/validation/rif";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import { actualizarRifAction } from "../../infrastructure/actions/personal-actions";

interface FormRifUpdateDialogProps {
  cedula: string;
  rif: string | null | undefined;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

/** RR. HH. corrige el RIF del trabajador. Vacío lo borra; si se escribe debe tener el formato V-12345678-9. */
export default function FormRifUpdateDialog({
  cedula,
  rif,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: FormRifUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(rif ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const alCambiarApertura = (abierto: boolean) => {
    if (abierto) {
      setValor(rif ?? "");
      setError(null);
    }
    setOpen(abierto);
  };

  const guardar = () => {
    if (normalizarRif(valor) === null) {
      setError(MENSAJE_RIF_INVALIDO);
      return;
    }
    startTransition(async () => {
      setError(null);
      const resultado = await actualizarRifAction(cedula, valor);
      if (resultado && "error" in resultado) {
        setError(resultado.error);
        toast.error(resultado.error);
        return;
      }
      toast.success("RIF actualizado exitosamente");
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
          <DialogTitle>RIF del trabajador</DialogTitle>
          <DialogDescription>
            Una letra (V, E, J, P o G), el número y el dígito verificador. Déjelo vacío para borrarlo.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded bg-red-100 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="rif-trabajador">RIF</Label>
          <Input
            id="rif-trabajador"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="V-12345678-9"
            maxLength={14}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>

        <Button type="button" className="w-full cursor-pointer" disabled={isPending} onClick={guardar}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Actualizando Información" : "Guardar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
