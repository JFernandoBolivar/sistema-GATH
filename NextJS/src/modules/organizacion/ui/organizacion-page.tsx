"use client";

/**
 * Página principal de organización: "Consultar Ub. Administrativas" (/organizacion).
 * Paridad 100% con la interfaz legada (`listado-ubicacion-administrativa/` + `list-dependencys.tsx`):
 * - Cascadas de Comboboxes: Nivel, Dirección/Gerencia/Oficina, División/Coordinación
 * - Tablas con encabezado azul (bg-blue-600 text-white) y bordes redondeados (rounded-2xl border-blue-700)
 * - Pestaña adicional para "Organismos adscritos" para no perder funcionalidad
 *
 * Cumple Reglas Onion:
 * - R3/R5: Solo DTOs y llamadas a Server Actions (organizacion-actions.ts)
 * - R8: useTransition para estados de carga asíncrona
 */
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRightFromLine,
  Boxes,
  Building2,
  List,
  MoveDownRight,
} from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import { Label } from "@/shared/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import { Combobox } from "@/shared/ui/components/combobox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

import type {
  CoordinacionDTO,
  DependenciaDTO,
  DireccionGeneralDTO,
  DireccionLineaDTO,
  OrganismoAdscritoDTO,
} from "../application/dtos/organizacion-dto";
import {
  getCoordinacionesAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getOrganismosAdscritosAction,
} from "../infrastructure/actions/organizacion-actions";
import OrganismoAdmin from "./organismo-admin";

const SUBMENUS_UBICACION = [
  { href: "/organizacion/dependencias", label: "Crear Ub. Administrativa", icon: ArrowRightFromLine },
  { href: "/organizacion/direcciones-linea", label: "Crear Direcciones", icon: MoveDownRight },
  { href: "/organizacion", label: "Consultar Ub. Administrativas", icon: List },
  { href: "/organizacion/coordinaciones", label: "Actualizar Ub. Administrativas", icon: Boxes },
];

