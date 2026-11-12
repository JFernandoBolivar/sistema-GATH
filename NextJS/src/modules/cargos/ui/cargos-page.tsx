"use client";

/**
 * Página de cargos: Listado de Códigos (DataTable + Sheet de detalle con
 * acciones operativas embebidas, réplica exacta de paridad visual y
 * funcional del legado `listado-codigo` y `code-list.tsx`).
 */
import { useEffect, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { Eraser, Search } from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { DataTable } from "@/shared/ui/components/data-table";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Loading } from "@/shared/ui/components/loading";

import type {
  CargoAsignacionDTO,
  CatalogoCargoItemDTO,
  PaginaCargosDTO,
  UnidadOrganizativaCargoDTO,
} from "../application/dtos/cargo-dto";
import {
  asignarCargoAction,
  cambiarCargoAction,
  desasignarCargoAction,
  gestionarEstatusAction,
  getCargosPaginadoAction,
  getCargosVacantesAction,
  getCoordinacionesAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getEstatusAction,
  getTiposNominaAction,
} from "../infrastructure/actions/cargos-actions";
import CargoDetalleSheet from "./cargo-detalle-sheet";
import CargoUpdateModal from "./cargo-update-modal";
import { construirColumnasCargos } from "./cargos-columns";
import {
  schemaFilterForm,
  type SchemaFilterFormType,
} from "./schema/schema-asignar-cargo";

interface FiltrosCargos {
  codigo?: string;
  tipoNominaId?: number;
  dependenciaId?: number;
  direccionGeneralId?: number;
  direccionLineaId?: number;
  coordinacionId?: number;
  pagina: number;
  pageSize: number;
}

const FILTROS_INICIALES: FiltrosCargos = { pagina: 1, pageSize: 10 };

