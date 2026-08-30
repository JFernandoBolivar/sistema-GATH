"use client";

/**
 * Página de cargos: puestos (listado/filtros, asignar, desasignar, trasladar,
 * gestionar estatus), préstamos de cargo (encargadurías) y CRUD de
 * denominaciones. Cliente + react-hook-form + zodResolver; las acciones van
 * envueltas en useTransition (R8) y se delegan a las Server Actions del módulo
 * (R7). Opera exclusivamente con DTOs (R5) y no importa de `infrastructure/`
 * (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRightLeft,
  Briefcase,
  Building2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type {
  CargoAsignacionDTO,
  CatalogoCargoItemDTO,
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
import {
  asignarCargoSchema,
  cargosFiltroSchema,
  cambiarCargoSchema,
  crearPrestamoSchema,
  denominacionSchema,
  gestionarEstatusSchema,
  type AsignarCargoFormType,
  type CambiarCargoFormType,
  type CargosFiltroFormType,
  type CrearPrestamoFormType,
  type DenominacionFormType,
  type GestionarEstatusFormType,
} from "./schema/schema-asignar-cargo";

function CatalogSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  ariaInvalid,
}: {
  id: string;
  value: string | undefined;
  onChange: (v: number) => void;
  options: CatalogoCargoItemDTO[];
  placeholder: string;
  ariaInvalid?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v ? Number(v) : 0)}
      aria-invalid={ariaInvalid}
    >
      <SelectTrigger id={id} aria-invalid={ariaInvalid} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function CargosPage() {
  const [cargos, setCargos] = useState<CargoAsignacionDTO[]>([]);
  const [prestamos, setPrestamos] = useState<PrestamoCargoDTO[]>([]);
  const [denominaciones, setDenominaciones] = useState<DenominacionCargoDTO[]>([]);
  const [motivos, setMotivos] = useState<CatalogoCargoItemDTO[]>([]);
  const [estatus, setEstatus] = useState<CatalogoCargoItemDTO[]>([]);
  const [editandoDenominacion, setEditandoDenominacion] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cargoOptions: CatalogoCargoItemDTO[] = cargos.map((c) => ({
    id: c.id,
    nombre: `${c.codigo} — ${c.denominacionNombre}`,
  }));
  const cargoVacanteOptions: CatalogoCargoItemDTO[] = cargos
    .filter((c) => c.estaVacante)
    .map((c) => ({ id: c.id, nombre: `${c.codigo} — ${c.denominacionNombre}` }));

  const filtroForm = useForm<CargosFiltroFormType>({
    resolver: zodResolver(cargosFiltroSchema),
    defaultValues: {},
  });

  const asignarForm = useForm<AsignarCargoFormType>({
    resolver: zodResolver(asignarCargoSchema),
    defaultValues: { cargoId: undefined },
  });

  const cambiarForm = useForm<CambiarCargoFormType>({
    resolver: zodResolver(cambiarCargoSchema),
    defaultValues: { cargoActualId: undefined },
  });

  const estatusForm = useForm<GestionarEstatusFormType>({
    resolver: zodResolver(gestionarEstatusSchema),
    defaultValues: { cargoId: undefined },
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

  const onAsignar = (data: AsignarCargoFormType) => {
    startTransition(async () => {
      setError(null);
      const result = await asignarCargoAction(data.cargoId, data.empleadoCedula ?? "");
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      asignarForm.reset({ cargoId: undefined });
      cargarCargos();
    });
  };

  const onDesasignar = (cargoId: number) => {
    startTransition(async () => {
      setError(null);
      const result = await desasignarCargoAction(cargoId);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      cargarCargos();
    });
  };

  const onCambiarCargo = (data: CambiarCargoFormType) => {
    startTransition(async () => {
      setError(null);
      const result = await cambiarCargoAction(data as { cargoActualId: number; cargoNuevoId: number; motivoId: number });
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      cargarCargos();
      cargarPrestamos();
    });
  };

  const onGestionarEstatus = (data: GestionarEstatusFormType) => {
    startTransition(async () => {
      setError(null);
      const result = await gestionarEstatusAction(data as { cargoId: number; estatusId: number; motivoId: number });
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

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Briefcase className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Cargos</h1>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="puestos">
        <TabsList>
          <TabsTrigger value="puestos">Puestos</TabsTrigger>
          <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
          <TabsTrigger value="denominaciones">Denominaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="puestos" className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={filtroForm.handleSubmit(onFiltro)} className="flex flex-col gap-4" noValidate>
                  <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <Field>
                      <Label htmlFor="dependenciaId">Dependencia (id, opcional)</Label>
                      <Input type="number" id="dependenciaId" placeholder="Id" {...filtroForm.register("dependenciaId", { valueAsNumber: true })} />
                    </Field>
                    <Field className="flex items-end gap-2">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" {...filtroForm.register("soloVacantes")} className="size-4" />
                        Solo vacantes
                      </label>
                    </Field>
                  </div>
                  <div>
                    <Button type="submit" disabled={isPending}>
                      <RefreshCw className="size-4" aria-hidden="true" /> Buscar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Asignar cargo</CardTitle>
                <CardDescription>Asigne un puesto a un empleado por cédula.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={asignarForm.handleSubmit(onAsignar)} className="flex flex-col gap-4" noValidate>
                  <Field data-invalid={!!asignarForm.formState.errors.cargoId}>
                    <Label htmlFor="asignarCargoId">Cargo</Label>
                    <CatalogSelect
                      id="asignarCargoId"
                      value={asignarForm.watch("cargoId") ? String(asignarForm.watch("cargoId")) : undefined}
                      onChange={(v) => asignarForm.setValue("cargoId", v)}
                      options={cargoOptions}
                      placeholder="Seleccione un cargo"
                      ariaInvalid={!!asignarForm.formState.errors.cargoId}
                    />
                    {asignarForm.formState.errors.cargoId && (
                      <p role="alert" className="text-sm text-destructive">{asignarForm.formState.errors.cargoId.message}</p>
                    )}
                  </Field>
                  <Field data-invalid={!!asignarForm.formState.errors.empleadoCedula}>
                    <Label htmlFor="empleadoCedula">Cédula del empleado</Label>
                    <Input id="empleadoCedula" placeholder="Ej. 12345678" {...asignarForm.register("empleadoCedula")} aria-invalid={!!asignarForm.formState.errors.empleadoCedula} />
                    {asignarForm.formState.errors.empleadoCedula && <p role="alert" className="text-sm text-destructive">{asignarForm.formState.errors.empleadoCedula.message}</p>}
                  </Field>
                  <div>
                    <Button type="submit" disabled={isPending}>
                      <UserPlus className="size-4" aria-hidden="true" /> Asignar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Trasladar cargo</CardTitle>
                <CardDescription>Mueva al empleado de un cargo a otro vacante.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={cambiarForm.handleSubmit(onCambiarCargo)} className="flex flex-col gap-4" noValidate>
                  <Field data-invalid={!!cambiarForm.formState.errors.cargoActualId}>
                    <Label htmlFor="cargoActualId">Cargo actual</Label>
                    <CatalogSelect
                      id="cargoActualId"
                      value={cambiarForm.watch("cargoActualId") ? String(cambiarForm.watch("cargoActualId")) : undefined}
                      onChange={(v) => cambiarForm.setValue("cargoActualId", v)}
                      options={cargoOptions}
                      placeholder="Seleccione el cargo a trasladar"
                      ariaInvalid={!!cambiarForm.formState.errors.cargoActualId}
                    />
                  </Field>
                  <Field data-invalid={!!cambiarForm.formState.errors.cargoNuevoId}>
                    <Label htmlFor="cargoNuevoId">Cargo nuevo</Label>
                    <CatalogSelect
                      id="cargoNuevoId"
                      value={cambiarForm.watch("cargoNuevoId") ? String(cambiarForm.watch("cargoNuevoId")) : undefined}
                      onChange={(v) => cambiarForm.setValue("cargoNuevoId", v)}
                      options={cargoVacanteOptions}
                      placeholder="Seleccione el cargo vacante de destino"
                      ariaInvalid={!!cambiarForm.formState.errors.cargoNuevoId}
                    />
                  </Field>
                  <Field data-invalid={!!cambiarForm.formState.errors.motivoId}>
                    <Label htmlFor="motivoId">Motivo</Label>
                    <CatalogSelect
                      id="motivoId"
                      value={cambiarForm.watch("motivoId") ? String(cambiarForm.watch("motivoId")) : undefined}
                      onChange={(v) => cambiarForm.setValue("motivoId", v)}
                      options={motivos}
                      placeholder="Seleccione un motivo"
                      ariaInvalid={!!cambiarForm.formState.errors.motivoId}
                    />
                  </Field>
                  <div>
                    <Button type="submit" disabled={isPending}>
                      <ArrowRightLeft className="size-4" aria-hidden="true" /> Trasladar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Gestionar estatus</CardTitle>
                <CardDescription>Bloquee, suspenda o reactive un cargo.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={estatusForm.handleSubmit(onGestionarEstatus)} className="flex flex-col gap-4" noValidate>
                  <Field data-invalid={!!estatusForm.formState.errors.cargoId}>
                    <Label htmlFor="estatusCargoId">Cargo</Label>
                    <CatalogSelect
                      id="estatusCargoId"
                      value={estatusForm.watch("cargoId") ? String(estatusForm.watch("cargoId")) : undefined}
                      onChange={(v) => estatusForm.setValue("cargoId", v)}
                      options={cargoOptions}
                      placeholder="Seleccione un cargo"
                      ariaInvalid={!!estatusForm.formState.errors.cargoId}
                    />
                  </Field>
                  <Field data-invalid={!!estatusForm.formState.errors.estatusId}>
                    <Label htmlFor="estatusId">Estatus</Label>
                    <CatalogSelect
                      id="estatusId"
                      value={estatusForm.watch("estatusId") ? String(estatusForm.watch("estatusId")) : undefined}
                      onChange={(v) => estatusForm.setValue("estatusId", v)}
                      options={estatus}
                      placeholder="Seleccione un estatus"
                      ariaInvalid={!!estatusForm.formState.errors.estatusId}
                    />
                  </Field>
                  <Field data-invalid={!!estatusForm.formState.errors.motivoId}>
                    <Label htmlFor="estatusMotivoId">Motivo</Label>
                    <CatalogSelect
                      id="estatusMotivoId"
                      value={estatusForm.watch("motivoId") ? String(estatusForm.watch("motivoId")) : undefined}
                      onChange={(v) => estatusForm.setValue("motivoId", v)}
                      options={motivos}
                      placeholder="Seleccione un motivo"
                      ariaInvalid={!!estatusForm.formState.errors.motivoId}
                    />
                  </Field>
                  <div>
                    <Button type="submit" disabled={isPending}>
                      <Building2 className="size-4" aria-hidden="true" /> Actualizar estatus
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Denominación</TableHead>
                  <TableHead>Específica</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead>Dependencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending && cargos.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : cargos.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No hay cargos.</TableCell></TableRow>
                ) : (
                  cargos.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.codigo}</TableCell>
                      <TableCell>{c.empleadoCedula ?? "Vacante"}</TableCell>
                      <TableCell>{c.denominacionNombre}</TableCell>
                      <TableCell>{c.especificaNombre ?? "—"}</TableCell>
                      <TableCell>{c.estatusNombre}</TableCell>
                      <TableCell>{c.dependenciaNombre ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.estaVacante ? "outline" : "secondary"}>
                          {c.estaVacante ? "Vacante" : "Ocupado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!c.estaVacante && (
                          <Button variant="ghost" size="sm" onClick={() => onDesasignar(c.id)} disabled={isPending}>
                            <UserMinus className="size-4" aria-hidden="true" /> Desasignar
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

        <TabsContent value="prestamos" className="flex flex-col gap-4">
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
                    <Label htmlFor="prestamoCargoId">Cargo</Label>
                    <CatalogSelect
                      id="prestamoCargoId"
                      value={prestamoForm.watch("cargoId") ? String(prestamoForm.watch("cargoId")) : undefined}
                      onChange={(v) => prestamoForm.setValue("cargoId", v)}
                      options={cargoOptions}
                      placeholder="Seleccione un cargo"
                      ariaInvalid={!!prestamoForm.formState.errors.cargoId}
                    />
                  </Field>
                  <Field data-invalid={!!prestamoForm.formState.errors.motivoId}>
                    <Label htmlFor="prestamoMotivoId">Motivo</Label>
                    <CatalogSelect
                      id="prestamoMotivoId"
                      value={prestamoForm.watch("motivoId") ? String(prestamoForm.watch("motivoId")) : undefined}
                      onChange={(v) => prestamoForm.setValue("motivoId", v)}
                      options={motivos}
                      placeholder="Seleccione un motivo"
                      ariaInvalid={!!prestamoForm.formState.errors.motivoId}
                    />
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
                        {!p.estaFinalizada && (
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
                          <Button variant="ghost" size="sm" onClick={() => onEditarDenominacion(d)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => onEliminarDenominacion(d.id)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
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
    </section>
  );
}
