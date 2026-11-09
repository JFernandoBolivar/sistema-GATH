"use client";

/**
 * Reglas de catálogos del sistema (A5).
 * Control de marcas y reglas operativas sobre tablas maestras:
 *  1. Parentescos: interruptor «Permitido para familiares» (aplica_familiar).
 *  2. Motivos de movimiento: lista agrupada por categoría con selector para cambiar
 *     categoría y modal para crear nuevo motivo. Bloquea motivos reservados del sistema
 *     y no permite dejar sin motivos una categoría requerida.
 *  3. Tipos de nómina: interruptores «Nómina activa» y «Requiere código» con advertencia.
 */
import { useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, ChevronRight, GripVertical, Info, Lock, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type {
  ReglaMotivoDTO,
  ReglaNominaDTO,
  ReglaPaisDTO,
  ReglaParentescoDTO,
  ReglaTipoSoporteDTO,
  ReglasCatalogosCompletoDTO,
} from "../application/dtos/reglas-catalogos-dto";
import {
  actualizarChecklistSoporteAction,
  actualizarMotivoAction,
  actualizarNominaAction,
  actualizarPaisAction,
  actualizarParentescoAction,
  actualizarTipoSoporteAction,
  cambiarCategoriaMotivoAction,
  crearMotivoAction,
  crearNominaAction,
  crearPaisAction,
  crearParentescoAction,
  crearTipoSoporteAction,
  editarParentescoAction,
  eliminarMotivoAction,
  eliminarNominaAction,
  eliminarPaisAction,
  eliminarParentescoAction,
  eliminarTipoSoporteAction,
  obtenerReglasCatalogosAction,
  reordenarTiposSoporteAction,
} from "../infrastructure/actions/reglas-catalogos-actions";
import { ChecklistSoporteSeccion } from "./checklist-soporte-seccion";
import { PERMISO_CONFIGURACION } from "../domain/value-objects/permisos-configuracion";

const PERMISO_VER = "configuracion.ver";
const PERMISO_CATALOGOS_VER = "catalogos.ver";
const PERMISO_CATALOGOS_EDITAR = "catalogos.editar";
const PERMISO_CATALOGOS_CREAR = "catalogos.crear";

function esError(resultado: unknown): resultado is { error: string; errores?: Record<string, string[]> } {
  return typeof resultado === "object" && resultado !== null && "error" in resultado;
}

/** FIX-FAM2: campos de la regla del parentesco en el formulario (números como texto). */
type ReglaParentescoForm = {
  esHijo: boolean;
  menorACargo: boolean;
  sinCedulaHastaEdad: string;
  edadMinima: string;
  diferenciaMinima: string;
  diferenciaTipo: "NINGUNA" | "MENOR" | "MAYOR";
  sexoPermitido: "" | "M" | "F";
  soporteSugerido: string;
  activo: boolean;
};

function reglaFormDe(p?: ReglaParentescoDTO | null): ReglaParentescoForm {
  return {
    esHijo: p?.es_hijo ?? false,
    menorACargo: p?.menor_a_cargo ?? false,
    sinCedulaHastaEdad: p?.sin_cedula_hasta_edad != null ? String(p.sin_cedula_hasta_edad) : "",
    edadMinima: p?.edad_minima != null ? String(p.edad_minima) : "",
    diferenciaMinima: p?.diferencia_minima != null ? String(p.diferencia_minima) : "",
    diferenciaTipo: p?.diferencia_tipo ?? "NINGUNA",
    sexoPermitido: p?.sexo_permitido ?? "",
    soporteSugerido: p?.soporte_sugerido ?? "",
    activo: p?.activo ?? true,
  };
}

function numeroDeTexto(valor: string): number | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function reglaPayload(f: ReglaParentescoForm) {
  return {
    es_hijo: f.esHijo,
    menor_a_cargo: f.menorACargo,
    sin_cedula_hasta_edad: f.esHijo || f.menorACargo ? numeroDeTexto(f.sinCedulaHastaEdad) : null,
    edad_minima: numeroDeTexto(f.edadMinima),
    diferencia_minima: f.diferenciaTipo === "NINGUNA" ? null : numeroDeTexto(f.diferenciaMinima),
    diferencia_tipo: f.diferenciaTipo,
    sexo_permitido: f.sexoPermitido,
    soporte_sugerido: f.soporteSugerido.trim(),
    activo: f.activo,
  };
}

function resumenReglas(p: ReglaParentescoDTO): string[] {
  const items: string[] = [];
  if (p.es_hijo) items.push("Hijo");
  if (p.menor_a_cargo) items.push("Menor a cargo");
  if (p.sin_cedula_hasta_edad != null) items.push(`Sin cédula < ${p.sin_cedula_hasta_edad}`);
  if (p.edad_minima != null) items.push(`Edad ≥ ${p.edad_minima}`);
  if (p.diferencia_minima != null && p.diferencia_tipo !== "NINGUNA") {
    items.push(`Dif. ≥ ${p.diferencia_minima} ${p.diferencia_tipo === "MENOR" ? "menor" : "mayor"}`);
  }
  if (p.sexo_permitido) items.push(`Sexo ${p.sexo_permitido}`);
  return items;
}

interface FilaTipoSoporteSortableProps {
  tipo: ReglaTipoSoporteDTO;
  posicion: number;
  puedeEditar: boolean;
  isPending: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}

function FilaTipoSoporteSortable({
  tipo,
  posicion,
  puedeEditar,
  isPending,
  onEditar,
  onEliminar,
}: FilaTipoSoporteSortableProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tipo.id, disabled: !puedeEditar || isPending });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : undefined,
  };

  const protegido = tipo.es_reservado || tipo.es_protegido;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-muted/50" : undefined}
    >
      <TableCell className="w-[180px]">
        <div className="flex items-center gap-2">
          {puedeEditar ? (
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground touch-none focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={`Reordenar ${tipo.nombre}. Posición actual ${posicion}. Pulse espacio o enter para arrastrar con flechas.`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            #{posicion}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{tipo.codigo}</TableCell>
      <TableCell className="font-medium">{tipo.nombre}</TableCell>
      <TableCell>
        {protegido ? (
          <Badge variant="secondary" className="text-xs">
            <Lock className="mr-1 size-3" aria-hidden /> Reservado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Configurable
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Editar ${tipo.nombre}`}
            disabled={!puedeEditar || isPending}
            onClick={onEditar}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Eliminar ${tipo.nombre}`}
            disabled={!puedeEditar || isPending || protegido}
            onClick={onEliminar}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ConfiguracionReglasCatalogosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer =
    tienePermiso(permisos, PERMISO_VER) ||
    tienePermiso(permisos, PERMISO_CONFIGURACION.editar) ||
    tienePermiso(permisos, PERMISO_CATALOGOS_VER) ||
    tienePermiso(permisos, PERMISO_CATALOGOS_EDITAR);
  const puedeEditar =
    tienePermiso(permisos, PERMISO_CONFIGURACION.editar) ||
    tienePermiso(permisos, PERMISO_CATALOGOS_EDITAR) ||
    tienePermiso(permisos, PERMISO_CATALOGOS_CREAR);

  const [isPending, startTransition] = useTransition();

  // Estados para diálogos de confirmación
  const [confirmParentesco, setConfirmParentesco] = useState<{
    parentesco: ReglaParentescoDTO;
    nuevoValor: boolean;
  } | null>(null);

  const [confirmMotivo, setConfirmMotivo] = useState<{
    motivo: ReglaMotivoDTO;
    nuevaCategoriaId: number;
    nuevaCategoriaNombre: string;
  } | null>(null);

  const [confirmNomina, setConfirmNomina] = useState<{
    nomina: ReglaNominaDTO;
    campo: "es_activo" | "requiere_codig";
    nuevoValor: boolean;
  } | null>(null);

  // Estado para modal de crear nuevo motivo
  const [modalNuevoMotivo, setModalNuevoMotivo] = useState(false);
  const [nuevoMovimiento, setNuevoMovimiento] = useState("");
  const [categoriaNuevoMotivo, setCategoriaNuevoMotivo] = useState<number | null>(null);
  const [errorNuevoMotivo, setErrorNuevoMotivo] = useState<string | null>(null);

  // Estados para editar y eliminar motivo
  const [editarMotivo, setEditarMotivo] = useState<{
    motivo: ReglaMotivoDTO;
    nombre: string;
    categoriaId: number;
    activo: boolean;
  } | null>(null);
  const [errorEditarMotivo, setErrorEditarMotivo] = useState<string | null>(null);
  const [eliminarMotivo, setEliminarMotivo] = useState<ReglaMotivoDTO | null>(null);

  // O36: alta/edición/baja de parentescos y tipos de nómina
  const [dialogoParentesco, setDialogoParentesco] = useState<{
    modo: "crear" | "editar";
    parentesco: ReglaParentescoDTO | null;
    descripcion: string;
    aplicaFamiliar: boolean;
    regla: ReglaParentescoForm;
  } | null>(null);
  const [errorDialogoParentesco, setErrorDialogoParentesco] = useState<string | null>(null);
  const [eliminarParentesco, setEliminarParentesco] = useState<ReglaParentescoDTO | null>(null);

  const [dialogoPais, setDialogoPais] = useState<{
    modo: "crear" | "editar";
    pais: ReglaPaisDTO | null;
    nombre: string;
    codigo: string;
  } | null>(null);
  const [errorDialogoPais, setErrorDialogoPais] = useState<string | null>(null);
  const [eliminarPais, setEliminarPais] = useState<ReglaPaisDTO | null>(null);

  // Paginación y búsqueda para catálogo de Países
  const [busquedaPais, setBusquedaPais] = useState("");
  const [paginaPais, setPaginaPais] = useState(1);
  const [tamanoPaginaPais, setTamanoPaginaPais] = useState<10 | 25 | 50>(10);

  const [dialogoNomina, setDialogoNomina] = useState<{
    modo: "crear" | "editar";
    nomina: ReglaNominaDTO | null;
    nombre: string;
    esActivo: boolean;
    requiereCodig: boolean;
  } | null>(null);
  const [errorDialogoNomina, setErrorDialogoNomina] = useState<string | null>(null);
  const [eliminarNomina, setEliminarNomina] = useState<ReglaNominaDTO | null>(null);

  // O41: tipos de soporte documental
  const [dialogoTipoSoporte, setDialogoTipoSoporte] = useState<{
    modo: "crear" | "editar";
    tipo: ReglaTipoSoporteDTO | null;
    codigo: string;
    nombre: string;
    orden: string;
  } | null>(null);
  const [errorDialogoTipoSoporte, setErrorDialogoTipoSoporte] = useState<string | null>(null);
  const [eliminarTipoSoporte, setEliminarTipoSoporte] = useState<ReglaTipoSoporteDTO | null>(null);
  // FIX-DIS3/CORTE-1: el orden local solo guarda los ids; la lista se deriva
  // de los datos del servidor para no actualizar estado dentro de un efecto.
  const [ordenTiposLocal, setOrdenTiposLocal] = useState<number[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data, isLoading, mutate } = useSWR(
    puedeVer ? "configuracion-reglas-catalogos" : null,
    async () => {
      const res = await obtenerReglasCatalogosAction();
      if (esError(res)) throw new Error(res.error);
      return res as ReglasCatalogosCompletoDTO;
    },
  );

  // FIX-DIS3/CORTE-1: el orden local solo guarda los ids; la lista se deriva
  // de los datos del servidor para no actualizar estado dentro de un efecto.
  const tiposSoporteOrdenados = useMemo(() => {
    const base = data?.tipos_soporte ?? [];
    if (!ordenTiposLocal) return base;
    const porId = new Map(base.map((tipo) => [tipo.id, tipo]));
    const vistos = new Set<number>();
    const ordenados: ReglaTipoSoporteDTO[] = [];
    for (const id of ordenTiposLocal) {
      const tipo = porId.get(id);
      if (!tipo) continue;
      ordenados.push(tipo);
      vistos.add(id);
    }
    for (const tipo of base) {
      if (!vistos.has(tipo.id)) ordenados.push(tipo);
    }
    return ordenados;
  }, [data?.tipos_soporte, ordenTiposLocal]);

  // Agrupar motivos por categoría
  const motivosPorCategoria = useMemo(() => {
    if (!data?.motivos || !data?.categorias_motivo) return [];
    return data.categorias_motivo.map((cat) => ({
      categoria: cat,
      motivos: data.motivos.filter((m) => m.categoria_id === cat.id),
    }));
  }, [data]);

  // Filtrado y paginación para Países
  const paisesFiltrados = useMemo(() => {
    const todos = data?.paises ?? [];
    const q = busquedaPais.trim().toLowerCase();
    const filtrados = q
      ? todos.filter(
          (p) =>
            p.nombre.toLowerCase().includes(q) ||
            p.codigo.toLowerCase().includes(q),
        )
      : todos;
    return [...filtrados].sort((a, b) => {
      if (a.es_venezuela && !b.es_venezuela) return -1;
      if (!a.es_venezuela && b.es_venezuela) return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }, [data?.paises, busquedaPais]);

  const totalPaginasPais = Math.max(1, Math.ceil(paisesFiltrados.length / tamanoPaginaPais));
  const paisesPaginados = useMemo(() => {
    const inicio = (paginaPais - 1) * tamanoPaginaPais;
    return paisesFiltrados.slice(inicio, inicio + tamanoPaginaPais);
  }, [paisesFiltrados, paginaPais, tamanoPaginaPais]);

  // Manejadores de acciones
  const handleGuardarParentesco = () => {
    if (!confirmParentesco) return;
    const { parentesco, nuevoValor } = confirmParentesco;
    setConfirmParentesco(null);

    startTransition(async () => {
      const res = await actualizarParentescoAction(parentesco.id, nuevoValor);
      if (esError(res)) {
        toast.error(res.error);
      } else {
        toast.success(`Parentesco «${parentesco.descripcion}» actualizado correctamente.`);
        mutate();
      }
    });
  };

  const handleGuardarCategoriaMotivo = () => {
    if (!confirmMotivo) return;
    const { motivo, nuevaCategoriaId, nuevaCategoriaNombre } = confirmMotivo;
    setConfirmMotivo(null);

    startTransition(async () => {
      const res = await cambiarCategoriaMotivoAction(motivo.id, nuevaCategoriaId);
      if (esError(res)) {
        toast.error(res.error);
      } else {
        toast.success(
          `Motivo «${motivo.movimiento}» transferido a la categoría «${nuevaCategoriaNombre}».`,
        );
        mutate();
      }
    });
  };

  const handleGuardarNuevoMotivo = () => {
    if (!categoriaNuevoMotivo || !nuevoMovimiento.trim()) {
      setErrorNuevoMotivo("Debe ingresar el nombre del motivo y seleccionar una categoría.");
      return;
    }
    setErrorNuevoMotivo(null);

    startTransition(async () => {
      const res = await crearMotivoAction(nuevoMovimiento, categoriaNuevoMotivo);
      if (esError(res)) {
        setErrorNuevoMotivo(res.error);
        toast.error(res.error);
      } else {
        toast.success("Motivo creado con éxito.");
        setModalNuevoMotivo(false);
        setNuevoMovimiento("");
        setCategoriaNuevoMotivo(null);
        mutate();
      }
    });
  };

  const handleGuardarEdicionMotivo = () => {
    if (!editarMotivo) return;
    if (!editarMotivo.nombre.trim()) {
      setErrorEditarMotivo("El nombre del motivo no puede estar vacío.");
      return;
    }
    setErrorEditarMotivo(null);

    startTransition(async () => {
      const res = await actualizarMotivoAction(editarMotivo.motivo.id, {
        movimiento: editarMotivo.nombre,
        categoria_id: editarMotivo.categoriaId,
        activo: editarMotivo.activo,
      });
      if (esError(res)) {
        setErrorEditarMotivo(res.error);
        toast.error(res.error);
      } else {
        toast.success(`Motivo «${editarMotivo.nombre}» actualizado correctamente.`);
        setEditarMotivo(null);
        mutate();
      }
    });
  };

  const handleConfirmarEliminarMotivo = () => {
    if (!eliminarMotivo) return;
    const motivo = eliminarMotivo;
    setEliminarMotivo(null);

    startTransition(async () => {
      const res = await eliminarMotivoAction(motivo.id);
      if (esError(res)) {
        toast.error(res.error);
      } else {
        toast.success(`Motivo «${motivo.movimiento}» eliminado correctamente.`);
        mutate();
      }
    });
  };

  const handleToggleActivoMotivo = (motivo: ReglaMotivoDTO, nuevoActivo: boolean) => {
    startTransition(async () => {
      const res = await actualizarMotivoAction(motivo.id, { activo: nuevoActivo });
      if (esError(res)) {
        toast.error(res.error);
      } else {
        toast.success(`Motivo «${motivo.movimiento}» ${nuevoActivo ? "activado" : "desactivado"}.`);
        mutate();
      }
    });
  };

  const handleGuardarNomina = () => {
    if (!confirmNomina) return;
    const { nomina, campo, nuevoValor } = confirmNomina;
    setConfirmNomina(null);

    startTransition(async () => {
      const payload = campo === "es_activo" ? { es_activo: nuevoValor } : { requiere_codig: nuevoValor };
      const res = await actualizarNominaAction(nomina.id, payload);
      if (esError(res)) {
        toast.error(res.error);
      } else {
        toast.success(`Nómina «${nomina.nomina}» actualizada correctamente.`);
        mutate();
      }
    });
  };

  const handleGuardarDialogoParentesco = () => {
    if (!dialogoParentesco) return;
    const nombre = dialogoParentesco.descripcion.trim();
    if (nombre.length < 2) {
      setErrorDialogoParentesco("El nombre del parentesco debe tener al menos 2 caracteres.");
      return;
    }
    setErrorDialogoParentesco(null);
    const { modo, parentesco, aplicaFamiliar, regla } = dialogoParentesco;
    const reglaDatos = reglaPayload(regla);
    startTransition(async () => {
      const res =
        modo === "crear"
          ? await crearParentescoAction(nombre, aplicaFamiliar, reglaDatos)
          : await editarParentescoAction(parentesco?.id ?? 0, {
              ...(parentesco?.descripcion.trim().toUpperCase() === "HIJO (A)"
                ? {}
                : { descripcion: nombre }),
              aplica_familiar: aplicaFamiliar,
              ...reglaDatos,
            });
      if (esError(res)) {
        setErrorDialogoParentesco(res.error);
        return;
      }
      toast.success(modo === "crear" ? "Parentesco creado." : "Parentesco actualizado.");
      setDialogoParentesco(null);
      mutate();
    });
  };

  const actualizarReglaParentesco = (cambios: Partial<ReglaParentescoForm>) => {
    setDialogoParentesco((previo) =>
      previo ? { ...previo, regla: { ...previo.regla, ...cambios } } : previo,
    );
  };

  const handleEliminarParentesco = () => {
    if (!eliminarParentesco) return;
    const parentesco = eliminarParentesco;
    setEliminarParentesco(null);
    startTransition(async () => {
      const res = await eliminarParentescoAction(parentesco.id);
      if (esError(res)) {
        toast.error(res.error);
        return;
      }
      toast.success(`Parentesco «${parentesco.descripcion}» eliminado.`);
      mutate();
    });
  };

  const handleGuardarDialogoNomina = () => {
    if (!dialogoNomina) return;
    const nombre = dialogoNomina.nombre.trim();
    if (nombre.length < 2) {
      setErrorDialogoNomina("El nombre de la nómina debe tener al menos 2 caracteres.");
      return;
    }
    setErrorDialogoNomina(null);
    const { modo, nomina, esActivo, requiereCodig } = dialogoNomina;
    startTransition(async () => {
      const res =
        modo === "crear"
          ? await crearNominaAction(nombre, esActivo, requiereCodig)
          : await actualizarNominaAction(nomina?.id ?? 0, {
              nomina: nombre,
              es_activo: esActivo,
              requiere_codig: requiereCodig,
            });
      if (esError(res)) {
        setErrorDialogoNomina(res.error);
        return;
      }
      toast.success(modo === "crear" ? "Tipo de nómina creado." : "Tipo de nómina actualizado.");
      setDialogoNomina(null);
      mutate();
    });
  };

  const handleGuardarDialogoPais = () => {
    if (!dialogoPais) return;
    const nombre = dialogoPais.nombre.trim();
    const codigo = dialogoPais.codigo.trim().toUpperCase();
    if (nombre.length < 2) {
      setErrorDialogoPais("El nombre del país debe tener al menos 2 caracteres.");
      return;
    }
    if (!/^[A-Za-z]{2,3}$/.test(codigo)) {
      setErrorDialogoPais("El código del país debe tener 2 o 3 letras.");
      return;
    }
    setErrorDialogoPais(null);
    const { modo, pais } = dialogoPais;
    startTransition(async () => {
      const res =
        modo === "crear"
          ? await crearPaisAction(nombre, codigo)
          : await actualizarPaisAction(pais?.id ?? 0, { nombre, codigo });
      if (esError(res)) {
        setErrorDialogoPais(res.error);
        return;
      }
      toast.success(modo === "crear" ? "País creado." : "País actualizado.");
      setDialogoPais(null);
      mutate();
    });
  };

  const handleEliminarPais = () => {
    if (!eliminarPais) return;
    const pais = eliminarPais;
    setEliminarPais(null);
    startTransition(async () => {
      const res = await eliminarPaisAction(pais.id);
      if (esError(res)) {
        toast.error(res.error);
        return;
      }
      toast.success(`País «${pais.nombre}» eliminado.`);
      mutate();
    });
  };

  const handleEliminarNomina = () => {
    if (!eliminarNomina) return;
    const nomina = eliminarNomina;
    setEliminarNomina(null);
    startTransition(async () => {
      const res = await eliminarNominaAction(nomina.id);
      if (esError(res)) {
        toast.error(res.error);
        return;
      }
      toast.success(`Nómina «${nomina.nomina}» eliminada.`);
      mutate();
    });
  };

  const handleDragEndTiposSoporte = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tiposSoporteOrdenados.findIndex((t) => t.id === active.id);
    const newIndex = tiposSoporteOrdenados.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nuevaLista = arrayMove(tiposSoporteOrdenados, oldIndex, newIndex);
    setOrdenTiposLocal(nuevaLista.map((item) => item.id));

    startTransition(async () => {
      const ordenes = nuevaLista.map((item, idx) => ({ id: item.id, orden: idx + 1 }));
      const res = await reordenarTiposSoporteAction(ordenes);
      if (esError(res)) {
        setOrdenTiposLocal(null);
        toast.error(res.error);
        mutate();
      } else {
        toast.success("Posición en la lista actualizada.");
        mutate();
      }
    });
  };

  const handleGuardarDialogoTipoSoporte = () => {
    if (!dialogoTipoSoporte) return;
    const codigo = dialogoTipoSoporte.codigo.trim().toUpperCase();
    const nombre = dialogoTipoSoporte.nombre.trim();
    const { modo, tipo } = dialogoTipoSoporte;
    const orden = modo === "crear"
      ? (data?.tipos_soporte.length ?? 0) + 1
      : (tipo?.orden ?? 0);
    if (!/^[A-Z0-9_]{2,40}$/.test(codigo)) {
      setErrorDialogoTipoSoporte(
        "El código debe tener entre 2 y 40 letras, números o guion bajo.",
      );
      return;
    }
    if (nombre.length < 2) {
      setErrorDialogoTipoSoporte("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    setErrorDialogoTipoSoporte(null);
    startTransition(async () => {
      const res =
        modo === "crear"
          ? await crearTipoSoporteAction(codigo, nombre, orden)
          : await actualizarTipoSoporteAction(tipo?.id ?? 0, {
              ...(tipo && !tipo.es_reservado && !tipo.es_protegido ? { codigo } : {}),
              nombre,
              orden,
            });
      if (esError(res)) {
        setErrorDialogoTipoSoporte(res.error);
        return;
      }
      toast.success(
        modo === "crear" ? "Tipo de soporte creado." : "Tipo de soporte actualizado.",
      );
      setDialogoTipoSoporte(null);
      mutate();
    });
  };

  const handleEliminarTipoSoporte = () => {
    if (!eliminarTipoSoporte) return;
    const tipo = eliminarTipoSoporte;
    setEliminarTipoSoporte(null);
    startTransition(async () => {
      const res = await eliminarTipoSoporteAction(tipo.id);
      if (esError(res)) {
        toast.error(res.error);
        return;
      }
      toast.success(`Tipo de soporte «${tipo.nombre}» eliminado.`);
      mutate();
    });
  };

  const handleGuardarChecklistSoporte = (
    seccion: string,
    entradas: { tipo_soporte_id: number; permitido: boolean; requerido: boolean }[],
  ) => {
    startTransition(async () => {
      const res = await actualizarChecklistSoporteAction(seccion, entradas);
      if (esError(res)) {
        toast.error(res.error);
        return;
      }
      toast.success("Checklist de la sección actualizado.");
      mutate();
    });
  };

  if (!puedeVer) {
    return (
      <PageLayout title="Reglas de catálogos">
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          No tiene los permisos requeridos para consultar la configuración de reglas de catálogos.
        </p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Reglas de Catálogos"
      description="Control y configuración de marcas de tablas maestras que gobiernan reglas operativas del sistema."
    >
      <Tabs defaultValue="parentescos" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-5 max-w-3xl !h-auto sm:!h-9 group-data-[orientation=horizontal]/tabs:!h-auto sm:group-data-[orientation=horizontal]/tabs:!h-9 p-1 gap-1 sm:gap-0">
          <TabsTrigger
            value="parentescos"
            className="!h-auto sm:!h-full py-2 sm:py-0 px-3 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-center min-h-[40px] sm:min-h-0"
          >
            Parentescos
          </TabsTrigger>
          <TabsTrigger
            value="motivos"
            className="!h-auto sm:!h-full py-2 sm:py-0 px-3 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-center min-h-[40px] sm:min-h-0"
          >
            Motivos de Movimiento
          </TabsTrigger>
          <TabsTrigger
            value="nominas"
            className="!h-auto sm:!h-full py-2 sm:py-0 px-3 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-center min-h-[40px] sm:min-h-0"
          >
            Tipos de Nómina
          </TabsTrigger>
          <TabsTrigger
            value="paises"
            className="!h-auto sm:!h-full py-2 sm:py-0 px-3 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-center min-h-[40px] sm:min-h-0"
          >
            Países
          </TabsTrigger>
          <TabsTrigger
            value="soportes"
            className="!h-auto sm:!h-full py-2 sm:py-0 px-3 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-center min-h-[40px] sm:min-h-0"
          >
            Tipos de soporte
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 1: PARENTESCOS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="parentescos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Parentescos y Reglas de Vinculación</CardTitle>
                <CardDescription>
                  Habilite o deshabilite si un parentesco está permitido exclusivamente para
                  familiares en RRHH o si puede usarse en contactos de emergencia.
                </CardDescription>
              </div>
              {puedeEditar && (
                <Button
                  className="shrink-0"
                  onClick={() => {
                    setErrorDialogoParentesco(null);
                    setDialogoParentesco({
                      modo: "crear",
                      parentesco: null,
                      descripcion: "",
                      aplicaFamiliar: true,
                      regla: reglaFormDe(null),
                    });
                  }}
                >
                  <Plus className="mr-2 size-4" /> Nuevo parentesco
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción del Parentesco</TableHead>
                        <TableHead className="text-center w-[180px]">
                          Permitido para Familiares
                        </TableHead>
                        <TableHead className="w-[320px]">Reglas configuradas</TableHead>
                        <TableHead className="text-right w-[120px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.parentescos.map((p) => {
                        const reservado = p.descripcion.trim().toUpperCase() === "HIJO (A)";
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-2">
                                {p.descripcion}
                                {reservado && (
                                  <span title="Parentesco reservado del sistema">
                                    <Lock className="size-3.5 text-amber-500" aria-hidden="true" />
                                  </span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={p.aplica_familiar}
                                  disabled={!puedeEditar || isPending}
                                  onCheckedChange={(val) => {
                                    setConfirmParentesco({
                                      parentesco: p,
                                      nuevoValor: val,
                                    });
                                  }}
                                />
                                <span className="text-xs text-muted-foreground w-12 text-left">
                                  {p.aplica_familiar ? "Sí" : "No"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                {p.activo ? null : (
                                  <Badge variant="outline" className="border-rose-400 text-rose-700 dark:text-rose-300 text-[10px]">
                                    Inactivo
                                  </Badge>
                                )}
                                {resumenReglas(p).length === 0 ? (
                                  <span className="text-xs text-muted-foreground">Sin reglas</span>
                                ) : (
                                  resumenReglas(p).map((texto) => (
                                    <Badge key={texto} variant="secondary" className="text-[10px] font-normal">
                                      {texto}
                                    </Badge>
                                  ))
                                )}
                                {p.soporte_sugerido ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal"
                                    title={`Soporte sugerido: ${p.soporte_sugerido}`}
                                  >
                                    Soporte: {p.soporte_sugerido}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Editar ${p.descripcion}`}
                                  disabled={!puedeEditar || isPending}
                                  onClick={() => {
                                    setErrorDialogoParentesco(null);
                                    setDialogoParentesco({
                                      modo: "editar",
                                      parentesco: p,
                                      descripcion: p.descripcion,
                                      aplicaFamiliar: p.aplica_familiar,
                                      regla: reglaFormDe(p),
                                    });
                                  }}
                                >
                                  <Pencil className="size-4" aria-hidden="true" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Eliminar ${p.descripcion}`}
                                  disabled={!puedeEditar || isPending || reservado}
                                  onClick={() => setEliminarParentesco(p)}
                                >
                                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 2: MOTIVOS DE MOVIMIENTO */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="motivos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Motivos de Movimiento por Categoría</CardTitle>
                <CardDescription>
                  Cada operación del sistema consume los motivos de su categoría correspondiente.
                  Los motivos reservados del sistema están protegidos contra reasignación.
                </CardDescription>
              </div>
              {puedeEditar && (
                <Button
                  onClick={() => {
                    setErrorNuevoMotivo(null);
                    setNuevoMovimiento("");
                    setCategoriaNuevoMotivo(data?.categorias_motivo[0]?.id ?? null);
                    setModalNuevoMotivo(true);
                  }}
                  className="shrink-0"
                >
                  <Plus className="mr-2 size-4" /> Nuevo Motivo
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                motivosPorCategoria.map((grupo) => (
                  <div key={grupo.categoria.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-bold text-sm bg-background">
                          {grupo.categoria.categoria}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({grupo.motivos.length} motivo{grupo.motivos.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                    </div>

                    <div className="rounded-md border bg-background overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre del Motivo</TableHead>
                            <TableHead className="w-[180px]">Tipo / Restricción</TableHead>
                            <TableHead className="w-[200px]">Categoría Asignada</TableHead>
                            <TableHead className="text-center w-[120px]">Estado</TableHead>
                            <TableHead className="text-right w-[140px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grupo.motivos.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                                Sin motivos asignados a esta categoría.
                              </TableCell>
                            </TableRow>
                          ) : (
                            grupo.motivos.map((m) => (
                              <TableRow key={m.id} className={m.activo === false ? "opacity-60 bg-muted/10" : undefined}>
                                <TableCell className="font-medium flex items-center gap-2">
                                  <span>{m.movimiento}</span>
                                  {m.es_reservado && (
                                    <span title="Motivo reservado del sistema" className="inline-flex items-center">
                                      <Lock className="size-3.5 text-amber-500" aria-hidden="true" />
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {m.es_reservado ? (
                                    <Badge variant="secondary" className="text-amber-700 bg-amber-50 border-amber-200 text-xs">
                                      Reservado (Pase a Pasivo)
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      Estándar
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {m.es_reservado ? (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {m.categoria_nombre}
                                    </span>
                                  ) : (
                                    <Select
                                      disabled={!puedeEditar || isPending}
                                      value={String(m.categoria_id)}
                                      onValueChange={(val) => {
                                        const catId = Number.parseInt(val);
                                        const catObj = data?.categorias_motivo.find((c) => c.id === catId);
                                        if (catObj && catId !== m.categoria_id) {
                                          setConfirmMotivo({
                                            motivo: m,
                                            nuevaCategoriaId: catId,
                                            nuevaCategoriaNombre: catObj.categoria,
                                          });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="w-[180px] h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {data?.categorias_motivo.map((cat) => (
                                          <SelectItem key={cat.id} value={String(cat.id)}>
                                            {cat.categoria}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Switch
                                      checked={m.activo !== false}
                                      disabled={!puedeEditar || isPending || m.es_reservado}
                                      onCheckedChange={(val) => handleToggleActivoMotivo(m, val)}
                                      aria-label={`Estado de motivo ${m.movimiento}`}
                                    />
                                    <span className="text-xs text-muted-foreground w-12 text-left">
                                      {m.activo !== false ? "Activo" : "Inactivo"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  {m.es_reservado ? (
                                    <span className="text-xs text-muted-foreground italic">
                                      Protegido
                                    </span>
                                  ) : (
                                    <div className="flex justify-end items-center gap-1">
                                      {puedeEditar && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-xs"
                                            onClick={() => {
                                              setErrorEditarMotivo(null);
                                              setEditarMotivo({
                                                motivo: m,
                                                nombre: m.movimiento,
                                                categoriaId: m.categoria_id,
                                                activo: m.activo !== false,
                                              });
                                            }}
                                            title="Editar motivo"
                                          >
                                            <Pencil className="size-3.5 mr-1" /> Editar
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                            onClick={() => setEliminarMotivo(m)}
                                            title="Eliminar motivo"
                                          >
                                            <Trash2 className="size-3.5 mr-1" /> Eliminar
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 3: TIPOS DE NÓMINA */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="nominas" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Reglas y Marcas de Tipos de Nómina</CardTitle>
                <CardDescription>
                  Gobernanza sobre qué nóminas se consideran personal activo y cuáles exigen
                  código de cargo asignado para sus trabajadores.
                </CardDescription>
              </div>
              {puedeEditar && (
                <Button
                  className="shrink-0"
                  onClick={() => {
                    setErrorDialogoNomina(null);
                    setDialogoNomina({
                      modo: "crear",
                      nomina: null,
                      nombre: "",
                      esActivo: true,
                      requiereCodig: false,
                    });
                  }}
                >
                  <Plus className="mr-2 size-4" /> Nueva nómina
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre de Nómina</TableHead>
                        <TableHead className="text-center w-[180px]">Nómina Activa</TableHead>
                        <TableHead className="text-center w-[180px]">Requiere Código</TableHead>
                        <TableHead className="text-right w-[120px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.nominas.map((n) => {
                        const reservada = n.es_reservada;
                        return (
                          <TableRow key={n.id}>
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-2">
                                {n.nomina}
                                {reservada && (
                                  <span title="Nómina reservada del sistema">
                                    <Lock className="size-3.5 text-amber-500" aria-hidden="true" />
                                  </span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={n.es_activo}
                                  disabled={!puedeEditar || isPending || (reservada && !n.es_activo)}
                                  onCheckedChange={(val) => {
                                    setConfirmNomina({
                                      nomina: n,
                                      campo: "es_activo",
                                      nuevoValor: val,
                                    });
                                  }}
                                />
                                <span className="text-xs text-muted-foreground w-8 text-left">
                                  {n.es_activo ? "Sí" : "No"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={n.requiere_codig}
                                  disabled={!puedeEditar || isPending}
                                  onCheckedChange={(val) => {
                                    setConfirmNomina({
                                      nomina: n,
                                      campo: "requiere_codig",
                                      nuevoValor: val,
                                    });
                                  }}
                                />
                                <span className="text-xs text-muted-foreground w-8 text-left">
                                  {n.requiere_codig ? "Sí" : "No"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Editar ${n.nomina}`}
                                  disabled={!puedeEditar || isPending}
                                  onClick={() => {
                                    setErrorDialogoNomina(null);
                                    setDialogoNomina({
                                      modo: "editar",
                                      nomina: n,
                                      nombre: n.nomina,
                                      esActivo: n.es_activo,
                                      requiereCodig: n.requiere_codig,
                                    });
                                  }}
                                >
                                  <Pencil className="size-4" aria-hidden="true" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Eliminar ${n.nomina}`}
                                  disabled={!puedeEditar || isPending || reservada}
                                  onClick={() => setEliminarNomina(n)}
                                >
                                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 4: PAÍSES (O40) */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="paises" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Países de residencia</CardTitle>
                <CardDescription>
                  Catálogo de países para la vivienda de los pasivos. Venezuela es el país por
                  defecto y no puede eliminarse; un país con viviendas registradas tampoco.
                </CardDescription>
              </div>
              {puedeEditar && (
                <Button
                  className="shrink-0"
                  onClick={() => {
                    setErrorDialogoPais(null);
                    setDialogoPais({
                      modo: "crear",
                      pais: null,
                      nombre: "",
                      codigo: "",
                    });
                  }}
                >
                  <Plus className="mr-2 size-4" /> Nuevo país
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Barra de búsqueda y controles de paginación */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    placeholder="Buscar país o código…"
                    value={busquedaPais}
                    onChange={(e) => {
                      setBusquedaPais(e.target.value);
                      setPaginaPais(1);
                    }}
                    className="pl-9 pr-8 h-9"
                    aria-label="Buscar país por nombre o código"
                  />
                  {busquedaPais ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBusquedaPais("");
                        setPaginaPais(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto text-sm">
                  <span className="text-muted-foreground whitespace-nowrap">Mostrar:</span>
                  <Select
                    value={String(tamanoPaginaPais)}
                    onValueChange={(val) => {
                      setTamanoPaginaPais(Number(val) as 10 | 25 | 50);
                      setPaginaPais(1);
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {paisesFiltrados.length === 0
                      ? "0 países"
                      : `${(paginaPais - 1) * tamanoPaginaPais + 1} - ${Math.min(
                          paginaPais * tamanoPaginaPais,
                          paisesFiltrados.length,
                        )} de ${paisesFiltrados.length}`}
                  </span>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>País</TableHead>
                          <TableHead className="w-[120px]">Código</TableHead>
                          <TableHead className="w-[160px]">Condición</TableHead>
                          <TableHead className="text-right w-[120px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paisesPaginados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                              {busquedaPais
                                ? `No se encontraron países que coincidan con «${busquedaPais}».`
                                : "No hay países registrados."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          paisesPaginados.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">
                                <span className="inline-flex items-center gap-2">
                                  {p.nombre}
                                  {p.es_venezuela && (
                                    <span title="País por defecto del sistema">
                                      <Lock className="size-3.5 text-amber-500" aria-hidden="true" />
                                    </span>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                              <TableCell>
                                {p.es_venezuela ? (
                                  <Badge variant="secondary" className="text-xs">
                                    Por defecto
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    Otro país
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Editar ${p.nombre}`}
                                    disabled={!puedeEditar || isPending}
                                    onClick={() => {
                                      setErrorDialogoPais(null);
                                      setDialogoPais({
                                        modo: "editar",
                                        pais: p,
                                        nombre: p.nombre,
                                        codigo: p.codigo,
                                      });
                                    }}
                                  >
                                    <Pencil className="size-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Eliminar ${p.nombre}`}
                                    disabled={!puedeEditar || isPending || p.es_venezuela}
                                    onClick={() => setEliminarPais(p)}
                                  >
                                    <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginación */}
                  {totalPaginasPais > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-muted-foreground">
                        Página {paginaPais} de {totalPaginasPais}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={paginaPais <= 1}
                          onClick={() => setPaginaPais((p) => Math.max(1, p - 1))}
                          className="h-8 px-2.5"
                        >
                          <ChevronLeft className="size-4 mr-1" /> Anterior
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={paginaPais >= totalPaginasPais}
                          onClick={() => setPaginaPais((p) => Math.min(totalPaginasPais, p + 1))}
                          className="h-8 px-2.5"
                        >
                          Siguiente <ChevronRight className="size-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 5: TIPOS DE SOPORTE (O41) */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="soportes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Tipos de documento y checklist por sección</CardTitle>
                <CardDescription>
                  Catálogo de documentos que el trabajador puede adjuntar. Los tipos reservados
                  los usan las reglas del sistema y no se eliminan; los exigidos por una regla
                  tampoco se quitan del checklist de su sección.
                </CardDescription>
              </div>
              {puedeEditar && (
                <Button
                  className="shrink-0"
                  onClick={() => {
                    setErrorDialogoTipoSoporte(null);
                    setDialogoTipoSoporte({
                      modo: "crear",
                      tipo: null,
                      codigo: "",
                      nombre: "",
                      orden: "0",
                    });
                  }}
                >
                  <Plus className="mr-2 size-4" /> Nuevo tipo
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEndTiposSoporte}
                  >
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">
                            <div className="flex items-center gap-1.5">
                              <span>Posición en la lista</span>
                              <span
                                className="inline-flex cursor-help text-muted-foreground hover:text-foreground"
                                title="Define en qué posición aparece en las listas; el número más bajo va primero."
                                aria-label="Ayuda: Define en qué posición aparece en las listas; el número más bajo va primero."
                              >
                                <Info className="size-3.5" aria-hidden="true" />
                              </span>
                            </div>
                          </TableHead>
                          <TableHead className="w-[190px]">Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead className="w-[170px]">Protección</TableHead>
                          <TableHead className="text-right w-[120px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <SortableContext
                        items={tiposSoporteOrdenados.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <TableBody>
                          {tiposSoporteOrdenados.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                                No hay tipos de documento configurados.
                              </TableCell>
                            </TableRow>
                          ) : (
                            tiposSoporteOrdenados.map((tipo, idx) => (
                              <FilaTipoSoporteSortable
                                key={tipo.id}
                                tipo={tipo}
                                posicion={idx + 1}
                                puedeEditar={puedeEditar}
                                isPending={isPending}
                                onEditar={() => {
                                  setErrorDialogoTipoSoporte(null);
                                  setDialogoTipoSoporte({
                                    modo: "editar",
                                    tipo,
                                    codigo: tipo.codigo,
                                    nombre: tipo.nombre,
                                    orden: String(tipo.orden),
                                  });
                                }}
                                onEliminar={() => setEliminarTipoSoporte(tipo)}
                              />
                            ))
                          )}
                        </TableBody>
                      </SortableContext>
                    </Table>
                  </DndContext>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Checklist por sección</CardTitle>
              <CardDescription>
                Qué documentos acepta cada sección de la solicitud y cuáles exige una regla.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                (data?.secciones_soporte ?? []).map((seccion) => (
                  <ChecklistSoporteSeccion
                    key={`${seccion.codigo}-${JSON.stringify(
                      (data?.checklist_soporte ?? []).filter((f) => f.seccion === seccion.codigo),
                    )}`}
                    seccion={seccion}
                    tipos={data?.tipos_soporte ?? []}
                    filas={(data?.checklist_soporte ?? []).filter(
                      (f) => f.seccion === seccion.codigo,
                    )}
                    puedeEditar={puedeEditar}
                    pendiente={isPending}
                    onGuardar={handleGuardarChecklistSoporte}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------- */}
      {/* DIÁLOGOS DE CONFIRMACIÓN */}
      {/* ------------------------------------------------------------- */}

      {/* O36: alta/edición de parentesco */}
      <Dialog
        open={dialogoParentesco !== null}
        onOpenChange={(open) => !open && setDialogoParentesco(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogoParentesco?.modo === "crear" ? "Nuevo parentesco" : "Editar parentesco"}
            </DialogTitle>
            <DialogDescription>
              El nombre no distingue mayúsculas al validar duplicados y admite hasta 100
              caracteres. El parentesco «HIJO (A)» está reservado por la regla de cédula.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="parentesco-nombre">Nombre del parentesco</Label>
              <Input
                id="parentesco-nombre"
                value={dialogoParentesco?.descripcion ?? ""}
                maxLength={100}
                disabled={
                  dialogoParentesco?.modo === "editar" &&
                  dialogoParentesco.parentesco?.descripcion.trim().toUpperCase() === "HIJO (A)"
                }
                onChange={(e) =>
                  setDialogoParentesco((previo) =>
                    previo ? { ...previo, descripcion: e.target.value } : previo,
                  )
                }
                aria-invalid={!!errorDialogoParentesco}
              />
              {errorDialogoParentesco && (
                <p role="alert" className="text-sm text-destructive">{errorDialogoParentesco}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="parentesco-aplica"
                checked={dialogoParentesco?.aplicaFamiliar ?? true}
                onCheckedChange={(valor) =>
                  setDialogoParentesco((previo) =>
                    previo ? { ...previo, aplicaFamiliar: valor } : previo,
                  )
                }
              />
              <Label htmlFor="parentesco-aplica">Permitido para familiares</Label>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold">Reglas del parentesco</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Se aplican al registrar o editar un familiar. El soporte sugerido solo
                orienta al trabajador; no bloquea el registro.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="parentesco-es-hijo"
                    checked={dialogoParentesco?.regla.esHijo ?? false}
                    onCheckedChange={(valor) => actualizarReglaParentesco({ esHijo: valor })}
                  />
                  <Label htmlFor="parentesco-es-hijo">Es hijo(a)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="parentesco-menor-cargo"
                    checked={dialogoParentesco?.regla.menorACargo ?? false}
                    onCheckedChange={(valor) => actualizarReglaParentesco({ menorACargo: valor })}
                  />
                  <Label htmlFor="parentesco-menor-cargo">Es menor a cargo</Label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parentesco-sin-cedula">Sin cédula hasta (años)</Label>
                  <Input
                    id="parentesco-sin-cedula"
                    type="number"
                    min={0}
                    max={120}
                    placeholder="9"
                    disabled={!(dialogoParentesco?.regla.esHijo || dialogoParentesco?.regla.menorACargo)}
                    value={dialogoParentesco?.regla.sinCedulaHastaEdad ?? ""}
                    onChange={(e) => actualizarReglaParentesco({ sinCedulaHastaEdad: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parentesco-edad-minima">Edad mínima (años)</Label>
                  <Input
                    id="parentesco-edad-minima"
                    type="number"
                    min={0}
                    max={120}
                    placeholder="Sin restricción"
                    value={dialogoParentesco?.regla.edadMinima ?? ""}
                    onChange={(e) => actualizarReglaParentesco({ edadMinima: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parentesco-diferencia-tipo">Diferencia con el titular</Label>
                  <Select
                    value={dialogoParentesco?.regla.diferenciaTipo ?? "NINGUNA"}
                    onValueChange={(valor: "NINGUNA" | "MENOR" | "MAYOR") =>
                      actualizarReglaParentesco({ diferenciaTipo: valor })
                    }
                  >
                    <SelectTrigger id="parentesco-diferencia-tipo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NINGUNA">Sin diferencia mínima</SelectItem>
                      <SelectItem value="MENOR">Debe ser menor que el titular</SelectItem>
                      <SelectItem value="MAYOR">Debe ser mayor que el titular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parentesco-diferencia-minima">Diferencia mínima (años)</Label>
                  <Input
                    id="parentesco-diferencia-minima"
                    type="number"
                    min={0}
                    max={120}
                    placeholder="12"
                    disabled={(dialogoParentesco?.regla.diferenciaTipo ?? "NINGUNA") === "NINGUNA"}
                    value={dialogoParentesco?.regla.diferenciaMinima ?? ""}
                    onChange={(e) => actualizarReglaParentesco({ diferenciaMinima: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parentesco-sexo">Sexo permitido</Label>
                  <Select
                    value={dialogoParentesco?.regla.sexoPermitido || "CUALQUIERA"}
                    onValueChange={(valor) =>
                      actualizarReglaParentesco({ sexoPermitido: valor === "CUALQUIERA" ? "" : valor as "M" | "F" })
                    }
                  >
                    <SelectTrigger id="parentesco-sexo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUALQUIERA">Cualquiera</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parentesco-soporte">Soporte sugerido</Label>
                  <Input
                    id="parentesco-soporte"
                    maxLength={120}
                    placeholder="PARTIDA DE NACIMIENTO"
                    value={dialogoParentesco?.regla.soporteSugerido ?? ""}
                    onChange={(e) => actualizarReglaParentesco({ soporteSugerido: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    id="parentesco-activo"
                    checked={dialogoParentesco?.regla.activo ?? true}
                    onCheckedChange={(valor) => actualizarReglaParentesco({ activo: valor })}
                  />
                  <Label htmlFor="parentesco-activo">Parentesco activo en el catálogo</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogoParentesco(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleGuardarDialogoParentesco} disabled={isPending}>
              {dialogoParentesco?.modo === "crear" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O36: alta/edición de tipo de nómina */}
      <Dialog
        open={dialogoNomina !== null}
        onOpenChange={(open) => !open && setDialogoNomina(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogoNomina?.modo === "crear" ? "Nuevo tipo de nómina" : "Editar tipo de nómina"}
            </DialogTitle>
            <DialogDescription>
              Hasta 50 caracteres. La clasificación activo/pasivo y «requiere código» se
              eligen aquí; JUBILADO, PENSIONADO y PENSIONADO SOBREVIVIENTE están reservadas.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nomina-nombre">Nombre de la nómina</Label>
              <Input
                id="nomina-nombre"
                value={dialogoNomina?.nombre ?? ""}
                maxLength={50}
                disabled={dialogoNomina?.nomina?.es_reservada === true}
                onChange={(e) =>
                  setDialogoNomina((previo) =>
                    previo ? { ...previo, nombre: e.target.value } : previo,
                  )
                }
                aria-invalid={!!errorDialogoNomina}
              />
              {errorDialogoNomina && (
                <p role="alert" className="text-sm text-destructive">{errorDialogoNomina}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="nomina-activa"
                checked={dialogoNomina?.esActivo ?? true}
                disabled={
                  dialogoNomina?.nomina?.es_reservada === true &&
                  !(dialogoNomina?.esActivo ?? false)
                }
                onCheckedChange={(valor) =>
                  setDialogoNomina((previo) =>
                    previo ? { ...previo, esActivo: valor } : previo,
                  )
                }
              />
              <Label htmlFor="nomina-activa">Nómina activa</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="nomina-codig"
                checked={dialogoNomina?.requiereCodig ?? false}
                onCheckedChange={(valor) =>
                  setDialogoNomina((previo) =>
                    previo ? { ...previo, requiereCodig: valor } : previo,
                  )
                }
              />
              <Label htmlFor="nomina-codig">Requiere código de cargo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogoNomina(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleGuardarDialogoNomina} disabled={isPending}>
              {dialogoNomina?.modo === "crear" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O40: alta/edición de país */}
      <Dialog
        open={dialogoPais !== null}
        onOpenChange={(open) => !open && setDialogoPais(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogoPais?.modo === "crear" ? "Nuevo país" : "Editar país"}
            </DialogTitle>
            <DialogDescription>
              El código ISO tiene 2 o 3 letras y no se repite. Venezuela es el país por defecto
              y no puede eliminarse.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pais-nombre">Nombre del país</Label>
              <Input
                id="pais-nombre"
                value={dialogoPais?.nombre ?? ""}
                maxLength={100}
                onChange={(e) =>
                  setDialogoPais((previo) =>
                    previo ? { ...previo, nombre: e.target.value } : previo,
                  )
                }
                aria-invalid={!!errorDialogoPais}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pais-codigo">Código ISO</Label>
              <Input
                id="pais-codigo"
                value={dialogoPais?.codigo ?? ""}
                maxLength={3}
                onChange={(e) =>
                  setDialogoPais((previo) =>
                    previo ? { ...previo, codigo: e.target.value.toUpperCase() } : previo,
                  )
                }
                aria-invalid={!!errorDialogoPais}
              />
            </div>
            {errorDialogoPais && (
              <p role="alert" className="text-sm text-destructive">{errorDialogoPais}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogoPais(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleGuardarDialogoPais} disabled={isPending}>
              {dialogoPais?.modo === "crear" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O40: baja de país */}
      <AlertDialog
        open={eliminarPais !== null}
        onOpenChange={(open) => !open && setEliminarPais(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar país</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar el país <strong>{eliminarPais?.nombre}</strong>? Solo se permite si
              ninguna vivienda lo usa; si tiene registros, el sistema lo bloqueará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarPais}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* O41: alta/edición de tipo de soporte */}
      <Dialog
        open={dialogoTipoSoporte !== null}
        onOpenChange={(open) => !open && setDialogoTipoSoporte(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogoTipoSoporte?.modo === "crear" ? "Nuevo tipo de soporte" : "Editar tipo de soporte"}
            </DialogTitle>
            <DialogDescription>
              El código es estable y único (letras, números o guion bajo). Los tipos reservados
              del sistema no cambian de código ni se eliminan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo-soporte-codigo">Código</Label>
              <Input
                id="tipo-soporte-codigo"
                value={dialogoTipoSoporte?.codigo ?? ""}
                maxLength={40}
                disabled={
                  dialogoTipoSoporte?.modo === "editar" &&
                  (dialogoTipoSoporte?.tipo?.es_reservado === true ||
                    dialogoTipoSoporte?.tipo?.es_protegido === true)
                }
                onChange={(e) =>
                  setDialogoTipoSoporte((previo) =>
                    previo ? { ...previo, codigo: e.target.value.toUpperCase() } : previo,
                  )
                }
                aria-invalid={!!errorDialogoTipoSoporte}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo-soporte-nombre">Nombre visible</Label>
              <Input
                id="tipo-soporte-nombre"
                value={dialogoTipoSoporte?.nombre ?? ""}
                maxLength={100}
                onChange={(e) =>
                  setDialogoTipoSoporte((previo) =>
                    previo ? { ...previo, nombre: e.target.value } : previo,
                  )
                }
                aria-invalid={!!errorDialogoTipoSoporte}
              />
            </div>
            {errorDialogoTipoSoporte && (
              <p role="alert" className="text-sm text-destructive">{errorDialogoTipoSoporte}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogoTipoSoporte(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleGuardarDialogoTipoSoporte} disabled={isPending}>
              {dialogoTipoSoporte?.modo === "crear" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O41: baja de tipo de soporte */}
      <AlertDialog
        open={eliminarTipoSoporte !== null}
        onOpenChange={(open) => !open && setEliminarTipoSoporte(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipo de soporte</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar el tipo <strong>{eliminarTipoSoporte?.nombre}</strong>? Solo se permite
              si no está en el checklist de ninguna sección; si lo está, el sistema lo bloqueará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarTipoSoporte}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* O36: baja de parentesco */}
      <AlertDialog
        open={eliminarParentesco !== null}
        onOpenChange={(open) => !open && setEliminarParentesco(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar parentesco</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar el parentesco <strong>{eliminarParentesco?.descripcion}</strong>? Solo
              se permite si ningún familiar lo usa; si tiene registros, el sistema lo bloqueará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarParentesco}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* O36: baja de tipo de nómina */}
      <AlertDialog
        open={eliminarNomina !== null}
        onOpenChange={(open) => !open && setEliminarNomina(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipo de nómina</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar la nómina <strong>{eliminarNomina?.nomina}</strong>? Solo se permite si
              no está asignada a cargos ni a procesos; si está en uso, el sistema lo bloqueará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarNomina}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación Parentesco */}
      <AlertDialog
        open={confirmParentesco !== null}
        onOpenChange={(open) => !open && setConfirmParentesco(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio en parentesco</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea cambiar el estado de «Permitido para familiares» del
              parentesco <strong>{confirmParentesco?.parentesco.descripcion}</strong> a{" "}
              <strong>{confirmParentesco?.nuevoValor ? "SÍ" : "NO"}</strong>?
              <br />
              Este cambio surtirá efecto inmediato en los registros y validaciones de expedientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGuardarParentesco}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación Motivo de Movimiento */}
      <AlertDialog
        open={confirmMotivo !== null}
        onOpenChange={(open) => !open && setConfirmMotivo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de categoría de motivo</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                ¿Desea reasignar el motivo <strong>{confirmMotivo?.motivo.movimiento}</strong> a la
                categoría <strong>{confirmMotivo?.nuevaCategoriaNombre}</strong>?
              </p>
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Al transferir el motivo, sólo estará disponible para los procesos y pantallas
                  asociadas a la nueva categoría.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGuardarCategoriaMotivo}>
              Confirmar Traslado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación Nómina */}
      <AlertDialog
        open={confirmNomina !== null}
        onOpenChange={(open) => !open && setConfirmNomina(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Confirmar cambio de regla de nómina
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                ¿Confirma el cambio de la regla{" "}
                <strong>
                  {confirmNomina?.campo === "es_activo" ? "«Nómina activa»" : "«Requiere código»"}
                </strong>{" "}
                para la nómina <strong>{confirmNomina?.nomina.nomina}</strong> a{" "}
                <strong>{confirmNomina?.nuevoValor ? "Activado (SÍ)" : "Desactivado (NO)"}</strong>?
              </p>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
                <strong>Advertencia de impacto:</strong> Este parámetro altera de inmediato qué
                trabajadores aparecen en los listados y reportes de personal activo vs pasivo, y qué
                nóminas se ofrecen al asignar códigos especiales de cargo.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGuardarNomina}>Confirmar Cambio</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Crear Nuevo Motivo */}
      <Dialog open={modalNuevoMotivo} onOpenChange={setModalNuevoMotivo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Motivo de Movimiento</DialogTitle>
            <DialogDescription>
              Agregue un nuevo motivo asignado directamente a una categoría de operación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nuevo-movimiento">Nombre del Motivo</Label>
              <Input
                id="nuevo-movimiento"
                placeholder="P. ej. INGRESO POR CONCURSO PÚBLICO"
                maxLength={100}
                value={nuevoMovimiento}
                onChange={(e) => setNuevoMovimiento(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-nuevo-motivo">Categoría</Label>
              <Select
                value={categoriaNuevoMotivo ? String(categoriaNuevoMotivo) : ""}
                onValueChange={(val) => setCategoriaNuevoMotivo(Number.parseInt(val))}
              >
                <SelectTrigger id="cat-nuevo-motivo">
                  <SelectValue placeholder="Seleccione una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {data?.categorias_motivo.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {errorNuevoMotivo && (
              <p role="alert" className="text-xs text-destructive">
                {errorNuevoMotivo}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNuevoMotivo(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarNuevoMotivo} disabled={isPending}>
              Guardar Motivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Motivo */}
      <Dialog open={editarMotivo !== null} onOpenChange={(open) => !open && setEditarMotivo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Motivo de Movimiento</DialogTitle>
            <DialogDescription>
              Modifique el nombre, categoría o estado de activación del motivo.
            </DialogDescription>
          </DialogHeader>

          {editarMotivo && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="editar-movimiento">Nombre del Motivo</Label>
                <Input
                  id="editar-movimiento"
                  maxLength={100}
                  value={editarMotivo.nombre}
                  onChange={(e) =>
                    setEditarMotivo({
                      ...editarMotivo,
                      nombre: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-editar-motivo">Categoría</Label>
                <Select
                  value={String(editarMotivo.categoriaId)}
                  onValueChange={(val) =>
                    setEditarMotivo({
                      ...editarMotivo,
                      categoriaId: Number.parseInt(val),
                    })
                  }
                >
                  <SelectTrigger id="cat-editar-motivo">
                    <SelectValue placeholder="Seleccione una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.categorias_motivo.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.categoria}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="activo-editar-motivo">Estado Activo</Label>
                  <p className="text-xs text-muted-foreground">
                    Los motivos inactivos no se muestran en los formularios de movimiento.
                  </p>
                </div>
                <Switch
                  id="activo-editar-motivo"
                  checked={editarMotivo.activo}
                  onCheckedChange={(checked) =>
                    setEditarMotivo({
                      ...editarMotivo,
                      activo: checked,
                    })
                  }
                />
              </div>

              {errorEditarMotivo && (
                <p role="alert" className="text-xs text-destructive">
                  {errorEditarMotivo}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditarMotivo(null)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarEdicionMotivo} disabled={isPending}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación Eliminar Motivo */}
      <AlertDialog
        open={eliminarMotivo !== null}
        onOpenChange={(open) => !open && setEliminarMotivo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" /> ¿Eliminar motivo de movimiento?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                ¿Está seguro de que desea eliminar el motivo{" "}
                <strong>«{eliminarMotivo?.movimiento}»</strong>?
              </p>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
                <strong>Aviso:</strong> Solo se puede eliminar un motivo si nunca ha sido utilizado
                en ningún movimiento del historial. Si ya tiene movimientos registrados, no se
                podrá eliminar; en ese caso se debe desactivar.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmarEliminarMotivo}
            >
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
