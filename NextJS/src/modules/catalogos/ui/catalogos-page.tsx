"use client";

/**
 * Página de consulta de catálogos del módulo catalogos. Cliente + react-hook-form
 * + zodResolver; la consulta a la Server Action va envuelta en useTransition (R8)
 * y opera exclusivamente con DTOs (R5). No importa de `infrastructure/` el
 * repositorio, solo la capa de acciones (R3). El thin wrapper en `app/(app)/`
 * se registrará cuando exista navegación.
 */
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Loader2, RefreshCw, SearchX } from "lucide-react";

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

import type { CatalogoItemDTO } from "../application/dtos/catalogos-dto";
import {
  getAlergiasAction,
  getCarrerasAction,
  getCapacitacionesAction,
  getCodigosPostalesAction,
  getCondicionesViviendaAction,
  getDiscapacidadesAction,
  getEstadosAction,
  getEstadosCivilesAction,
  getEstatusAction,
  getGradosAction,
  getGruposCapacitacionAction,
  getGruposSanguineosAction,
  getInstitucionesAction,
  getMencionesAction,
  getMunicipiosAction,
  getNivelesAcademicosAction,
  getParentescosAction,
  getParroquiasAction,
  getPatologiasAction,
  getPoliticasAction,
  getRegionesAction,
  getRegionesTallaAction,
  getSexosAction,
  getTallasAction,
  getTiposNominaAction,
  getTiposPersonalAction,
  getTiposPrendaAction,
  getTiposProcedenciaAction,
  getCategoriasMovimientoAction,
  getTiposMovimientoAction,
} from "../infrastructure/actions/catalogos-actions";
import {
  catalogoFiltroSchema,
  type CatalogoFiltroFormType,
  type CodigoCatalogo,
} from "./schema/schema-catalogos";

/** Etiquetas legibles por código de catálogo (coincide con `CATALOGOS_CODIGOS`). */
const ETIQUETAS: Record<CodigoCatalogo, string> = {
  regiones: "Regiones",
  estados: "Estados",
  municipios: "Municipios",
  parroquias: "Parroquias",
  sexos: "Sexos",
  estatus: "Estatus",
  "tipos-personal": "Tipos de personal",
  "tipos-nomina": "Tipos de nómina",
  parentescos: "Parentescos",
  "tipos-procedencia": "Tipos de procedencia",
  grados: "Grados",
  "categorias-movimiento": "Categorías de movimiento",
  "tipos-movimiento": "Tipos de movimiento",
  "estado-civil": "Estados civiles",
  politicas: "Políticas de contratación",
  "condiciones-vivienda": "Condiciones de vivienda",
  "codigos-postales": "Códigos postales",
  "grupos-sanguineos": "Grupos sanguíneos",
  "niveles-academicos": "Niveles académicos",
  carreras: "Carreras",
  menciones: "Menciones",
  instituciones: "Instituciones",
  "tipos-prenda": "Tipos de prenda",
  "regiones-talla": "Regiones de talla",
  tallas: "Tallas",
  capacitaciones: "Capacitaciones",
  "grupos-capacitacion": "Grupos de capacitación",
  alergias: "Alergias",
  patologias: "Patologías crónicas",
  discapacidades: "Discapacidades",
};

/**
 * Mapa código -> Server Action. Los catálogos geográficos y maestros comparten
 * la forma `{ id, nombre }` (CatalogoItemDTO), por lo que sus DTOs específicos
 * son asignables al DTO genérico. `categorias-movimiento` y `tipos-movimiento`
 * no tienen acción aún en el módulo frontal.
 */
const CARGAR: Partial<Record<CodigoCatalogo, () => Promise<CatalogoItemDTO[]>>> = {
  regiones: () => getRegionesAction(),
  estados: () => getEstadosAction(),
  municipios: () => getMunicipiosAction(),
  parroquias: () => getParroquiasAction(),
  sexos: () => getSexosAction(),
  estatus: () => getEstatusAction(),
  "tipos-personal": () => getTiposPersonalAction(),
  "tipos-nomina": () => getTiposNominaAction(),
  parentescos: () => getParentescosAction(),
  "tipos-procedencia": () => getTiposProcedenciaAction(),
  grados: () => getGradosAction(),
  "categorias-movimiento": () => getCategoriasMovimientoAction(),
  "tipos-movimiento": () => getTiposMovimientoAction(),
  "estado-civil": () => getEstadosCivilesAction(),
  politicas: () => getPoliticasAction(),
  "condiciones-vivienda": () => getCondicionesViviendaAction(),
  "codigos-postales": () => getCodigosPostalesAction(),
  "grupos-sanguineos": () => getGruposSanguineosAction(),
  "niveles-academicos": () => getNivelesAcademicosAction(),
  carreras: () => getCarrerasAction(),
  menciones: () => getMencionesAction(),
  instituciones: () => getInstitucionesAction(),
  "tipos-prenda": () => getTiposPrendaAction(),
  "regiones-talla": () => getRegionesTallaAction(),
  tallas: () => getTallasAction(),
  capacitaciones: () => getCapacitacionesAction(),
  "grupos-capacitacion": () => getGruposCapacitacionAction(),
  alergias: () => getAlergiasAction(),
  patologias: () => getPatologiasAction(),
  discapacidades: () => getDiscapacidadesAction(),
};

const COLUMNAS = 2;

export default function CatalogosPage() {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<CatalogoItemDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noDisponible, setNoDisponible] = useState(false);

  const form = useForm<CatalogoFiltroFormType>({
    resolver: zodResolver(catalogoFiltroSchema),
    defaultValues: { codigo: "sexos" },
  });

  const onSubmit = (data: CatalogoFiltroFormType) => {
    setError(null);
    const cargar = CARGAR[data.codigo];

    startTransition(async () => {
      if (!cargar) {
        setNoDisponible(true);
        setItems([]);
        return;
      }
      setNoDisponible(false);
      try {
        const resultado = await cargar();
        setItems(resultado);
      } catch {
        setError("No fue posible cargar el catálogo seleccionado.");
        setItems([]);
      }
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Layers className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Catálogos</h1>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Consultar catálogo</CardTitle>
          <CardDescription>
            Seleccione un catálogo de solo-lectura para listar sus registros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <Controller
              name="codigo"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label htmlFor="codigo">Catálogo</Label>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as CodigoCatalogo)}
                  >
                    <SelectTrigger
                      id="codigo"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Seleccione un catálogo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ETIQUETAS) as CodigoCatalogo[]).map((codigo) => (
                        <SelectItem key={codigo} value={codigo}>
                          {ETIQUETAS[codigo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p role="alert" className="text-sm text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                </Field>
              )}
            />

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                {isPending ? "Cargando..." : "Listar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">ID</TableHead>
              <TableHead>Nombre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="h-24 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="h-24 text-center text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : noDisponible ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMNAS}
                  className="h-24 text-center text-muted-foreground"
                >
                  El catálogo seleccionado aún no está disponible.
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMNAS}
                  className="h-24 text-center text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <SearchX className="size-4" aria-hidden="true" />
                    No hay registros. Seleccione un catálogo para consultar.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.id}</TableCell>
                  <TableCell>{item.nombre}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
