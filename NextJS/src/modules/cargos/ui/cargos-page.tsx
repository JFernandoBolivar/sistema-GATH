"use client";

/**
 * Página de cargos: listado de códigos de posición (DataTable + Sheet de
 * detalle con las acciones operativas embebidas, paridad con
 * `listado-codigo/tableCodeInfo` del legado), préstamos de cargo
 * (encargadurías) y CRUD de denominaciones. El alta de un código nuevo
 * vive en su propia ruta (`/cargos/crear-codigo`, paridad con
 * `cargos/crear-codigo/` del legado) en vez de un formulario inline.
 *
 * Nota de alcance: préstamos y denominaciones se mantienen como pestañas
 * de esta misma página — son funcionalidad real y probada de
 * `apps.cargos` que no tiene una ruta equivalente identificada en el
 * legado explorado; se prioriza no perder capacidad funcional existente
 * sobre inventar una ubicación nueva.
 *
 * Cliente + react-hook-form + zodResolver; las acciones van envueltas en
 * useTransition (R8) y se delegan a las Server Actions del módulo (R7).
 * Opera exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Briefcase, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
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

import type {
  CargoAsignacionDTO,
  DenominacionCargoDTO,
  PrestamoCargoDTO,
} from "../application/dtos/cargo-dto";
import {
  actualizarDenominacionAction,
  asignarCargoAction,
  cambiarCargoAction,
  crearDenominacionAction,
  crearPrestamoAction,
  desasignarCargoAction,
  eliminarDenominacionAction,
  finalizarPrestamoAction,
  gestionarEstatusAction,
  getCargosAction,
  getDenominacionesAction,
  getEstatusAction,
  getMotivosAction,
  getPrestamosAction,
} from "../infrastructure/actions/cargos-actions";
import CargoDetalleSheet from "./cargo-detalle-sheet";
import { construirColumnasCargos } from "./cargos-columns";
import {
  cargosFiltroSchema,
  crearPrestamoSchema,
  denominacionSchema,
  type CargosFiltroFormType,
  type CrearPrestamoFormType,
  type DenominacionFormType,
} from "./schema/schema-asignar-cargo";

export default function CargosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrearCodigo = tienePermiso(permisos, "cargos.crear");
  const puedeVerDetalle = tienePermiso(permisos, "cargos.ver");
  const puedeAsignar = tienePermiso(permisos, "cargos.asignar");
  const puedePrestar = tienePermiso(permisos, "cargos.prestar");
  const puedeRevertirPrestamo = tienePermiso(permisos, "cargos.revertir_prestamo");
  const puedeCrearDenominacion = tienePermiso(permisos, "cargos.crear");
  const puedeEditarDenominacion = tienePermiso(permisos, "cargos.editar");
  const puedeEliminarDenominacion = tienePermiso(permisos, "cargos.desincorporar");

  const [cargos, setCargos] = useState<CargoAsignacionDTO[]>([]);
  const [prestamos, setPrestamos] = useState<PrestamoCargoDTO[]>([]);
  const [denominaciones, setDenominaciones] = useState<DenominacionCargoDTO[]>([]);
  const [motivos, setMotivos] = useState<{ id: number; nombre: string }[]>([]);
  const [estatus, setEstatus] = useState<{ id: number; nombre: string }[]>([]);
  const [editandoDenominacion, setEditandoDenominacion] = useState<number | null>(null);
  const [viendoDetalleId, setViendoDetalleId] = useState<number | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtroForm = useForm<CargosFiltroFormType>({
    resolver: zodResolver(cargosFiltroSchema),
    defaultValues: {},
  });

  const prestamoForm = useForm<CrearPrestamoFormType>({
    resolver: zodResolver(crearPrestamoSchema),
    defaultValues: { fechaInicio: "", fechaFin: "" },
  });

  const denominacionForm = useForm<DenominacionFormType>({
    resolver: zodResolver(denominacionSchema),
    defaultValues: { orden: 30 },
  });

  const cargarCargos = (filtros?: { dependenciaId?: number; soloVacantes?: boolean }) => {
    startTransition(async () => {
      setError(null);
      try {
        setCargos(await getCargosAction(filtros));
      } catch {
        setError("No fue posible cargar los cargos.");
      }
    });
  };

  const cargarPrestamos = () => {
    startTransition(async () => {
      setError(null);
      try {
        setPrestamos(await getPrestamosAction());
      } catch {
        setError("No fue posible cargar los préstamos.");
      }
    });
  };

  const cargarDenominaciones = () => {
    startTransition(async () => {
      setError(null);
      try {
        setDenominaciones(await getDenominacionesAction());
      } catch {
        setError("No fue posible cargar las denominaciones.");
      }
    });
  };

  useEffect(() => {
    cargarCargos();
    cargarPrestamos();
    startTransition(async () => {
      try {
        const [denoms, motivosList, estatusList] = await Promise.all([
          getDenominacionesAction(),
          getMotivosAction(),
          getEstatusAction(),
        ]);
        setDenominaciones(denoms);
        setMotivos(motivosList);
        setEstatus(estatusList);
      } catch {
        setError("No fue posible cargar catálogos auxiliares.");
      }
    });
  }, []);

  const onFiltro = (data: CargosFiltroFormType) => {
    cargarCargos({ dependenciaId: data.dependenciaId ?? undefined, soloVacantes: data.soloVacantes });
  };

  const cargoSeleccionado = cargos.find((c) => c.id === viendoDetalleId) ?? null;

  const onVerDetalle = (cargoId: number) => {
    setViendoDetalleId(cargoId);
    setDetalleAbierto(true);
  };

  const onAsignar = (empleadoCedula: string) => {
    if (!viendoDetalleId) return;
    startTransition(async () => {
      setError(null);
      const result = await asignarCargoAction(viendoDetalleId, empleadoCedula);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      cargarCargos();
    });
  };

  const onDesasignar = () => {
    if (!viendoDetalleId) return;
    startTransition(async () => {
      setError(null);
      const result = await desasignarCargoAction(viendoDetalleId);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      cargarCargos();
    });
  };

  const onTrasladar = (cargoNuevoId: number, motivoId: number) => {
    if (!viendoDetalleId) return;
    startTransition(async () => {
      setError(null);
      const result = await cambiarCargoAction({ cargoActualId: viendoDetalleId, cargoNuevoId, motivoId });
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      setDetalleAbierto(false);
      cargarCargos();
      cargarPrestamos();
    });
  };

  const onCambiarEstatus = (estatusId: number, motivoId: number) => {
    if (!viendoDetalleId) return;
    startTransition(async () => {
      setError(null);
      const result = await gestionarEstatusAction({ cargoId: viendoDetalleId, estatusId, motivoId });
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      cargarCargos();
    });
  };

  const onCrearPrestamo = (data: CrearPrestamoFormType) => {
    startTransition(async () => {
      setError(null);
      const result = await crearPrestamoAction(data as { cedulaEncargado: string; cargoId: number; motivoId: number; fechaInicio: string; fechaFin: string });
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      prestamoForm.reset({ fechaInicio: "", fechaFin: "" });
      cargarPrestamos();
    });
  };

  const onFinalizarPrestamo = (prestamoId: number) => {
    startTransition(async () => {
      setError(null);
      const result = await finalizarPrestamoAction(prestamoId);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      cargarPrestamos();
    });
  };

  const onGuardarDenominacion = (data: DenominacionFormType) => {
    startTransition(async () => {
      setError(null);
      const input = { nombre: data.nombre, orden: data.orden ?? 30 };
      const result = editandoDenominacion
        ? await actualizarDenominacionAction(editandoDenominacion, input)
        : await crearDenominacionAction(input);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      setEditandoDenominacion(null);
      denominacionForm.reset({ orden: 30 });
      cargarDenominaciones();
    });
  };

  const onEditarDenominacion = (d: DenominacionCargoDTO) => {
    setEditandoDenominacion(d.id);
    denominacionForm.reset({ nombre: d.nombre, orden: d.orden });
  };

  const onEliminarDenominacion = (id: number) => {
    startTransition(async () => {
      setError(null);
      const result = await eliminarDenominacionAction(id);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      if (editandoDenominacion === id) setEditandoDenominacion(null);
      cargarDenominaciones();
    });
  };

  const cargosVacantes = cargos.filter((c) => c.estaVacante);
  const columnas = construirColumnasCargos(puedeVerDetalle, onVerDetalle);

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">Cargos</h1>
        </div>
        {puedeCrearCodigo && (
          <Button asChild>
            <Link href="/cargos/crear-codigo">
              <Plus className="size-4" aria-hidden="true" /> Nuevo código
            </Link>
          </Button>
        )}
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="codigos">
        <TabsList>
          <TabsTrigger value="codigos">Códigos</TabsTrigger>
          <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
          <TabsTrigger value="denominaciones">Denominaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="codigos" className="flex flex-col gap-4">
          {isPending && cargos.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : (
            <DataTable
              columns={columnas}
              data={cargos}
              emptyMessage="No hay cargos."
              toolbar={
                <form onSubmit={filtroForm.handleSubmit(onFiltro)} className="flex items-end gap-2" noValidate>
                  <Field>
                    <Label htmlFor="dependenciaId" className="sr-only">Dependencia</Label>
                    <Input type="number" id="dependenciaId" placeholder="Id de dependencia (opcional)" {...filtroForm.register("dependenciaId", { valueAsNumber: true })} />
                  </Field>
                  <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                    <input type="checkbox" {...filtroForm.register("soloVacantes")} className="size-4 shrink-0" />
                    Solo vacantes
                  </label>
                  <Button type="submit" variant="outline" disabled={isPending}>
                    <RefreshCw className="size-4" aria-hidden="true" /> Buscar
                  </Button>
                </form>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="prestamos" className="flex flex-col gap-4">
          {puedePrestar && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Registrar préstamo de cargo</CardTitle>
                <CardDescription>Registre una encargaduría sobre un puesto.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={prestamoForm.handleSubmit(onCrearPrestamo)} className="flex flex-col gap-4" noValidate>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Field data-invalid={!!prestamoForm.formState.errors.cedulaEncargado}>
                      <Label htmlFor="cedulaEncargado">Cédula del encargado</Label>
                      <Input id="cedulaEncargado" placeholder="Ej. 12345678" {...prestamoForm.register("cedulaEncargado")} aria-invalid={!!prestamoForm.formState.errors.cedulaEncargado} />
                    </Field>
                    <Field data-invalid={!!prestamoForm.formState.errors.cargoId}>
                      <Label htmlFor="prestamoCargoId">Id del cargo</Label>
                      <Input type="number" id="prestamoCargoId" {...prestamoForm.register("cargoId", { valueAsNumber: true })} aria-invalid={!!prestamoForm.formState.errors.cargoId} />
                    </Field>
                    <Field data-invalid={!!prestamoForm.formState.errors.motivoId}>
                      <Label htmlFor="prestamoMotivoId">Id del motivo</Label>
                      <Input type="number" id="prestamoMotivoId" {...prestamoForm.register("motivoId", { valueAsNumber: true })} aria-invalid={!!prestamoForm.formState.errors.motivoId} />
                    </Field>
                    <Field data-invalid={!!prestamoForm.formState.errors.fechaInicio}>
                      <Label htmlFor="fechaInicio">Fecha inicio</Label>
                      <Input type="date" id="fechaInicio" {...prestamoForm.register("fechaInicio")} aria-invalid={!!prestamoForm.formState.errors.fechaInicio} />
                    </Field>
                    <Field data-invalid={!!prestamoForm.formState.errors.fechaFin}>
                      <Label htmlFor="fechaFin">Fecha fin</Label>
                      <Input type="date" id="fechaFin" {...prestamoForm.register("fechaFin")} aria-invalid={!!prestamoForm.formState.errors.fechaFin} />
                    </Field>
                  </div>
                  <div>
                    <Button type="submit" disabled={isPending}>
                      <Plus className="size-4" aria-hidden="true" /> Crear préstamo
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Encargado</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestamos.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No hay préstamos registrados.</TableCell></TableRow>
                ) : (
                  prestamos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.empleadoEncargadoCedula}</TableCell>
                      <TableCell>{p.cargoEncargadoCodigo}</TableCell>
                      <TableCell>{p.titularNombre ?? "—"}</TableCell>
                      <TableCell>{p.motivoNombre}</TableCell>
                      <TableCell>{p.fechaInicio}</TableCell>
                      <TableCell>{p.fechaFin}</TableCell>
                      <TableCell>
                        <Badge variant={p.estaFinalizada ? "outline" : "secondary"}>
                          {p.estaFinalizada ? "Finalizada" : "Activa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!p.estaFinalizada && puedeRevertirPrestamo && (
                          <Button variant="ghost" size="sm" onClick={() => onFinalizarPrestamo(p.id)} disabled={isPending}>
                            Finalizar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="denominaciones" className="flex flex-col gap-4">
          {(editandoDenominacion ? puedeEditarDenominacion : puedeCrearDenominacion) && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>{editandoDenominacion ? "Editar denominación" : "Nueva denominación"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={denominacionForm.handleSubmit(onGuardarDenominacion)} className="flex flex-col gap-4 md:max-w-lg" noValidate>
                  <Field data-invalid={!!denominacionForm.formState.errors.nombre}>
                    <Label htmlFor="denominacionNombre">Nombre</Label>
                    <Input id="denominacionNombre" {...denominacionForm.register("nombre")} aria-invalid={!!denominacionForm.formState.errors.nombre} />
                    {denominacionForm.formState.errors.nombre && <p role="alert" className="text-sm text-destructive">{denominacionForm.formState.errors.nombre.message}</p>}
                  </Field>
                  <Field data-invalid={!!denominacionForm.formState.errors.orden}>
                    <Label htmlFor="denominacionOrden">Orden</Label>
                    <Input type="number" id="denominacionOrden" {...denominacionForm.register("orden", { valueAsNumber: true })} aria-invalid={!!denominacionForm.formState.errors.orden} />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={isPending}>
                      <Plus className="size-4" aria-hidden="true" /> {editandoDenominacion ? "Actualizar" : "Crear"}
                    </Button>
                    {editandoDenominacion && (
                      <Button type="button" variant="outline" onClick={() => { setEditandoDenominacion(null); denominacionForm.reset({ orden: 30 }); }}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Id</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {denominaciones.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">No hay denominaciones registradas.</TableCell></TableRow>
                ) : (
                  denominaciones.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.id}</TableCell>
                      <TableCell>{d.nombre}</TableCell>
                      <TableCell>{d.orden}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {puedeEditarDenominacion && (
                            <Button variant="ghost" size="sm" onClick={() => onEditarDenominacion(d)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                          )}
                          {puedeEliminarDenominacion && (
                            <Button variant="ghost" size="sm" onClick={() => onEliminarDenominacion(d.id)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <CargoDetalleSheet
        open={detalleAbierto}
        onOpenChange={(open) => {
          setDetalleAbierto(open);
          if (!open) setViendoDetalleId(null);
        }}
        cargo={cargoSeleccionado}
        cargosVacantes={cargosVacantes.filter((c) => c.id !== viendoDetalleId)}
        motivos={motivos}
        estatus={estatus}
        onAsignar={onAsignar}
        onDesasignar={onDesasignar}
        onTrasladar={onTrasladar}
        onCambiarEstatus={onCambiarEstatus}
        isPending={isPending}
        puedeAsignar={puedeAsignar}
      />
    </section>
  );
}
