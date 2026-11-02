"use client";

/**
 * Página de consulta y gestión (CRUD) de catálogos del módulo catalogos.
 * Cumple Reglas Onion R1–R8:
 * - UI delgada cliente + react-hook-form + zodResolver
 * - Invoca exclusivamente Server Actions con useTransition
 * - No importa de infrastructure repositorios directos
 * - Toast feedback con sonner
 *
 * Patrón visual alineado con el resto de `modules/*` reconstruidos:
 * `DataTable` (tanstack) + menú de acciones por fila en vez de tabla HTML
 * plana, y el alta/edición vive en un diálogo (`catalogo-item-dialog.tsx`)
 * en vez de un `Card` de formulario siempre visible. Sin pérdida de
 * funcionalidad: sigue soportando el CRUD completo de catálogos editables
 * (incluyendo OrganismoAdscrito).
 */
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Loader2, Plus, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { tienePermiso } from "@/shared/lib/evaluador-iam";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/components/alert-dialog";
import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { DataTable } from "@/shared/ui/components/data-table";
import { Field } from "@/shared/ui/components/field";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogoItemDTO } from "../application/dtos/catalogos-dto";
import {
  eliminarAlergiaAction,
  eliminarDiscapacidadAction,
  eliminarOrganismoAdscritoAction,
  eliminarPatologiaAction,
  eliminarRegionTallaAction,
  eliminarTallaAction,
  eliminarTipoPrendaAction,
  getOrganismosAdscritosAction,
  getAlergiasAction,
  getCapacitacionesAction,
  getCarrerasAction,
  getCategoriasMovimientoAction,
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
  getTiposMovimientoAction,
  getTiposNominaAction,
  getTiposPersonalAction,
  getTiposPrendaAction,
  getTiposProcedenciaAction,
} from "../infrastructure/actions/catalogos-actions";
import CatalogoItemDialog from "./catalogo-item-dialog";
import { construirColumnasCatalogo } from "./catalogos-columns";
import {
  catalogoFiltroSchema,
  type CatalogoFiltroFormType,
  type CodigoCatalogo,
} from "./schema/schema-catalogos";

/** Etiquetas legibles por código de catálogo. */
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
  "organismos-adscritos": "Organismos adscritos",
};

/** Catálogos que permiten operaciones de creación y eliminación (CRUD de soporte). */
const CATALOGOS_EDITABLES: Set<CodigoCatalogo> = new Set([
  "alergias",
  "patologias",
  "discapacidades",
  "tallas",
  "regiones-talla",
  "tipos-prenda",
  "organismos-adscritos",
]);

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
  "organismos-adscritos": () => getOrganismosAdscritosAction(),
};

export default function CatalogosPage() {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<CatalogoItemDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noDisponible, setNoDisponible] = useState(false);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [itemEditando, setItemEditando] = useState<CatalogoItemDTO | null>(null);
  const [itemEliminando, setItemEliminando] = useState<CatalogoItemDTO | null>(null);

  const form = useForm<CatalogoFiltroFormType>({
    resolver: zodResolver(catalogoFiltroSchema),
    defaultValues: { codigo: "alergias" },
  });

  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrear = tienePermiso(permisos, "catalogos.crear");
  const puedeEditar = tienePermiso(permisos, "catalogos.editar");
  const puedeEliminar = tienePermiso(permisos, "catalogos.eliminar");

  const catalogoActual = form.watch("codigo");
  const esEditable = CATALOGOS_EDITABLES.has(catalogoActual);

  const cargarDatos = (codigo: CodigoCatalogo) => {
    setError(null);
    const cargar = CARGAR[codigo];
    startTransition(async () => {
      if (!cargar) {
        setNoDisponible(true);
        setItems([]);
        return;
      }
      setNoDisponible(false);
      try {
        setItems(await cargar());
      } catch {
        setError("No fue posible cargar el catálogo seleccionado.");
        setItems([]);
      }
    });
  };

  const onSubmit = (data: CatalogoFiltroFormType) => cargarDatos(data.codigo);

  useEffect(() => {
    cargarDatos("alergias");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEliminarItem = () => {
    if (!itemEliminando) return;
    const item = itemEliminando;
    startTransition(async () => {
      let res: { success: boolean; message: string };
      if (catalogoActual === "alergias") {
        res = await eliminarAlergiaAction({ id: item.id });
      } else if (catalogoActual === "patologias") {
        res = await eliminarPatologiaAction({ id: item.id });
      } else if (catalogoActual === "discapacidades") {
        res = await eliminarDiscapacidadAction({ id: item.id });
      } else if (catalogoActual === "tallas") {
        res = await eliminarTallaAction({ id: item.id });
      } else if (catalogoActual === "regiones-talla") {
        res = await eliminarRegionTallaAction({ id: item.id });
      } else if (catalogoActual === "tipos-prenda") {
        res = await eliminarTipoPrendaAction({ id: item.id });
      } else if (catalogoActual === "organismos-adscritos") {
        res = await eliminarOrganismoAdscritoAction({ id: item.id });
      } else {
        return;
      }

      if (res.success) {
        toast.success(res.message);
        cargarDatos(catalogoActual);
      } else {
        toast.error(res.message);
      }
      setItemEliminando(null);
    });
  };

  const columnas = construirColumnasCatalogo(
    catalogoActual,
    esEditable && puedeEditar && catalogoActual === "organismos-adscritos",
    esEditable && puedeEliminar,
    (item) => {
      setItemEditando(item);
      setDialogoAbierto(true);
    },
    (item) => setItemEliminando(item),
  );

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Layers className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Catálogos</h1>
      </header>

      {/* Selector de Catálogo */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Consultar catálogo</CardTitle>
          <CardDescription>
            Seleccione un catálogo institucional para listar y administrar sus registros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Controller
              name="codigo"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label htmlFor="codigo">Catálogo</Label>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value as CodigoCatalogo);
                      cargarDatos(value as CodigoCatalogo);
                    }}
                  >
                    <SelectTrigger id="codigo" className="w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Seleccione un catálogo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ETIQUETAS) as CodigoCatalogo[]).map((codigo) => (
                        <SelectItem key={codigo} value={codigo}>
                          {ETIQUETAS[codigo]} {CATALOGOS_EDITABLES.has(codigo) ? "(Editable)" : ""}
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
            <div>
              <Button type="submit" variant="outline" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                {isPending ? "Cargando..." : "Actualizar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {noDisponible ? (
        <p className="text-sm text-muted-foreground">El catálogo seleccionado aún no está disponible.</p>
      ) : (
        <DataTable
          columns={columnas}
          data={items}
          emptyMessage="No hay registros en este catálogo."
          toolbar={
            esEditable && puedeCrear ? (
              <Button
                size="sm"
                onClick={() => {
                  setItemEditando(null);
                  setDialogoAbierto(true);
                }}
              >
                <Plus className="size-4" aria-hidden="true" /> Agregar {ETIQUETAS[catalogoActual]}
              </Button>
            ) : undefined
          }
        />
      )}

      <CatalogoItemDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        codigo={catalogoActual}
        etiqueta={ETIQUETAS[catalogoActual]}
        itemEditando={itemEditando}
        onGuardado={() => cargarDatos(catalogoActual)}
      />

      <AlertDialog open={!!itemEliminando} onOpenChange={(open) => !open && setItemEliminando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar &quot;{itemEliminando?.nombre}&quot;</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                handleEliminarItem();
              }}
            >
              {isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
