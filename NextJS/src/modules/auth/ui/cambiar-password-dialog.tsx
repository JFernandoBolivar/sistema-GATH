"use client";

/**
 * Diálogo de cambio de contraseña obligatorio (`session.user.debeCambiarPassword`).
 * Extraído de `app/(app)/inicio/page.tsx` (donde vivía inline junto con el
 * resto del home) hacia `modules/auth/ui/` para que la página de inicio sea
 * un wrapper delgado (R10) y el componente use los primitivos de
 * `@/shared/ui/components` en vez de la ruta legada `@/components/ui/*`.
 * Mismo patrón que el legado (`(protected)/dashboard/page.tsx`): un diálogo
 * no descartable montado en la página de inicio, sin ruta propia.
 */
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import { cambiarPasswordAction } from "../infrastructure/actions/auth-actions";
import {
  cambiarPasswordFormSchema,
  type CambiarPasswordFormType,
} from "./schema/schema-cambiar-password";

interface CambiarPasswordDialogProps {
  open: boolean;
  onCambiada: () => void;
}

export default function CambiarPasswordDialog({ open, onCambiada }: CambiarPasswordDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CambiarPasswordFormType>({
    resolver: zodResolver(cambiarPasswordFormSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const onSubmit = (data: CambiarPasswordFormType) => {
    startTransition(async () => {
      const response = await cambiarPasswordAction(data);
      if (response.success) {
        onCambiada();
      } else {
        form.setError("current_password", {
          message: response.message || "Error al cambiar la contraseña",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Cambiar Contraseña</DialogTitle>
          <DialogDescription>
            Debe cambiar su contraseña para continuar. Esta es una medida de seguridad obligatoria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Controller
            name="current_password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Label htmlFor="current_password">Contraseña Actual</Label>
                <Input {...field} id="current_password" type="password" placeholder="••••••••" aria-invalid={fieldState.invalid} />
                {fieldState.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </Field>
            )}
          />
          <Controller
            name="new_password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Label htmlFor="new_password">Nueva Contraseña</Label>
                <Input {...field} id="new_password" type="password" placeholder="••••••••" aria-invalid={fieldState.invalid} />
                {fieldState.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </Field>
            )}
          />
          <Controller
            name="confirm_password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Label htmlFor="confirm_password">Confirmar Contraseña</Label>
                <Input {...field} id="confirm_password" type="password" placeholder="••••••••" aria-invalid={fieldState.invalid} />
                {fieldState.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </Field>
            )}
          />
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {isPending ? "Cambiando..." : "Cambiar Contraseña"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
