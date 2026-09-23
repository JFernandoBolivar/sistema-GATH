"use client";

/**
 * Página "Agregar Familiar" (`/familiares/registrar`): ruta propia de alta,
 * paridad con el legado (`familiares/agregar-familiar/page.tsx`), que en la
 * arquitectura anterior vivía separada de "Consultar Familiar" en vez de
 * como diálogo inline. Cliente + react-hook-form + zodResolver; la mutación
 * va envuelta en useTransition (R8) y se delega a la Server Action del
 * módulo (R7). Opera exclusivamente con DTOs (R5) y no importa de
 * `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import type { CatalogosFamiliarDTO, GuardarFamiliarInputDTO } from "../application/dtos/familiar-dto";
import { crearFamiliarAction, getCatalogosFamiliarAction } from "../infrastructure/actions/familiares-actions";
import { familiarSchema, type FamiliarFormType } from "./schema/schema-familiar";
import { FamiliarCampos } from "./familiar-campos";

const defaultValues: FamiliarFormType = {
  empleadoCedula: "",
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

export default function FamiliarRegistrarPage() {
  const router = useRouter();
  const [catalogos, setCatalogos] = useState<CatalogosFamiliarDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalogosFamiliarAction().then(setCatalogos).catch(() => setCatalogos({ parentescos: [], sexos: [] }));
  }, []);

  const form = useForm<FamiliarFormType>({
    resolver: zodResolver(familiarSchema),
    defaultValues,
  });

  const onGuardar = (data: FamiliarFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = await crearFamiliarAction(data as GuardarFamiliarInputDTO);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      router.push("/familiares/consultar");
    });
  };

  return (
    <PageLayout title="Agregar Familiar" description="Registre los familiares del empleado">
      <div className="flex flex-col gap-4 mt-2">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Datos del familiar</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-6" noValidate>
              <Field data-invalid={!!form.formState.errors.empleadoCedula}>
                <Label htmlFor="empleadoCedula">Cédula del empleado</Label>
                <Input id="empleadoCedula" placeholder="Ej. 12345678" {...form.register("empleadoCedula")} aria-invalid={!!form.formState.errors.empleadoCedula} />
                {form.formState.errors.empleadoCedula && <p role="alert" className="text-sm text-destructive">{form.formState.errors.empleadoCedula.message}</p>}
              </Field>

              <FamiliarCampos form={form} catalogos={catalogos} />

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
                  Crear
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/familiares/consultar")}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
