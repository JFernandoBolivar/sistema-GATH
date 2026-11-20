"use client";

import { useState, useTransition } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import type {
  PaginaCarnet,
  PlantillaMotor,
  TipoCredencial,
} from "../../domain/entities/carnet";
import {
  activarPlantillaMotorAction,
  crearPlantillaBorradorAction,
  eliminarPlantillaMotorAction,
  getPlantillaMotorAction,
  getPlantillasMotorPaginaAction,
  getTiposCredencialAction,
  getVersionesPlantillaAction,
  publicarPlantillaMotorAction,
} from "../../infrastructure/actions/carnetizacion-actions";
import { useBusquedaDiferida } from "./use-busqueda-diferida";

const TAMANO_INICIAL = 12;

function paginaVacia<T>(): PaginaCarnet<T> {
  return { resultados: [], total: 0, pagina: 1, tamano: TAMANO_INICIAL, totalPaginas: 1 };
}

export function usePlantillasGestor() {
  const [tipoActivo, setTipoActivoCrudo] = useState<string>("trabajador");
  const [paginaMotor, setPaginaMotor] = useState(1);
  const [tamanoMotor, setTamanoMotor] = useState(TAMANO_INICIAL);
  const [busquedaMotor, setBusquedaMotorCruda] = useState("");
  const busquedaMotorAplicada = useBusquedaDiferida(busquedaMotor);
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [modalVersionesOpen, setModalVersionesOpen] = useState(false);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaMotor | null>(null);
  const [versionesPlantilla, setVersionesPlantilla] = useState<PlantillaMotor[]>([]);
  const [cargandoVersiones, setCargandoVersiones] = useState(false);

  // Formulario de nueva plantilla
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaOrientacion, setNuevaOrientacion] = useState<"vertical" | "horizontal">("vertical");
  const [nuevoAncho, setNuevoAncho] = useState(54.0);
  const [nuevoAlto, setNuevoAlto] = useState(85.6);
  const [nuevoCriterio, setNuevoCriterio] = useState("todos");

  const [isPending, startTransition] = useTransition();

  // Consultas SWR
  const { data: tiposCredencial = [] } = useSWR<TipoCredencial[]>(
    "tipos-credencial-carnet",
    getTiposCredencialAction
  );

  const {
    data: respuestaMotor,
    isLoading: cargandoMotor,
    mutate: mutateMotor,
  } = useSWR(
    ["plantillas-motor", tipoActivo, paginaMotor, tamanoMotor, busquedaMotorAplicada],
    () =>
      getPlantillasMotorPaginaAction(tipoActivo, {
        pagina: paginaMotor,
        tamano: tamanoMotor,
        busqueda: busquedaMotorAplicada,
      }),
    { keepPreviousData: true },
  );

  const paginaMotorDatos: PaginaCarnet<PlantillaMotor> =
    respuestaMotor && respuestaMotor.success ? respuestaMotor.data : paginaVacia();
  const listaMotor = paginaMotorDatos.resultados;

  const setTipoActivo = (tipo: string) => {
    setTipoActivoCrudo(tipo);
    setPaginaMotor(1);
  };
  const setBusquedaMotor = (valor: string) => {
    setBusquedaMotorCruda(valor);
    setPaginaMotor(1);
  };
  const cambiarTamanoMotor = (tamano: number) => {
    setTamanoMotor(tamano);
    setPaginaMotor(1);
  };

  const crearNuevoBorrador = () => {
    if (!nuevoNombre.trim()) {
      toast.error("Indique un nombre para la plantilla");
      return;
    }
    startTransition(async () => {
      const res = await crearPlantillaBorradorAction({
        nombre: nuevoNombre.trim(),
        codigo_tipo: tipoActivo,
        ancho_mm: nuevoAncho,
        alto_mm: nuevoAlto,
        orientacion: nuevaOrientacion,
        regla_criterio: nuevoCriterio,
        regla_valor: "*",
      });
      if (res.success) {
        toast.success("Borrador de plantilla creado correctamente");
        setNuevoNombre("");
        setModalNuevoOpen(false);
        mutateMotor();
      } else {
        toast.error(res.error || "No se pudo crear el borrador.");
      }
    });
  };

  const duplicarMotor = (plantilla: PlantillaMotor) => {
    startTransition(async () => {
      // El listado omite las imágenes incrustadas (K-12): se copia la definición completa.
      const detalle = await getPlantillaMotorAction(plantilla.id);
      if (!detalle.success) {
        toast.error(detalle.error);
        return;
      }
      const res = await crearPlantillaBorradorAction({
        nombre: `${plantilla.nombre} (copia)`,
        codigo_tipo: plantilla.codigo_tipo,
        definicion: detalle.data.definicion,
        ancho_mm: plantilla.ancho_mm,
        alto_mm: plantilla.alto_mm,
        orientacion: plantilla.orientacion,
        regla_criterio: plantilla.regla_criterio,
        regla_valor: plantilla.regla_valor,
      });
      if (res.success) {
        toast.success("Plantilla duplicada como borrador");
        mutateMotor();
      } else {
        toast.error(res.error || "No se pudo duplicar la plantilla.");
      }
    });
  };

  const cargarVersiones = async (raizId: string) => {
    setCargandoVersiones(true);
    try {
      const items = await getVersionesPlantillaAction(raizId);
      setVersionesPlantilla(items);
    } catch {
      toast.error("Error al obtener versiones históricas");
    } finally {
      setCargandoVersiones(false);
    }
  };

  const activarMotor = (id: string) => {
    startTransition(async () => {
      const res = await activarPlantillaMotorAction(id);
      if (res.success) {
        toast.success("Plantilla activada como oficial para este tipo");
        mutateMotor();
        if (modalVersionesOpen && plantillaSeleccionada) {
          cargarVersiones(plantillaSeleccionada.plantilla_raiz_id || plantillaSeleccionada.id);
        }
      } else {
        toast.error(res.error || "No se pudo activar la plantilla");
      }
    });
  };

  const publicarMotor = (id: string, version: number) => {
    startTransition(async () => {
      const res = await publicarPlantillaMotorAction(id, true);
      if (res.success) {
        toast.success(`Versión v${version + 1} publicada y activada`);
        mutateMotor();
      } else {
        toast.error(res.error || "No se pudo publicar la versión");
      }
    });
  };

  const eliminarMotor = (plantilla: PlantillaMotor) => {
    startTransition(async () => {
      const res = await eliminarPlantillaMotorAction(plantilla.id);
      if (res.success) {
        toast.success(`Plantilla «${plantilla.nombre}» eliminada`);
        if (listaMotor.length === 1) setPaginaMotor((p) => Math.max(1, p - 1));
        mutateMotor();
      } else {
        toast.error(res.error || "No se pudo eliminar la plantilla");
      }
    });
  };

  const abrirHistorialVersiones = async (p: PlantillaMotor) => {
    setPlantillaSeleccionada(p);
    setModalVersionesOpen(true);
    await cargarVersiones(p.plantilla_raiz_id || p.id);
  };

  return {
    tipoActivo,
    setTipoActivo,
    tiposCredencial,
    modalNuevoOpen,
    setModalNuevoOpen,
    modalVersionesOpen,
    setModalVersionesOpen,
    plantillaSeleccionada,
    versionesPlantilla,
    cargandoVersiones,
    nuevoNombre,
    setNuevoNombre,
    nuevaOrientacion,
    setNuevaOrientacion,
    nuevoAncho,
    setNuevoAncho,
    nuevoAlto,
    setNuevoAlto,
    nuevoCriterio,
    setNuevoCriterio,
    isPending,
    crearNuevoBorrador,
    duplicarMotor,
    activarMotor,
    publicarMotor,
    eliminarMotor,
    abrirHistorialVersiones,
    listaMotor,
    cargandoMotor,
    // Paginación y búsqueda en el servidor
    paginaMotorDatos,
    setPaginaMotor,
    cambiarTamanoMotor,
    busquedaMotor,
    setBusquedaMotor,
  };
}
