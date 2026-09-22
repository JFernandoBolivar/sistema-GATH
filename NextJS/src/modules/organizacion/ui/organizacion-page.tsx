"use client";

/**
 * Página principal de organización: "Explorar" (cascada de lectura
 * jerárquica: dependencia → dirección general → línea → coordinaciones +
 * organismos adscritos), paridad estructural con el listado del legado
 * (`listado-ubicacion-administrativa/` — cascada de selects + tablas
 * planas, sin DataTable/tanstack en el legado tampoco). La administración
 * (crear/editar/eliminar) de cada nivel vive en su propia ruta —
 * `/organizacion/dependencias`, `/organizacion/direcciones-generales`,
 * `/organizacion/direcciones-linea`, `/organizacion/coordinaciones` —
 * paridad con los "4 flujos separados" del legado
 * (`crear-ubicacion/` + `crear-ubicacion-administrativa-direccion/` +
 * `actualizar-ubicacion/`, cada nivel jerárquico con su propio espacio).
 *
 * Organismos adscritos se mantiene como pestaña de esta misma página: en
 * el legado esa gestión vive en un módulo distinto ("retroalimentacion"),
 * pero en el backend nuevo pertenece a `apps.organizacion` — se prioriza
 * no perder capacidad funcional existente sobre inventar una ubicación
 * nueva fuera de alcance.
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
import {
  Building2,
  Loader2,
  Map,
  Network,
  RefreshCw,
} from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import PageLayout from "@/components/layout/page-layout";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Label } from "@/shared/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import {
  Table,
  TableBody,
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
import {
  organizacionFilterSchema,
  type OrganizacionFilterType,
} from "./schema/schema-organizacion";

const FLUJOS = [
  { href: "/organizacion/dependencias", label: "Dependencias", icon: Network },
  { href: "/organizacion/direcciones-generales", label: "Direcciones generales", icon: Network },
  { href: "/organizacion/direcciones-linea", label: "Direcciones de línea", icon: Network },
  { href: "/organizacion/coordinaciones", label: "Coordinaciones", icon: Network },
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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OrganizacionFilterType>({
    resolver: zodResolver(organizacionFilterSchema),
    defaultValues: { dependenciaId: undefined, direccionGeneralId: undefined, direccionLineaId: undefined },
  });

  const cargar = (fn: () => Promise<unknown>, setter: (d: never[]) => void) => {
    startTransition(async () => {
      setError(null);
      try {
        setter((await fn()) as never[]);
      } catch {
        setError("No fue posible cargar la información de organización.");
      }
    });
  };

  const cargarDependencias = () => cargar(getDependenciasAction, setDependencias);
  const cargarOrganismos = () => cargar(getOrganismosAdscritosAction, setOrganismos);

  useEffect(() => {
    cargarDependencias();
    cargarOrganismos();
  }, []);

  const onDependencia = (dependenciaId: number) => {
    form.setValue("dependenciaId", dependenciaId);
    form.setValue("direccionGeneralId", undefined);
    form.setValue("direccionLineaId", undefined);
    setDirGenerales([]);
    setDirLinea([]);
    setCoordinaciones([]);
    cargar(() => getDireccionesGeneralesAction(dependenciaId), setDirGenerales);
  };

  const onDireccionGeneral = (direccionGeneralId: number) => {
    form.setValue("direccionGeneralId", direccionGeneralId);
    form.setValue("direccionLineaId", undefined);
    setDirLinea([]);
    setCoordinaciones([]);
    cargar(() => getDireccionesLineaAction(direccionGeneralId), setDirLinea);
  };

  const onDireccionLinea = (direccionLineaId: number) => {
    form.setValue("direccionLineaId", direccionLineaId);
    setCoordinaciones([]);
    cargar(() => getCoordinacionesAction(direccionLineaId), setCoordinaciones);
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
              {FLUJOS.map((f) => (
                <Button key={f.href} asChild variant="outline" size="sm">
                  <Link href={f.href}><f.icon className="size-4" aria-hidden="true" /> {f.label}</Link>
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
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Explorar estructura</CardTitle>
                <CardDescription>
                  Seleccione los niveles para ver jerarquías y organismos adscritos.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field>
                    <Label htmlFor="dependenciaId">Dependencia</Label>
                    <Select value={form.watch("dependenciaId")?.toString() ?? ""} onValueChange={(v) => onDependencia(Number(v))}>
                      <SelectTrigger id="dependenciaId">
                        <SelectValue placeholder="Seleccione una dependencia" />
                      </SelectTrigger>
                      <SelectContent>
                        {dependencias.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <Label htmlFor="direccionGeneralId">Dirección general</Label>
                    <Select value={form.watch("direccionGeneralId")?.toString() ?? ""} onValueChange={(v) => onDireccionGeneral(Number(v))}>
                      <SelectTrigger id="direccionGeneralId">
                        <SelectValue placeholder={dirGenerales.length ? "Seleccione" : "Seleccione una dependencia primero"} />
                      </SelectTrigger>
                      <SelectContent>
                        {dirGenerales.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <Label htmlFor="direccionLineaId">Dirección de línea</Label>
                    <Select value={form.watch("direccionLineaId")?.toString() ?? ""} onValueChange={(v) => onDireccionLinea(Number(v))}>
                      <SelectTrigger id="direccionLineaId">
                        <SelectValue placeholder={dirLinea.length ? "Seleccione" : "Seleccione una dirección general primero"} />
                      </SelectTrigger>
                      <SelectContent>
                        {dirLinea.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={cargarDependencias} disabled={isPending}>
                    {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Map className="size-4" aria-hidden="true" />}
                    Cargar dependencias
                  </Button>
                  <Button type="button" variant="outline" onClick={cargarOrganismos} disabled={isPending}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Organismos adscritos
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Coordinaciones</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {coordinaciones.length === 0 ? (
                      <TableRow><TableCell className="h-16 text-center text-muted-foreground">Sin coordinaciones en el nivel seleccionado.</TableCell></TableRow>
                    ) : (
                      coordinaciones.map((c) => (
                        <TableRow key={c.id}><TableCell>{c.nombre}</TableCell></TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Organismos adscritos</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {organismos.length === 0 ? (
                      <TableRow><TableCell className="h-16 text-center text-muted-foreground">Sin organismos adscritos.</TableCell></TableRow>
                    ) : (
                      organismos.map((o) => (
                        <TableRow key={o.id}><TableCell>{o.nombre}</TableCell></TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="organismos" className="flex flex-col gap-6">
            <OrganismoAdmin items={organismos} onChanged={cargarOrganismos} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