export default function OrganizacionPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const esAdmin = session?.user?.role?.nombre_rol === "ADMINISTRADOR" || session?.user?.role?.id === 1;
  const puedeCrear = esAdmin || tienePermiso(permisos, "organizacion.crear");
  const puedeEditar = esAdmin || tienePermiso(permisos, "organizacion.editar");

  const [dependencias, setDependencias] = useState<DependenciaDTO[]>([]);
  const [dirGenerales, setDirGenerales] = useState<DireccionGeneralDTO[]>([]);
  const [dirLinea, setDirLinea] = useState<DireccionLineaDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<CoordinacionDTO[]>([]);
  const [organismos, setOrganismos] = useState<OrganismoAdscritoDTO[]>([]);

  const [dependencyId, setDependencyId] = useState<string>("");
  const [directionGeneralId, setDirectionGeneralId] = useState<string>("");
  const [coordinationId, setCoordinationId] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [isLoadingDependency, setIsLoadingDependency] = useState(false);
  const [isLoadingDirectionGeneral, setIsLoadingDirectionGeneral] = useState(false);
  const [isLoadingDirectionLine, setIsLoadingDirectionLine] = useState(false);
  const [isLoadingCoordination, setIsLoadingCoordination] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingDependency(true);
    getDependenciasAction()
      .then((deps) => setDependencias(deps))
      .catch(() => setError("No fue posible cargar las dependencias."))
      .finally(() => setIsLoadingDependency(false));

    getOrganismosAdscritosAction()
      .then((orgs) => setOrganismos(orgs))
      .catch(() => {});
  }, []);

  const handleSelectDependencia = (value: string) => {
    setDependencyId(value);
    setDirectionGeneralId("");
    setCoordinationId("");
    setDirGenerales([]);
    setDirLinea([]);
    setCoordinaciones([]);

    if (!value) return;

    setIsLoadingDirectionGeneral(true);
    startTransition(async () => {
      try {
        const data = await getDireccionesGeneralesAction(Number(value));
        setDirGenerales(data);
      } catch {
        setError("Error al cargar direcciones generales.");
      } finally {
        setIsLoadingDirectionGeneral(false);
      }
    });
  };

  const handleSelectDireccionGeneral = (value: string) => {
    setDirectionGeneralId(value);
    setCoordinationId("");
    setDirLinea([]);
    setCoordinaciones([]);

    if (!value) return;

    setIsLoadingDirectionLine(true);
    startTransition(async () => {
      try {
        const data = await getDireccionesLineaAction(Number(value));
        setDirLinea(data);
      } catch {
        setError("Error al cargar divisiones / direcciones de línea.");
      } finally {
        setIsLoadingDirectionLine(false);
      }
    });
  };

  const handleSelectDireccionLinea = (value: string) => {
    setCoordinationId(value);
    setCoordinaciones([]);

    if (!value) return;

    setIsLoadingCoordination(true);
    startTransition(async () => {
      try {
        const data = await getCoordinacionesAction(Number(value));
        setCoordinaciones(data);
      } catch {
        setError("Error al cargar coordinaciones.");
      } finally {
        setIsLoadingCoordination(false);
      }
    });
  };

  const recargarOrganismos = () => {
    getOrganismosAdscritosAction().then(setOrganismos);
  };

  return (
    <PageLayout
      title="Listado De Ubicaciones Administrativas"
      description="Estructura Jerárquica y Dependencias de CONATEL"
    >
      <div className="flex flex-col gap-4 mt-2">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold tracking-tight">Estructura Organizacional</h2>
          </div>
          {(puedeCrear || puedeEditar) && (
            <div className="flex flex-wrap items-center gap-2">
              {SUBMENUS_UBICACION.map((f) => (
                <Button key={f.href} asChild variant="outline" size="sm">
                  <Link href={f.href}>
                    <f.icon className="size-4 mr-1" aria-hidden="true" />
                    {f.label}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </header>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <Tabs defaultValue="explorar">
          <TabsList>
            <TabsTrigger value="explorar">Explorar</TabsTrigger>
            <TabsTrigger value="organismos">Organismos adscritos</TabsTrigger>
          </TabsList>

          <TabsContent value="explorar" className="flex flex-col gap-4">
            <Card className="bg-white dark:bg-card">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 w-full gap-5">
                  <div className="col-span-1 md:col-span-2 gap-2 flex flex-col">
                    <Label className="flex items-center gap-1 font-medium">
                      <span>Nivel</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        (<span>Dependencia</span>)
                      </span>
                    </Label>
                    <Combobox
                      options={dependencias.map((dp) => ({
                        value: `${dp.id}`,
                        label: `${dp.codigo}-${dp.nombre}`,
                      }))}
                      value={dependencyId}
                      onChange={handleSelectDependencia}
                      placeholder={isLoadingDependency ? "Cargando Niveles..." : "Seleccionar Nivel"}
                      searchPlaceholder="Buscar nivel..."
                      disabled={isLoadingDependency}
                    />
                    <div className="text-sm text-gray-700 dark:text-gray-300 text-[12px]">
                      Consultar Dirección / Gerencia / Oficina
                    </div>
                  </div>

                  <div className="gap-2 flex flex-col">
                    <Label className="flex items-center gap-1 font-medium">
                      <span>Dirección / Gerencia / Oficina</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        (<span>Dirección general</span>)
                      </span>
                    </Label>
                    <Combobox
                      options={dirGenerales.map((general) => ({
                        value: `${general.id}`,
                        label: `${general.codigo}-${general.nombre}`,
                      }))}
                      value={directionGeneralId}
                      onChange={handleSelectDireccionGeneral}
                      placeholder={
                        isLoadingDirectionGeneral
                          ? "Cargando Direcciones..."
                          : "Seleccionar Ubicacion Administrativa"
                      }
                      searchPlaceholder="Buscar dirección..."
                      disabled={isLoadingDirectionGeneral || !dependencyId}
                    />
                    <div className="text-sm text-gray-700 dark:text-gray-300 text-[12px]">
                      Consultar Divisiones
                    </div>
                  </div>

                  <div className="gap-2 flex flex-col">
                    <Label className="flex items-center gap-1 font-medium">
                      <span>División / Coordinación</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        (<span>Dirección de línea</span>)
                      </span>
                    </Label>
                    <Combobox
                      options={dirLinea.map((line) => ({
                        value: `${line.id}`,
                        label: `${line.codigo}-${line.nombre}`,
                      }))}
                      value={coordinationId}
                      onChange={handleSelectDireccionLinea}
                      disabled={dirLinea.length === 0 || isLoadingDirectionLine}
                      placeholder={
                        isLoadingDirectionLine
                          ? "Cargando Divisiones..."
                          : dirLinea.length > 0
                          ? "Seleccionar Ubicacion Administrativa"
                          : "No Posee Ubicaciones Administrativas"
                      }
                      searchPlaceholder="Buscar división o coordinación..."
                    />
                    <div className="text-[12px] text-gray-700 dark:text-gray-300">
                      Consultar Coordinaciones De La División
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                  {dirLinea.length > 0 && (
                    <div className="overflow-auto border rounded-2xl border-blue-700">
                      <Table>
                        <TableCaption>División</TableCaption>
                        <TableHeader className="bg-blue-600">
                          <TableRow>
                            <TableHead className="w-[100px] font-bold text-white">
                              Código
                            </TableHead>
                            <TableHead className="text-center font-bold text-white">
                              División
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dirLinea.map((general, i) => (
                            <TableRow key={general.id ?? i}>
                              <TableCell className="font-medium">
                                {general.codigo}
                              </TableCell>
                              <TableCell className="text-center">
                                {general.nombre}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="rounded-2xl">
                    {coordinaciones.length > 0 && (
                      <div className="overflow-auto border rounded-2xl border-blue-700">
                        <Table>
                          <TableCaption>Coordinación</TableCaption>
                          <TableHeader className="bg-blue-600">
                            <TableRow>
                              <TableHead className="w-[100px] font-bold text-white">
                                Código
                              </TableHead>
                              <TableHead className="text-center font-bold text-white">
                                Coordinación
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {coordinaciones.map((general, i) => (
                              <TableRow key={general.id ?? i}>
                                <TableCell className="font-medium">
                                  {general.codigo}
                                </TableCell>
                                <TableCell className="text-center">
                                  {general.nombre}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organismos" className="flex flex-col gap-6">
            <OrganismoAdmin items={organismos} onChanged={recargarOrganismos} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