export default function CargosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVerDetalle = tienePermiso(permisos, "cargos.ver");
  const puedeAsignar = tienePermiso(permisos, "cargos.asignar");

  const [pagina, setPagina] = useState<PaginaCargosDTO | null>(null);
  const [filtros, setFiltros] = useState<FiltrosCargos>(FILTROS_INICIALES);
  const [vacantes, setVacantes] = useState<CargoAsignacionDTO[]>([]);
  const cargos = pagina?.resultados ?? [];
  const [nominas, setNominas] = useState<CatalogoCargoItemDTO[]>([]);
  const [dependencias, setDependencias] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesGenerales, setDireccionesGenerales] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesLinea, setDireccionesLinea] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<UnidadOrganizativaCargoDTO[]>([]);

  const [dependenciaId, setDependenciaId] = useState<number | null>(null);
  const [direccionGeneralId, setDireccionGeneralId] = useState<number | null>(null);
  const [direccionLineaId, setDireccionLineaId] = useState<number | null>(null);

  const [isLoadingCatalogos, setIsLoadingCatalogos] = useState(false);
  const [isLoadingDG, setIsLoadingDG] = useState(false);
  const [isLoadingDL, setIsLoadingDL] = useState(false);
  const [isLoadingCoord, setIsLoadingCoord] = useState(false);

  const [erroresTraslado, setErroresTraslado] = useState<Record<string, string[]> | undefined>();
  const [erroresEstatus, setErroresEstatus] = useState<Record<string, string[]> | undefined>();
  const [estatus, setEstatus] = useState<{ id: number; nombre: string }[]>([]);
  const [viendoDetalleId, setViendoDetalleId] = useState<number | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [cargoParaActualizar, setCargoParaActualizar] = useState<CargoAsignacionDTO | null>(null);
  const [modalActualizarAbierto, setModalActualizarAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SchemaFilterFormType>({
    resolver: zodResolver(schemaFilterForm),
    defaultValues: {
      codigo: "",
      tipo_nomina: undefined,
      dependencia_id: undefined,
      direccion_general_id: undefined,
      direccion_linea_id: undefined,
      coordinacion_id: undefined,
    },
  });

  const cargarCargos = (siguientes: FiltrosCargos) => {
    startTransition(async () => {
      setError(null);
      try {
        setPagina(await getCargosPaginadoAction(siguientes));
      } catch (e) {
        // Un fallo del transporte de la server action (proxy, timeout, petición cortada al
        // paginar muy rápido) no debe tumbar la pantalla: se informa y se queda en la página.
        unstable_rethrow(e);
        setError("No fue posible cargar los cargos.");
      }
    });
  };

  useEffect(() => {
    cargarCargos(FILTROS_INICIALES);
    const cargarCatalogosIniciales = async () => {
      setIsLoadingCatalogos(true);
      try {
        const [nominasList, dependenciasList, estatusList] = await Promise.all([
          getTiposNominaAction(),
          getDependenciasAction(),
          getEstatusAction(),
        ]);
        setNominas(nominasList);
        setDependencias(dependenciasList);
        setEstatus(estatusList);
      } catch {
        setError("No fue posible cargar los catálogos de filtro.");
      } finally {
        setIsLoadingCatalogos(false);
      }
    };
    cargarCatalogosIniciales();
  }, []);

  const handleDependenciaChange = async (val: string) => {
    const id = Number.parseInt(val);
    form.setValue("dependencia_id", id);
    form.setValue("direccion_general_id", undefined);
    form.setValue("direccion_linea_id", undefined);
    form.setValue("coordinacion_id", undefined);
    setDependenciaId(id);
    setDireccionGeneralId(null);
    setDireccionLineaId(null);
    setDireccionesGenerales([]);
    setDireccionesLinea([]);
    setCoordinaciones([]);

    if (id > 0) {
      setIsLoadingDG(true);
      try {
        const dgs = await getDireccionesGeneralesAction(id);
        setDireccionesGenerales(dgs);
      } catch (e) {
        console.error("Error cargando direcciones generales:", e);
      } finally {
        setIsLoadingDG(false);
      }
    }
  };

  const handleDireccionGeneralChange = async (val: string) => {
    const id = Number.parseInt(val);
    form.setValue("direccion_general_id", id);
    form.setValue("direccion_linea_id", undefined);
    form.setValue("coordinacion_id", undefined);
    setDireccionGeneralId(id);
    setDireccionLineaId(null);
    setDireccionesLinea([]);
    setCoordinaciones([]);

    if (id > 0) {
      setIsLoadingDL(true);
      try {
        const dls = await getDireccionesLineaAction(id);
        setDireccionesLinea(dls);
      } catch (e) {
        console.error("Error cargando direcciones de línea:", e);
      } finally {
        setIsLoadingDL(false);
      }
    }
  };

  const handleDireccionLineaChange = async (val: string) => {
    const id = Number.parseInt(val);
    form.setValue("direccion_linea_id", id);
    form.setValue("coordinacion_id", undefined);
    setDireccionLineaId(id);
    setCoordinaciones([]);

    if (id > 0) {
      setIsLoadingCoord(true);
      try {
        const coords = await getCoordinacionesAction(id);
        setCoordinaciones(coords);
      } catch (e) {
        console.error("Error cargando coordinaciones:", e);
      } finally {
        setIsLoadingCoord(false);
      }
    }
  };

  const onSearch = (values: SchemaFilterFormType) => {
    const siguientes: FiltrosCargos = {
      codigo: values.codigo?.trim() || undefined,
      tipoNominaId: values.tipo_nomina && values.tipo_nomina > 0 ? values.tipo_nomina : undefined,
      dependenciaId: values.dependencia_id || undefined,
      direccionGeneralId: values.direccion_general_id || undefined,
      direccionLineaId: values.direccion_linea_id || undefined,
      coordinacionId: values.coordinacion_id || undefined,
      pagina: 1,
      pageSize: filtros.pageSize,
    };
    setFiltros(siguientes);
    cargarCargos(siguientes);
  };

  const cambiarPagina = (nueva: number) => {
    if (!pagina || nueva < 1 || nueva > pagina.totalPaginas) return;
    const siguientes = { ...filtros, pagina: nueva };
    setFiltros(siguientes);
    cargarCargos(siguientes);
  };

  const cambiarTamano = (valor: string) => {
    const siguientes = { ...filtros, pageSize: Number(valor), pagina: 1 };
    setFiltros(siguientes);
    cargarCargos(siguientes);
  };

  const cleanFields = () => {
    form.reset({
      codigo: "",
      tipo_nomina: undefined,
      dependencia_id: undefined,
      direccion_general_id: undefined,
      direccion_linea_id: undefined,
      coordinacion_id: undefined,
    });
    setDependenciaId(null);
    setDireccionGeneralId(null);
    setDireccionLineaId(null);
    setDireccionesGenerales([]);
    setDireccionesLinea([]);
    setCoordinaciones([]);
    const iniciales = { ...FILTROS_INICIALES, pageSize: filtros.pageSize };
    setFiltros(iniciales);
    cargarCargos(iniciales);
  };

  const cargoSeleccionado = cargos.find((c) => c.id === viendoDetalleId) ?? null;

  const onVerDetalle = (cargoId: number) => {
    setViendoDetalleId(cargoId);
    setDetalleAbierto(true);
    // Destinos del traslado: las vacantes ya no salen de la página visible (solo trae una
    // parte del listado), así que se piden completas al abrir el detalle.
    getCargosVacantesAction()
      .then(setVacantes)
      .catch((e) => {
        unstable_rethrow(e);
        setVacantes([]);
      });
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
      cargarCargos(filtros);
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
      cargarCargos(filtros);
    });
  };

  const onTrasladar = (cargoNuevoId: number, motivoId: number) => {
    if (!viendoDetalleId) return;
    startTransition(async () => {
      setError(null);
      setErroresTraslado(undefined);
      const result = await cambiarCargoAction({ cargoActualId: viendoDetalleId, cargoNuevoId, motivoId });
      if (result && typeof result === "object" && "error" in result) {
        const errores = (result as { errores?: Record<string, string[]> }).errores;
        setErroresTraslado(errores);
        setError(errores ? "Revise los campos marcados en rojo." : (result as { error: string }).error);
        return;
      }
      setDetalleAbierto(false);
      cargarCargos(filtros);
    });
  };

  const onCambiarEstatus = (estatusId: number, motivoId: number) => {
    if (!viendoDetalleId) return;
    startTransition(async () => {
      setError(null);
      setErroresEstatus(undefined);
      const result = await gestionarEstatusAction({ cargoId: viendoDetalleId, estatusId, motivoId });
      if (result && typeof result === "object" && "error" in result) {
        const errores = (result as { errores?: Record<string, string[]> }).errores;
        setErroresEstatus(errores);
        setError(errores ? "Revise los campos marcados en rojo." : (result as { error: string }).error);
        return;
      }
      cargarCargos(filtros);
    });
  };

  const onActualizar = (cargo: CargoAsignacionDTO) => {
    setCargoParaActualizar(cargo);
    setModalActualizarAbierto(true);
  };

  const columnas = construirColumnasCargos(puedeVerDetalle, onVerDetalle, onActualizar);

  return (
    <Card className="w-full min-w-0 max-w-full bg-white">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-semibold">Listado De Cargos</h1>
        </CardTitle>
        <CardDescription>
          Listado Detallado De Cargos Registrados En El Sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSearch)}>
            <div className="flex w-full min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 w-full min-w-0">
                <FormField
                  name="codigo"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buscar Código</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="buscar codigo..."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipo_nomina"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Nomina</FormLabel>
                      <Select
                        value={field.value !== undefined ? String(field.value) : undefined}
                        onValueChange={(val) => {
                          field.onChange(Number.parseInt(val));
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingCatalogos
                                  ? "Cargando Nominas"
                                  : "Seleccione un Tipo de Nomina"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Ninguno</SelectItem>
                          {nominas.map((n) => (
                            <SelectItem key={n.id} value={String(n.id)}>
                              {n.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dependencia_id"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Nivel</FormLabel>
                      <Select
                        value={field.value !== undefined ? String(field.value) : undefined}
                        onValueChange={handleDependenciaChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingCatalogos
                                  ? "Cargando Nivel"
                                  : "Seleccione un Nivel"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dependencias.map((dep) => (
                            <SelectItem key={dep.id} value={String(dep.id)}>
                              {dep.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="direccion_general_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                      <Select
                        value={field.value !== undefined ? String(field.value) : undefined}
                        disabled={!dependenciaId}
                        onValueChange={handleDireccionGeneralChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingDG
                                  ? "Cargando Direcciones"
                                  : "Seleccione una Dirección"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {direccionesGenerales.map((general) => (
                            <SelectItem key={general.id} value={String(general.id)}>
                              {general.codigo ? `${general.codigo}-${general.nombre}` : general.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="direccion_linea_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>División / Coordinación</FormLabel>
                      <Select
                        value={field.value !== undefined ? String(field.value) : undefined}
                        disabled={!direccionGeneralId}
                        onValueChange={handleDireccionLineaChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingDL
                                  ? "Cargando División / Coordinación"
                                  : "Seleccione una División / Coordinación"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {direccionesLinea.map((line) => (
                            <SelectItem key={line.id} value={String(line.id)}>
                              {line.codigo ? `${line.codigo}-${line.nombre}` : line.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="coordinacion_id"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Coordinación</FormLabel>
                      <Select
                        value={field.value !== undefined ? String(field.value) : undefined}
                        disabled={!direccionLineaId}
                        onValueChange={(val) => {
                          field.onChange(Number.parseInt(val));
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingCoord
                                  ? "Cargando Coordinaciones"
                                  : "Seleccione una Coordinación"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {coordinaciones.map((coord) => (
                            <SelectItem key={coord.id} value={String(coord.id)}>
                              {coord.codigo ? `${coord.codigo}-${coord.nombre}` : coord.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  className="cursor-pointer self-baseline-last"
                  type="submit"
                  disabled={isPending}
                >
                  Buscar <Search className="ml-2 size-4" />
                </Button>
                <Button
                  variant="outline"
                  className="cursor-pointer self-baseline-last"
                  type="button"
                  onClick={cleanFields}
                  disabled={isPending}
                >
                  Limpiar <Eraser className="ml-2 size-4" />
                </Button>
              </div>
            </div>
          </form>
        </Form>

        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

        {isPending && !pagina ? (
          <Loading className="mt-6 border-none shadow-none" promiseMessage="Cargando Cargos..." />
        ) : (
          <div className="mt-4 w-full min-w-0 max-w-full">
            <DataTable
              columns={columnas}
              data={cargos}
              emptyMessage="Sin Resultados"
              hidePagination
            />
            {pagina && (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pagina.total} registro(s); página {pagina.pagina} de {pagina.totalPaginas}.
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tamano-pagina-cargos" className="text-sm">
                      Filas
                    </Label>
                    <Select value={String(pagina.tamano)} onValueChange={cambiarTamano}>
                      <SelectTrigger id="tamano-pagina-cargos" className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cambiarPagina(pagina.pagina - 1)}
                      disabled={pagina.pagina <= 1 || isPending}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {pagina.pagina} de {pagina.totalPaginas}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cambiarPagina(pagina.pagina + 1)}
                      disabled={pagina.pagina >= pagina.totalPaginas || isPending}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <CargoDetalleSheet
          open={detalleAbierto}
          onOpenChange={(open) => {
            setDetalleAbierto(open);
            if (!open) setViendoDetalleId(null);
          }}
          cargo={cargoSeleccionado}
          cargosVacantes={vacantes.filter((c) => c.id !== viendoDetalleId)}
          erroresTraslado={erroresTraslado}
          erroresEstatus={erroresEstatus}
          estatus={estatus}
          onAsignar={onAsignar}
          onDesasignar={onDesasignar}
          onTrasladar={onTrasladar}
          onCambiarEstatus={onCambiarEstatus}
          isPending={isPending}
          puedeAsignar={puedeAsignar}
        />

        <CargoUpdateModal
          open={modalActualizarAbierto}
          onOpenChange={(open) => {
            setModalActualizarAbierto(open);
            if (!open) setCargoParaActualizar(null);
          }}
          cargo={cargoParaActualizar}
          onUpdated={() => cargarCargos(filtros)}
        />
      </CardContent>
    </Card>
  );
}
