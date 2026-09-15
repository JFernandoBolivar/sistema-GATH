"use client";

/**
 * Página de alta de un código de posición vacante, en ruta propia
 * (`/cargos/crear-codigo`), paridad estructural con `cargos/crear-codigo/`
 * del legado (`CodigoCatalogForm`): denominación + específica + tipo de
 * nómina + grado + organismo adscrito + cascada de ubicación administrativa
 * (dependencia → dirección general → línea → coordinación, cada nivel
 * opcional y solo visible si el anterior tiene selección).
 *
 * Cliente + react-hook-form + zodResolver + useTransition (R8); delega a la
 * Server Action del módulo (R7). Opera exclusivamente con DTOs (R5) y no
 * importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Textarea } from "@/shared/ui/components/textarea";

import type { CatalogoCargoItemDTO, DenominacionCargoDTO, UnidadOrganizativaCargoDTO } from "../application/dtos/cargo-dto";
import {
  crearCargoAction,
  getCoordinacionesAction,
  getDependenciasAction,
  getDenominacionesAction,
  getDenominacionesEspecificasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getGradosAction,
  getOrganismosAdscritosAction,
  getTiposNominaAction,
} from "../infrastructure/actions/cargos-actions";
import { crearCargoSchema, type CrearCargoFormType } from "./schema/schema-asignar-cargo";

function OpcionesSelect<T extends { id: number; nombre: string }>({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  id: string;
  value: number | undefined;
  onChange: (v: number) => void;
  options: T[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>{o.nombre}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function CargoCrearPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [denominaciones, setDenominaciones] = useState<DenominacionCargoDTO[]>([]);
  const [especificas, setEspecificas] = useState<DenominacionCargoDTO[]>([]);
  const [tiposNomina, setTiposNomina] = useState<CatalogoCargoItemDTO[]>([]);
  const [grados, setGrados] = useState<CatalogoCargoItemDTO[]>([]);
  const [organismos, setOrganismos] = useState<CatalogoCargoItemDTO[]>([]);
  const [dependencias, setDependencias] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesGenerales, setDireccionesGenerales] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesLinea, setDireccionesLinea] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  const form = useForm<CrearCargoFormType>({
    resolver: zodResolver(crearCargoSchema),
    defaultValues: {},
  });

  useEffect(() => {
    startTransition(async () => {
      try {
        const [denoms, esps, nominas, gradosList, organismosList, deps] = await Promise.all([
          getDenominacionesAction(),
          getDenominacionesEspecificasAction(),
          getTiposNominaAction(),
          getGradosAction(),
          getOrganismosAdscritosAction(),
          getDependenciasAction(),
        ]);
        setDenominaciones(denoms);
        setEspecificas(esps);
        setTiposNomina(nominas);
        setGrados(gradosList);
        setOrganismos(organismosList);
        setDependencias(deps);
      } catch {
        setError("No fue posible cargar los catálogos.");
      } finally {
        setCargandoCatalogos(false);
      }
    });
  }, []);

  const dependenciaId = form.watch("dependenciaId");
  const direccionGeneralId = form.watch("direccionGeneralId");
  const direccionLineaId = form.watch("direccionLineaId");

  useEffect(() => {
    if (!dependenciaId) {
      setDireccionesGenerales([]);
      return;
    }
    startTransition(async () => {
      setDireccionesGenerales(await getDireccionesGeneralesAction(dependenciaId));
    });
  }, [dependenciaId]);

  useEffect(() => {
    if (!direccionGeneralId) {
      setDireccionesLinea([]);
      return;
    }
    startTransition(async () => {
      setDireccionesLinea(await getDireccionesLineaAction(direccionGeneralId));
    });
  }, [direccionGeneralId]);

  useEffect(() => {
    if (!direccionLineaId) {
      setCoordinaciones([]);
      return;
    }
    startTransition(async () => {
      setCoordinaciones(await getCoordinacionesAction(direccionLineaId));
    });
  }, [direccionLineaId]);

  const onSubmit = (data: CrearCargoFormType) => {
    startTransition(async () => {
      setError(null);
      const result = await crearCargoAction(data);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      router.push("/cargos");
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Crear nuevo código</h1>
        <p className="text-sm text-muted-foreground">Cree un nuevo código de posición vacante con sus atributos de cargo, ubicación y nómina.</p>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Registrar código de posición</CardTitle>
          <CardDescription>Ingrese los datos del nuevo código y sus atributos asociados.</CardDescription>
        </CardHeader>
        <CardContent>
          {cargandoCatalogos ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field data-invalid={!!form.formState.errors.denominacionId}>
                  <Label htmlFor="denominacionId">Denominación de cargo</Label>
                  <OpcionesSelect
                    id="denominacionId"
                    value={form.watch("denominacionId")}
                    onChange={(v) => form.setValue("denominacionId", v)}
                    options={denominaciones}
                    placeholder="Seleccione una denominación de cargo"
                  />
                  {form.formState.errors.denominacionId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.denominacionId.message}</p>}
                </Field>
                <Field data-invalid={!!form.formState.errors.especificaId}>
                  <Label htmlFor="especificaId">Denominación de cargo específico</Label>
                  <OpcionesSelect
                    id="especificaId"
                    value={form.watch("especificaId")}
                    onChange={(v) => form.setValue("especificaId", v)}
                    options={especificas}
                    placeholder="Seleccione una denominación específica"
                  />
                  {form.formState.errors.especificaId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.especificaId.message}</p>}
                </Field>
                <Field data-invalid={!!form.formState.errors.tipoNominaId}>
                  <Label htmlFor="tipoNominaId">Tipo de nómina</Label>
                  <OpcionesSelect
                    id="tipoNominaId"
                    value={form.watch("tipoNominaId")}
                    onChange={(v) => form.setValue("tipoNominaId", v)}
                    options={tiposNomina}
                    placeholder="Seleccione un tipo de nómina"
                  />
                  {form.formState.errors.tipoNominaId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.tipoNominaId.message}</p>}
                </Field>
                <Field>
                  <Label htmlFor="gradoId">Grado (opcional)</Label>
                  <OpcionesSelect
                    id="gradoId"
                    value={form.watch("gradoId")}
                    onChange={(v) => form.setValue("gradoId", v)}
                    options={grados}
                    placeholder="Seleccione un grado"
                  />
                </Field>
                <Field className="md:col-span-2">
                  <Label htmlFor="organismoId">Organismo adscrito (opcional)</Label>
                  <OpcionesSelect
                    id="organismoId"
                    value={form.watch("organismoId")}
                    onChange={(v) => form.setValue("organismoId", v)}
                    options={organismos}
                    placeholder="Seleccione un organismo adscrito"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <Label htmlFor="dependenciaId">Dependencia (opcional)</Label>
                  <OpcionesSelect
                    id="dependenciaId"
                    value={dependenciaId}
                    onChange={(v) => {
                      form.setValue("dependenciaId", v);
                      form.setValue("direccionGeneralId", undefined);
                      form.setValue("direccionLineaId", undefined);
                      form.setValue("coordinacionId", undefined);
                    }}
                    options={dependencias}
                    placeholder="Seleccione una dependencia"
                  />
                </Field>
                {dependenciaId && direccionesGenerales.length > 0 && (
                  <Field>
                    <Label htmlFor="direccionGeneralId">Dirección / Gerencia / Oficina (opcional)</Label>
                    <OpcionesSelect
                      id="direccionGeneralId"
                      value={direccionGeneralId}
                      onChange={(v) => {
                        form.setValue("direccionGeneralId", v);
                        form.setValue("direccionLineaId", undefined);
                        form.setValue("coordinacionId", undefined);
                      }}
                      options={direccionesGenerales}
                      placeholder="Seleccione una dirección"
                    />
                  </Field>
                )}
                {direccionGeneralId && direccionesLinea.length > 0 && (
                  <Field>
                    <Label htmlFor="direccionLineaId">División / Coordinación de línea (opcional)</Label>
                    <OpcionesSelect
                      id="direccionLineaId"
                      value={direccionLineaId}
                      onChange={(v) => {
                        form.setValue("direccionLineaId", v);
                        form.setValue("coordinacionId", undefined);
                      }}
                      options={direccionesLinea}
                      placeholder="Seleccione una dirección de línea"
                    />
                  </Field>
                )}
                {direccionLineaId && coordinaciones.length > 0 && (
                  <Field>
                    <Label htmlFor="coordinacionId">Coordinación (opcional)</Label>
                    <OpcionesSelect
                      id="coordinacionId"
                      value={form.watch("coordinacionId")}
                      onChange={(v) => form.setValue("coordinacionId", v)}
                      options={coordinaciones}
                      placeholder="Seleccione una coordinación"
                    />
                  </Field>
                )}
              </div>

              <Field>
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <Textarea id="observaciones" {...form.register("observaciones")} />
              </Field>

              <div>
                <Button type="submit" disabled={isPending} className="w-full md:w-auto">
                  {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                  Crear nuevo código
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
