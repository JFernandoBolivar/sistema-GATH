"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { toast } from "sonner";

import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import type { Plantilla, PlantillaMotor, TipoCredencial } from "../../domain/entities/carnet";
import {
  activarPlantillaCarnetAction,
  activarPlantillaMotorAction,
  crearPlantillaBorradorAction,
  getPlantillasCarnetAction,
  getPlantillasMotorAction,
  getTiposCredencialAction,
  getVersionesPlantillaAction,
  publicarPlantillaMotorAction,
  subirPlantillaCarnetAction,
} from "../../infrastructure/actions/carnetizacion-actions";
import { schemaPlantilla, type PlantillaFormType } from "../schema/schema-carnet";

export function usePlantillasGestor() {
  const [tipoActivo, setTipoActivo] = useState<string>("trabajador");
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

  // Estado subida clásica
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Consultas SWR
  const { data: tiposCredencial = [] } = useSWR<TipoCredencial[]>(
    "tipos-credencial-carnet",
    getTiposCredencialAction
  );

  const {
    data: plantillasMotor = [],
    isLoading: cargandoMotor,
    mutate: mutateMotor,
  } = useSWR<PlantillaMotor[]>(
    ["plantillas-motor", tipoActivo],
    () => getPlantillasMotorAction(tipoActivo)
  );

  const {
    data: plantillasClasicas = [],
    isLoading: cargandoClasicas,
    mutate: mutateClasicas,
  } = useSWR("plantillas-carnet", getPlantillasCarnetAction);

  const formClasico = useForm<PlantillaFormType>({
    resolver: zodResolver(schemaPlantilla),
    defaultValues: { nombre: "", imagen: undefined },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    formClasico.setValue("imagen", file);
    formClasico.clearErrors("imagen");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmitClasico = useCallback(
    (values: PlantillaFormType) => {
      startTransition(async () => {
        const result = await subirPlantillaCarnetAction(values.nombre, values.imagen);
        if (result && !("error" in result)) {
          toast.success("Plantilla institucional subida exitosamente");
          formClasico.reset({ nombre: "", imagen: undefined });
          setPreview(null);
          setFileName("");
          setFileInputKey((k) => k + 1);
          mutateClasicas();
        } else {
          const fallo = result as { error?: string; errores?: Record<string, string[]> };
          const sinUbicar = aplicarErroresServidor(formClasico, fallo.errores, {
            nombre: "nombre",
            imagen: "imagen",
          });
          toast.error(
            sinUbicar.length > 0 || !fallo.errores
              ? fallo.error || "Error al subir la plantilla"
              : "Revise los campos marcados en rojo."
          );
        }
      });
    },
    [mutateClasicas, formClasico]
  );

  const activarPlantillaClasica = (id: number) => {
    startTransition(async () => {
      const result = await activarPlantillaCarnetAction(id);
      if (result && !("error" in result)) {
        toast.success("Plantilla clásica activada");
        mutateClasicas();
      } else {
        toast.error((result as { error?: string })?.error || "Error al activar plantilla");
      }
    });
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
      const res = await crearPlantillaBorradorAction({
        nombre: `${plantilla.nombre} (copia)`,
        codigo_tipo: plantilla.codigo_tipo,
        definicion: plantilla.definicion,
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

  const abrirHistorialVersiones = async (p: PlantillaMotor) => {
    setPlantillaSeleccionada(p);
    setModalVersionesOpen(true);
    await cargarVersiones(p.plantilla_raiz_id || p.id);
  };

  const listaClasicas: Plantilla[] = Array.isArray(plantillasClasicas) ? plantillasClasicas : [];
  const listaMotor: PlantillaMotor[] = Array.isArray(plantillasMotor) ? plantillasMotor : [];

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
    preview,
    fileName,
    fileInputKey,
    fileInputRef,
    isPending,
    formClasico,
    handleFileChange,
    onSubmitClasico,
    activarPlantillaClasica,
    crearNuevoBorrador,
    duplicarMotor,
    activarMotor,
    publicarMotor,
    abrirHistorialVersiones,
    listaClasicas,
    listaMotor,
    cargandoMotor,
    cargandoClasicas,
  };
}
