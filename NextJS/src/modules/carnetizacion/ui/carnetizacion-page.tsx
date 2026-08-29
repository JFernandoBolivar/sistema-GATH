"use client";

/**
 * Página de carnetización: listado/emisión, validación y plantillas.
 * Cliente + react-hook-form + zodResolver; las acciones van envueltas en
 * useTransition (R8) y se delegan a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, FileDown, IdCard, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";

import type { CarnetDTO, PlantillaCarnetDTO, ValidacionCarnetDTO } from "../application/dtos/carnet-dto";
import {
  activarPlantillaCarnetAction,
  descargarPdfCarnetAction,
  emitirCarnetAction,
  getCarnetsAction,
  getPlantillasCarnetAction,
  validarCarnetPorHashAction,
  validarCarnetPorIdAction,
} from "../infrastructure/actions/carnetizacion-actions";
import {
  emitirCarnetSchema,
  type EmitirCarnetFormType,
  validarHashSchema,
  type ValidarHashFormType,
} from "./schema/schema-carnet";

type Tab = "listado" | "validar" | "plantillas";

export default function CarnetizacionPage() {
  const [tab, setTab] = useState<Tab>("listado");
  const [carnets, setCarnets] = useState<CarnetDTO[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaCarnetDTO[]>([]);
  const [validacion, setValidacion] = useState<ValidacionCarnetDTO | null>(null);
  const [busqueda, setBusqueda] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const emisionForm = useForm<EmitirCarnetFormType>({
    resolver: zodResolver(emitirCarnetSchema),
    defaultValues: { empleadoCedula: "", observaciones: "" },
  });

  const validarForm = useForm<ValidarHashFormType>({
    resolver: zodResolver(validarHashSchema),
    defaultValues: { securityHash: "" },
  });

  const cargarCarnets = (cedula?: string) => {
    startTransition(async () => {
      setError(null);
      try {
        setCarnets(await getCarnetsAction(cedula));
      } catch {
        setError("No fue posible cargar los carnets.");
      }
    });
  };

  useEffect(() => {
    cargarCarnets();
    startTransition(async () => {
      try {
        setPlantillas(await getPlantillasCarnetAction());
      } catch {
        /* plantillas opcionales */
      }
    });
  }, []);

  const onEmitir = (data: EmitirCarnetFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = await emitirCarnetAction(data.empleadoCedula, data.motivoId, data.observaciones);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      emisionForm.reset({ empleadoCedula: "", observaciones: "" });
      cargarCarnets(busqueda);
    });
  };

  const onEmitidoSet = (empleadoCedula: string) => {
    emisionForm.setValue("empleadoCedula", empleadoCedula);
  };

  const onValidar = (data: ValidarHashFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = await validarCarnetPorHashAction(data.securityHash);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setValidacion(resultado as ValidacionCarnetDTO);
    });
  };

  const onValidarPorId = (carnetId: number) => {
    startTransition(async () => {
      setError(null);
      const resultado = await validarCarnetPorIdAction(carnetId);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setValidacion(resultado as ValidacionCarnetDTO);
    });
  };

  const onActivarPlantilla = (plantillaId: number) => {
    startTransition(async () => {
      setError(null);
      const resultado = await activarPlantillaCarnetAction(plantillaId);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setPlantillas(await getPlantillasCarnetAction());
    });
  };

  const onDescargar = (carnetId: number) => {
    startTransition(async () => {
      setError(null);
      const blob = await descargarPdfCarnetAction(carnetId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carnet-${carnetId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <IdCard className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Carnetización</h1>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="listado">Carnets</TabsTrigger>
          <TabsTrigger value="validar">Validar</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
        </TabsList>

        <TabsContent value="listado">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Emitir / listar</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={emisionForm.handleSubmit(onEmitir)} className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end" noValidate>
                <Field data-invalid={!!emisionForm.formState.errors.empleadoCedula}>
                  <Label htmlFor="empleadoCedula">Cédula del empleado</Label>
                  <Input id="empleadoCedula" placeholder="Ej. 12345678" {...emisionForm.register("empleadoCedula")} aria-invalid={!!emisionForm.formState.errors.empleadoCedula} />
                </Field>
                <Field data-invalid={!!emisionForm.formState.errors.motivoId}>
                  <Label htmlFor="motivoId">Motivo (id)</Label>
                  <Input type="number" id="motivoId" {...emisionForm.register("motivoId", { valueAsNumber: true })} aria-invalid={!!emisionForm.formState.errors.motivoId} />
                </Field>
                <Field>
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Input id="observaciones" {...emisionForm.register("observaciones")} />
                </Field>
                <div className="md:col-span-3">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <IdCard className="size-4" aria-hidden="true" />}
                    Emitir
                  </Button>
                </div>
              </form>

              <form onSubmit={(e) => { e.preventDefault(); cargarCarnets(busqueda); }} className="flex items-end gap-2">
                <Field>
                  <Label htmlFor="busqueda">Buscar por cédula</Label>
                  <Input id="busqueda" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Cédula (opcional)" />
                </Field>
                <Button type="submit" variant="outline" disabled={isPending}>Buscar</Button>
              </form>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Emisión</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carnets.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">Sin carnets.</TableCell></TableRow>
                    ) : (
                      carnets.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.empleadoCedula}</TableCell>
                          <TableCell>{c.empleadoNombres} {c.empleadoApellidos}</TableCell>
                          <TableCell>{c.motivoNombre}</TableCell>
                          <TableCell>{c.fechaEmision}</TableCell>
                          <TableCell><Badge variant={c.activo ? "default" : "outline"}>{c.activo ? "Activo" : "Revocado"}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => onDescargar(c.id)} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => { onEmitidoSet(c.empleadoCedula); setTab("validar"); }} disabled={isPending}><ShieldCheck className="size-4" aria-hidden="true" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validar">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Validar carnet</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form onSubmit={validarForm.handleSubmit(onValidar)} className="flex flex-col gap-4" noValidate>
                  <Field data-invalid={!!validarForm.formState.errors.securityHash}>
                    <Label htmlFor="securityHash">Hash de seguridad</Label>
                    <Input id="securityHash" placeholder="Hash del carnet" {...validarForm.register("securityHash")} aria-invalid={!!validarForm.formState.errors.securityHash} />
                  </Field>
                  <div>
                    <Button type="submit" disabled={isPending}>
                      <BadgeCheck className="size-4" aria-hidden="true" /> Validar por hash
                    </Button>
                  </div>
                </form>
                <div className="flex flex-col gap-2">
                  <Label>Validar por id</Label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem("carnetId") as HTMLInputElement;
                      onValidarPorId(Number(input.value));
                    }}
                    className="flex items-end gap-2"
                  >
                    <Input name="carnetId" type="number" placeholder="Id del carnet" />
                    <Button type="submit" variant="outline" disabled={isPending}>Validar</Button>
                  </form>
                </div>
              </div>

              {validacion && (
                <div className="rounded-lg border p-4">
                  <p className={`text-sm font-medium ${validacion.esValido ? "text-emerald-600" : "text-destructive"}`}>
                    {validacion.mensaje}
                  </p>
                  {validacion.carnet && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {validacion.carnet.empleadoNombres} {validacion.carnet.empleadoApellidos} — {validacion.carnet.motivoNombre}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plantillas">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Imagen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plantillas.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">Sin plantillas.</TableCell></TableRow>
                ) : (
                  plantillas.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell>{p.imagenUrl ?? "—"}</TableCell>
                      <TableCell><Badge variant={p.activo ? "default" : "outline"}>{p.activo ? "Activa" : "Inactiva"}</Badge></TableCell>
                      <TableCell>
                        {!p.activo && (
                          <Button variant="outline" size="sm" onClick={() => onActivarPlantilla(p.id)} disabled={isPending}>Activar</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
