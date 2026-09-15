"use client";

/**
 * Página de carnetización: listado/emisión, validación y plantillas.
 * Cliente + react-hook-form + zodResolver; las acciones van envueltas en
 * useTransition (R8) y se delegan a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, BarChart3, IdCard, Loader2, Upload } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { DataTable } from "@/shared/ui/components/data-table";
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

import type { CarnetDTO, EstadisticasCarnetDTO, PlantillaCarnetDTO, ValidacionCarnetDTO } from "../application/dtos/carnet-dto";
import {
  activarPlantillaCarnetAction,
  descargarPdfCarnetAction,
  emitirCarnetAction,
  getCarnetsAction,
  getEstadisticasCarnetsAction,
  getPlantillasCarnetAction,
  revocarCarnetAction,
  subirPlantillaCarnetAction,
  validarCarnetPorHashAction,
  validarCarnetPorIdAction,
} from "../infrastructure/actions/carnetizacion-actions";
import {
  emitirCarnetSchema,
  type EmitirCarnetFormType,
  validarHashSchema,
  type ValidarHashFormType,
} from "./schema/schema-carnet";
import { DisenadorCarnet } from "./components/disenador-carnet";
import { construirColumnasCarnets } from "./carnetizacion-columnas";

type Tab = "disenador" | "listado" | "validar" | "plantillas" | "estadisticas";

export default function CarnetizacionPage() {
  const [tab, setTab] = useState<Tab>("disenador");
  const [carnets, setCarnets] = useState<CarnetDTO[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaCarnetDTO[]>([]);
  const [validacion, setValidacion] = useState<ValidacionCarnetDTO | null>(null);
  const [estadisticas, setEstadisticas] = useState<EstadisticasCarnetDTO | null>(null);
  const [busqueda, setBusqueda] = useState<string>("");
  const [cedulaParaDiseno, setCedulaParaDiseno] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nombrePlantilla = useRef<HTMLInputElement>(null);
  const archivoPlantilla = useRef<HTMLInputElement>(null);
  const [activarPlantilla, setActivarPlantilla] = useState(false);

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
      try {
        setEstadisticas(await getEstadisticasCarnetsAction());
      } catch {
        /* estadísticas opcionales */
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

  const onSubirPlantilla = (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = nombrePlantilla.current?.value?.trim();
    const imagen = archivoPlantilla.current?.files?.[0];
    if (!nombre || !imagen) {
      setError("Complete el nombre y seleccione una imagen.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const resultado = await subirPlantillaCarnetAction(nombre, imagen, activarPlantilla);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      if (nombrePlantilla.current) nombrePlantilla.current.value = "";
      if (archivoPlantilla.current) archivoPlantilla.current.value = "";
      setActivarPlantilla(false);
      setPlantillas(await getPlantillasCarnetAction());
    });
  };

  const onDescargar = (carnetId: number) => {
    startTransition(async () => {
      setError(null);
      const resultado = await descargarPdfCarnetAction(carnetId);
      if (!(resultado instanceof Blob)) {
        setError((resultado as { error: string }).error ?? "No fue posible descargar el carnet.");
        return;
      }
      const url = window.URL.createObjectURL(resultado);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carnet-${carnetId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const onAbrirDisenador = (cedula: string) => {
    setCedulaParaDiseno(cedula);
    setTab("disenador");
  };

  const onValidarDesdeListado = (cedula: string) => {
    onEmitidoSet(cedula);
    setTab("validar");
  };

  const onRevocar = (carnetId: number) => {
    startTransition(async () => {
      setError(null);
      const resultado = await revocarCarnetAction(carnetId);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      cargarCarnets(busqueda);
    });
  };

  const columnasCarnets = construirColumnasCarnets(onAbrirDisenador, onDescargar, onValidarDesdeListado, onRevocar);

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <IdCard className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Carnetización</h1>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="disenador">Diseñador / Emitir</TabsTrigger>
          <TabsTrigger value="listado">Carnets</TabsTrigger>
          <TabsTrigger value="validar">Validar</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
          <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="disenador">
          <DisenadorCarnet
            plantillas={plantillas}
            initialCedula={cedulaParaDiseno}
            onCarnetEmitido={() => {
              cargarCarnets();
            }}
          />
        </TabsContent>

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

              <DataTable
                columns={columnasCarnets}
                data={carnets}
                emptyMessage="Sin carnets."
                toolbar={
                  <form onSubmit={(e) => { e.preventDefault(); cargarCarnets(busqueda); }} className="flex items-end gap-2">
                    <Field>
                      <Label htmlFor="busqueda" className="sr-only">Buscar por cédula</Label>
                      <Input id="busqueda" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Cédula (opcional)" />
                    </Field>
                    <Button type="submit" variant="outline" disabled={isPending}>Buscar</Button>
                  </form>
                }
              />
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
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Subir plantilla</CardTitle>
              <CardDescription>Registra una nueva plantilla de carnet.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubirPlantilla} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-end" noValidate>
                <Field>
                  <Label htmlFor="nombrePlantilla">Nombre</Label>
                  <Input id="nombrePlantilla" ref={nombrePlantilla} placeholder="Ej. Plantilla institucional" />
                </Field>
                <Field>
                  <Label htmlFor="imagenPlantilla">Imagen</Label>
                  <Input id="imagenPlantilla" ref={archivoPlantilla} type="file" accept="image/*" />
                </Field>
                <div className="flex items-center gap-2 md:col-span-2">
                  <Checkbox id="activarPlantilla" checked={activarPlantilla} onCheckedChange={(c) => setActivarPlantilla(c === true)} />
                  <Label htmlFor="activarPlantilla">Activar</Label>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
                    Subir
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

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

        <TabsContent value="estadisticas">
          {isPending && !estadisticas ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : !estadisticas ? (
            <p className="text-sm text-muted-foreground">No fue posible cargar las estadísticas.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card><CardContent className="flex flex-col gap-1 p-4"><span className="text-sm text-muted-foreground">Total emitidos</span><span className="text-2xl font-semibold">{estadisticas.total}</span></CardContent></Card>
                <Card><CardContent className="flex flex-col gap-1 p-4"><span className="text-sm text-muted-foreground">Activos</span><span className="text-2xl font-semibold">{estadisticas.activos}</span></CardContent></Card>
                <Card><CardContent className="flex flex-col gap-1 p-4"><span className="text-sm text-muted-foreground">Revocados</span><span className="text-2xl font-semibold">{estadisticas.revocados}</span></CardContent></Card>
                <Card><CardContent className="flex flex-col gap-1 p-4"><span className="text-sm text-muted-foreground">Emitidos hoy</span><span className="text-2xl font-semibold">{estadisticas.emitidosHoy}</span></CardContent></Card>
                <Card><CardContent className="flex flex-col gap-1 p-4"><span className="text-sm text-muted-foreground">Emitidos este mes</span><span className="text-2xl font-semibold">{estadisticas.emitidosMes}</span></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="size-4" aria-hidden="true" /> Emisiones por motivo</CardTitle>
                  <CardDescription>Distribución de carnets emitidos según su motivo.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {estadisticas.porMotivo.length === 0 ? (
                          <TableRow><TableCell colSpan={2} className="h-16 text-center text-muted-foreground">Sin datos por motivo.</TableCell></TableRow>
                        ) : (
                          estadisticas.porMotivo.map((m) => (
                            <TableRow key={m.motivoId}>
                              <TableCell className="font-medium">{m.motivo}</TableCell>
                              <TableCell>{m.total}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
