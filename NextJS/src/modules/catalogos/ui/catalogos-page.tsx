"use client";

/**
 * Página de consulta y gestión (CRUD) de catálogos del módulo catalogos.
 * Cumple Reglas Onion R1–R8:
 * - UI delgada cliente + react-hook-form + zodResolver
 * - Invoca exclusivamente Server Actions con useTransition
 * - No importa de infrastructure repositorios directos
 * - Toast feedback con sonner
 */
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FolderPlus,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
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
  crearAlergiaAction,
  crearCategoriaAlergiaAction,
  crearCategoriaDiscapacidadAction,
  crearCategoriaPatologiaAction,
  crearDiscapacidadAction,
  crearPatologiaAction,
  crearRegionTallaAction,
  crearTallaAction,
  crearTipoPrendaAction,
  crearOrganismoAdscritoAction,
  actualizarOrganismoAdscritoAction,
  eliminarOrganismoAdscritoAction,
  eliminarAlergiaAction,
  eliminarDiscapacidadAction,
  eliminarPatologiaAction,
  eliminarRegionTallaAction,
  eliminarTallaAction,
  eliminarTipoPrendaAction,
  getOrganismosAdscritosAction,
  getAlergiasAction,
  getCapacitacionesAction,
  getCarrerasAction,
  getCategoriasAlergiaAction,
  getCategoriasDiscapacidadAction,
  getCategoriasMovimientoAction,
  getCategoriasPatologiaAction,
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

  // Estados para formulario de alta de soporte
  const [mostrarFormCrear, setMostrarFormCrear] = useState(false);
  const [itemEditando, setItemEditando] = useState<CatalogoItemDTO | null>(null);
  const [nombreItem, setNombreItem] = useState("");
  const [categoriaIdSeleccionada, setCategoriaIdSeleccionada] = useState<string>("");
  const [regionIdSeleccionada, setRegionIdSeleccionada] = useState<string>("");
  const [tipoPrendaIdSeleccionada, setTipoPrendaIdSeleccionada] = useState<string>("");
  const [descripcionRegion, setDescripcionRegion] = useState("");

  // Sub-formulario para agregar nueva categoría rápidamente
  const [mostrarCrearCategoria, setMostrarCrearCategoria] = useState(false);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");

  // Opciones auxiliares para selects
  const [categoriasSalud, setCategoriasSalud] = useState<CatalogoItemDTO[]>([]);
  const [regionesTallaOpciones, setRegionesTallaOpciones] = useState<CatalogoItemDTO[]>([]);
  const [tiposPrendaOpciones, setTiposPrendaOpciones] = useState<CatalogoItemDTO[]>([]);

  const form = useForm<CatalogoFiltroFormType>({
    resolver: zodResolver(catalogoFiltroSchema),
    defaultValues: { codigo: "alergias" },
  });

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
        const resultado = await cargar();
        setItems(resultado);
      } catch {
        setError("No fue posible cargar el catálogo seleccionado.");
        setItems([]);
      }
    });
  };

  const onSubmit = (data: CatalogoFiltroFormType) => {
    setMostrarFormCrear(false);
    setItemEditando(null);
    cargarDatos(data.codigo);
  };

  // Cargar dependencias auxiliares según catálogo actual
  useEffect(() => {
    if (catalogoActual === "alergias") {
      getCategoriasAlergiaAction().then(setCategoriasSalud).catch(() => {});
    } else if (catalogoActual === "patologias") {
      getCategoriasPatologiaAction().then(setCategoriasSalud).catch(() => {});
    } else if (catalogoActual === "discapacidades") {
      getCategoriasDiscapacidadAction().then(setCategoriasSalud).catch(() => {});
    } else if (catalogoActual === "tallas") {
      getRegionesTallaAction().then(setRegionesTallaOpciones).catch(() => {});
      getTiposPrendaAction().then(setTiposPrendaOpciones).catch(() => {});
    }
  }, [catalogoActual]);

  // Cargar por defecto al montar
  useEffect(() => {
    cargarDatos("alergias");
  }, []);

  const handleCrearCategoriaRapida = async () => {
    if (!nuevaCategoriaNombre.trim()) {
      toast.error("El nombre de la categoría es requerido.");
      return;
    }
    startTransition(async () => {
      let res: { success: boolean; message: string; item?: CatalogoItemDTO };
      if (catalogoActual === "alergias") {
        res = await crearCategoriaAlergiaAction({ nombre_categoria: nuevaCategoriaNombre });
      } else if (catalogoActual === "patologias") {
        res = await crearCategoriaPatologiaAction({ nombre_categoria: nuevaCategoriaNombre });
      } else {
        res = await crearCategoriaDiscapacidadAction({ nombre_categoria: nuevaCategoriaNombre });
      }

      if (res.success) {
        toast.success(res.message);
        setNuevaCategoriaNombre("");
        setMostrarCrearCategoria(false);
        // Recargar categorías
        if (catalogoActual === "alergias") {
          const list = await getCategoriasAlergiaAction();
          setCategoriasSalud(list);
        } else if (catalogoActual === "patologias") {
          const list = await getCategoriasPatologiaAction();
          setCategoriasSalud(list);
        } else {
          const list = await getCategoriasDiscapacidadAction();
          setCategoriasSalud(list);
        }
        if (res.item) {
          setCategoriaIdSeleccionada(String(res.item.id));
        }
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleCrearItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreItem.trim()) {
      toast.error("El nombre o valor es requerido.");
      return;
    }

    startTransition(async () => {
      let res: { success: boolean; message: string; item?: CatalogoItemDTO };

      if (catalogoActual === "alergias") {
        if (!categoriaIdSeleccionada) {
          toast.error("Debe seleccionar una categoría.");
          return;
        }
        res = await crearAlergiaAction({
          alergia: nombreItem,
          categoria_id: Number(categoriaIdSeleccionada),
        });
      } else if (catalogoActual === "patologias") {
        if (!categoriaIdSeleccionada) {
          toast.error("Debe seleccionar una categoría.");
          return;
        }
        res = await crearPatologiaAction({
          patologia: nombreItem,
          categoria_id: Number(categoriaIdSeleccionada),
        });
      } else if (catalogoActual === "discapacidades") {
        if (!categoriaIdSeleccionada) {
          toast.error("Debe seleccionar una categoría.");
          return;
        }
        res = await crearDiscapacidadAction({
          discapacidad: nombreItem,
          categoria_id: Number(categoriaIdSeleccionada),
        });
      } else if (catalogoActual === "tallas") {
        if (!regionIdSeleccionada || !tipoPrendaIdSeleccionada) {
          toast.error("Debe seleccionar región y tipo de prenda.");
          return;
        }
        res = await crearTallaAction({
          valor: nombreItem,
          region_id: Number(regionIdSeleccionada),
          tipo_prenda_id: Number(tipoPrendaIdSeleccionada),
        });
      } else if (catalogoActual === "regiones-talla") {
        res = await crearRegionTallaAction({
          codigo: nombreItem,
          descripcion: descripcionRegion || null,
        });
      } else if (catalogoActual === "tipos-prenda") {
        res = await crearTipoPrendaAction({
          categoria: nombreItem,
        });
      } else if (catalogoActual === "organismos-adscritos") {
        if (itemEditando) {
          res = await actualizarOrganismoAdscritoAction({
            id: itemEditando.id,
            nombre: nombreItem,
          });
        } else {
          res = await crearOrganismoAdscritoAction({
            nombre: nombreItem,
          });
        }
      } else {
        return;
      }

      if (res.success) {
        toast.success(res.message);
        setItemEditando(null);
        setNombreItem("");
        setDescripcionRegion("");
        setMostrarFormCrear(false);
        cargarDatos(catalogoActual);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleEliminarItem = (id: number, nombre: string) => {
    if (!confirm(`¿Está seguro de eliminar "${nombre}"?`)) return;

    startTransition(async () => {
      let res: { success: boolean; message: string };
      if (catalogoActual === "alergias") {
        res = await eliminarAlergiaAction({ id });
      } else if (catalogoActual === "patologias") {
        res = await eliminarPatologiaAction({ id });
      } else if (catalogoActual === "discapacidades") {
        res = await eliminarDiscapacidadAction({ id });
      } else if (catalogoActual === "tallas") {
        res = await eliminarTallaAction({ id });
      } else if (catalogoActual === "regiones-talla") {
        res = await eliminarRegionTallaAction({ id });
      } else if (catalogoActual === "tipos-prenda") {
        res = await eliminarTipoPrendaAction({ id });
      } else if (catalogoActual === "organismos-adscritos") {
        res = await eliminarOrganismoAdscritoAction({ id });
      } else {
        return;
      }

      if (res.success) {
        toast.success(res.message);
        cargarDatos(catalogoActual);
      } else {
        toast.error(res.message);
      }
    });
  };

  const columnasTotal = esEditable ? 3 : 2;

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">Catálogos</h1>
        </div>
        {esEditable && (
          <Button
            variant={mostrarFormCrear ? "outline" : "default"}
            size="sm"
            onClick={() => {
              if (mostrarFormCrear) {
                setMostrarFormCrear(false);
                setItemEditando(null);
                setNombreItem("");
              } else {
                setItemEditando(null);
                setNombreItem("");
                setMostrarFormCrear(true);
              }
            }}
          >
            {mostrarFormCrear ? (
              <>
                <X className="size-4 mr-1" aria-hidden="true" /> Cerrar formulario
              </>
            ) : (
              <>
                <Plus className="size-4 mr-1" aria-hidden="true" /> Agregar {ETIQUETAS[catalogoActual]}
              </>
            )}
          </Button>
        )}
      </header>

      {/* Formulario de Alta / Creación para Catálogos de Soporte */}
      {esEditable && mostrarFormCrear && (
        <Card className="border-primary/40 bg-accent/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {itemEditando ? "Editar registro en" : "Nuevo registro en"} {ETIQUETAS[catalogoActual]}
            </CardTitle>
            <CardDescription>
              {itemEditando
                ? "Modifique los datos del elemento seleccionado."
                : "Complete los campos para registrar un nuevo elemento en este catálogo."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCrearItem} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nombreItem">
                    {catalogoActual === "regiones-talla"
                      ? "Código de Región (máx. 10 car.)"
                      : catalogoActual === "tallas"
                      ? "Valor de Talla (ej. M, 38, XL)"
                      : catalogoActual === "organismos-adscritos"
                      ? "Nombre del Organismo Adscrito"
                      : "Nombre / Descripción"}
                  </Label>
                  <Input
                    id="nombreItem"
                    value={nombreItem}
                    onChange={(e) => setNombreItem(e.target.value)}
                    placeholder={
                      catalogoActual === "regiones-talla"
                        ? "Ej. ADULTO"
                        : catalogoActual === "tallas"
                        ? "Ej. M o 38"
                        : catalogoActual === "organismos-adscritos"
                        ? "Ej. CONATEL, VTV, CANTV"
                        : "Nombre..."
                    }
                    maxLength={
                      catalogoActual === "regiones-talla"
                        ? 10
                        : catalogoActual === "organismos-adscritos"
                        ? 50
                        : 100
                    }
                    disabled={isPending}
                    required
                  />
                </div>

                {/* Select de Categoría para Salud */}
                {(catalogoActual === "alergias" ||
                  catalogoActual === "patologias" ||
                  catalogoActual === "discapacidades") && (
                  <div>
                    <div className="flex items-center justify-between pb-1">
                      <Label htmlFor="catSalud">Categoría</Label>
                      <button
                        type="button"
                        onClick={() => setMostrarCrearCategoria(!mostrarCrearCategoria)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <FolderPlus className="size-3" />
                        {mostrarCrearCategoria ? "Cancelar" : "+ Nueva Categoría"}
                      </button>
                    </div>
                    {mostrarCrearCategoria ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nombre de nueva categoría..."
                          value={nuevaCategoriaNombre}
                          onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                          disabled={isPending}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCrearCategoriaRapida}
                          disabled={isPending}
                        >
                          Crear
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={categoriaIdSeleccionada}
                        onValueChange={setCategoriaIdSeleccionada}
                      >
                        <SelectTrigger id="catSalud">
                          <SelectValue placeholder="Seleccione categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriasSalud.map((cat) => (
                            <SelectItem key={cat.id} value={String(cat.id)}>
                              {cat.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Selects para Talla */}
                {catalogoActual === "tallas" && (
                  <>
                    <div>
                      <Label htmlFor="regionSelect">Región de Talla</Label>
                      <Select
                        value={regionIdSeleccionada}
                        onValueChange={setRegionIdSeleccionada}
                      >
                        <SelectTrigger id="regionSelect">
                          <SelectValue placeholder="Seleccione región" />
                        </SelectTrigger>
                        <SelectContent>
                          {regionesTallaOpciones.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="prendaSelect">Tipo de Prenda</Label>
                      <Select
                        value={tipoPrendaIdSeleccionada}
                        onValueChange={setTipoPrendaIdSeleccionada}
                      >
                        <SelectTrigger id="prendaSelect">
                          <SelectValue placeholder="Seleccione tipo de prenda" />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposPrendaOpciones.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Descripción para Región Talla */}
                {catalogoActual === "regiones-talla" && (
                  <div>
                    <Label htmlFor="descRegion">Descripción (opcional)</Label>
                    <Input
                      id="descRegion"
                      value={descripcionRegion}
                      onChange={(e) => setDescripcionRegion(e.target.value)}
                      placeholder="Ej. Tallas para adulto"
                      disabled={isPending}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMostrarFormCrear(false);
                    setItemEditando(null);
                    setNombreItem("");
                  }}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin mr-1" />
                  ) : itemEditando ? (
                    <Pencil className="size-4 mr-1" />
                  ) : (
                    <Plus className="size-4 mr-1" />
                  )}
                  {itemEditando ? "Actualizar" : "Guardar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Selector de Catálogo */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Consultar catálogo</CardTitle>
          <CardDescription>
            Seleccione un catálogo institucional para listar y administrar sus registros.
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
                    onValueChange={(value) => {
                      field.onChange(value as CodigoCatalogo);
                      setMostrarFormCrear(false);
                      cargarDatos(value as CodigoCatalogo);
                    }}
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

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}>
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

      {/* Tabla de Registros */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">ID</TableHead>
              <TableHead>Nombre</TableHead>
              {esEditable && <TableHead className="w-24 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={columnasTotal} className="h-24 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columnasTotal} className="h-24 text-center text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : noDisponible ? (
              <TableRow>
                <TableCell
                  colSpan={columnasTotal}
                  className="h-24 text-center text-muted-foreground"
                >
                  El catálogo seleccionado aún no está disponible.
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnasTotal}
                  className="h-24 text-center text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <SearchX className="size-4" aria-hidden="true" />
                    No hay registros en este catálogo.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.id}</TableCell>
                  <TableCell>{item.nombre}</TableCell>
                  {esEditable && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {catalogoActual === "organismos-adscritos" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-primary hover:text-primary hover:bg-primary/10"
                            title="Editar elemento"
                            aria-label={`Editar ${item.nombre}`}
                            onClick={() => {
                              setItemEditando(item);
                              setNombreItem(item.nombre);
                              setMostrarFormCrear(true);
                            }}
                            disabled={isPending}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Eliminar elemento"
                          aria-label={`Eliminar ${item.nombre}`}
                          onClick={() => handleEliminarItem(item.id, item.nombre)}
                          disabled={isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
