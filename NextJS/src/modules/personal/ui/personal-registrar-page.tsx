"use client";

/**
 * Página de alta de personal — ruta propia `/personal/registrar`, paridad
 * estructural con el legado (`gestion-trabajadores/personal-trabajador/registrar/`
 * era una ruta separada del listado). El listado (`personal-page.tsx`) ya no
 * incrusta el formulario de alta inline. Cliente + react-hook-form +
 * zodResolver; la mutación va envuelta en useTransition (R8) y se delega a
 * la Server Action del módulo (R7). Opera exclusivamente con DTOs (R5) y no
 * importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";

import type { CatalogosExpedienteDTO, GuardarEmpleadoInputDTO } from "../application/dtos/empleado-dto";
import { getCatalogosExpedienteAction, registrarEmpleadoAction } from "../infrastructure/actions/personal-actions";
import { ExpedienteCampos } from "./expediente-campos";
import { empleadoSchema, type EmpleadoFormType } from "./schema/schema-empleado";

const defaultExpediente: Partial<EmpleadoFormType> = {
  cedula: "",
  nombres: "",
  apellidos: "",
  fechaNacimiento: "",
  correo: "",
  telefonoMovil: "",
  telefonoHabitacion: "",
  carnetPatria: "",
  datosVivienda: {
    estadoId: undefined,
    municipioId: undefined,
    parroquiaId: undefined,
    direccionExacta: "",
    condicionViviendaId: undefined,
    codigoPostalId: undefined,
  },
  perfilSalud: { grupoSanguineoId: undefined, alergias: [], patologiasCronicas: [], discapacidades: [] },
  perfilFisico: { tallaCamisaId: undefined, tallaPantalonId: undefined, tallaZapatosId: undefined, tallaChaquetaId: undefined },
  formacionAcademica: [],
  formacionComplementaria: [],
  contactoEmergencia: [],
  antecedentes: [],
  contrato: [],
};

export default function PersonalRegistrarPage() {
  const router = useRouter();
  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EmpleadoFormType>({ resolver: zodResolver(empleadoSchema), defaultValues: defaultExpediente as EmpleadoFormType });

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      try {
        setCatalogos(await getCatalogosExpedienteAction());
      } catch {
        setError("No fue posible cargar los catálogos del expediente.");
      }
    });
  }, []);

  const onGuardar = (data: EmpleadoFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = await registrarEmpleadoAction(data as unknown as GuardarEmpleadoInputDTO);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      router.push("/personal");
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <UserPlus className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Registrar empleado</h1>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Expediente del nuevo trabajador</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-6" noValidate>
            <ExpedienteCampos form={form} catalogos={catalogos} isPending={isPending} />
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
                Registrar
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/personal")}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
