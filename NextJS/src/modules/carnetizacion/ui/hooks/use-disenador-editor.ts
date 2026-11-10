"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { PlantillaMotor } from "../../domain/entities/carnet";
import type {
  ElementoKonva,
  PersonaMuestra,
  PosicionAlineacion,
  ReglasColorConfig,
} from "../../domain/entities/disenador";
import { adaptarDefinicionAEditor } from "../../application/use-cases/adaptar-definicion-plantilla";
import {
  alinearElementoKonva,
  duplicarElementoKonva,
  moverCapaKonva,
  PERSONA_FICTICIA_DEFECTO,
  REGLAS_COLOR_DEFECTO,
  resolverColorDeRegla,
} from "../../domain/entities/disenador";
import { crearElementosInicialesDefecto } from "../../domain/entities/disenador-plantilla-defecto";
import { buscarEmpleadoParaCarnetAction } from "../../infrastructure/actions/carnetizacion-actions";

interface UseDisenadorEditorParams {
  plantilla: PlantillaMotor | null;
  anchoMm: number;
  altoMm: number;
}

export function useDisenadorEditor({
  plantilla,
  anchoMm,
  altoMm,
}: UseDisenadorEditorParams) {
  // Estados del lienzo
  const [caraActual, setCaraActual] = useState<"anverso" | "reverso">("anverso");
  const [escala, setEscala] = useState<number>(4.2); // px por mm
  const [elementoSeleccionadoId, setElementoSeleccionadoId] = useState<string | null>(null);
  const [mostrarGuias, setMostrarGuias] = useState(true);

  // Estados de definición y capas
  const [elementos, setElementos] = useState<ElementoKonva[]>([]);
  const [historial, setHistorial] = useState<ElementoKonva[][]>([]);
  const [historialIndex, setHistorialIndex] = useState<number>(-1);

  // Reglas de color (O44 - E7)
  const [reglasColor, setReglasColor] = useState<ReglasColorConfig>(REGLAS_COLOR_DEFECTO);
  const [tabInspector, setTabInspector] = useState<"propiedades" | "colores">("propiedades");
  const [nuevoValorNombre, setNuevoValorNombre] = useState("");

  // Persona y vista previa
  const [datosPersona, setDatosPersona] = useState<PersonaMuestra>(PERSONA_FICTICIA_DEFECTO);
  const [modoPreviewReal, setModoPreviewReal] = useState(false);
  const [cedulaBusqueda, setCedulaBusqueda] = useState("");
  const [buscandoCedula, setBuscandoCedula] = useState(false);

  // Colores dinámicos calculados a partir de las reglas y la persona actual (O44 - E7)
  const coloresResueltos = useMemo(() => {
    return resolverColorDeRegla(reglasColor, datosPersona);
  }, [reglasColor, datosPersona]);

  // Inicializar elementos desde la definición guardada (anverso/reverso del motor)
  useEffect(() => {
    if (!plantilla) return;
    const adaptada = adaptarDefinicionAEditor(plantilla.definicion);
    if (adaptada.elementos.length > 0) {
      setElementos(adaptada.elementos);
      setHistorial([adaptada.elementos]);
      setHistorialIndex(0);
      if (adaptada.reglasColor) setReglasColor(adaptada.reglasColor);
    } else {
      const iniciales = crearElementosInicialesDefecto(anchoMm);
      setElementos(iniciales);
      setHistorial([iniciales]);
      setHistorialIndex(0);
    }
  }, [plantilla, anchoMm]);

  // Actualizar historial para Deshacer / Rehacer
  const registrarCambio = useCallback((nuevosElementos: ElementoKonva[]) => {
    setElementos(nuevosElementos);
    setHistorial((prev) => {
      const recortado = prev.slice(0, historialIndex + 1);
      return [...recortado, nuevosElementos];
    });
    setHistorialIndex((prev) => prev + 1);
  }, [historialIndex]);

  // Deshacer (Undo)
  const handleDeshacer = () => {
    if (historialIndex > 0) {
      const nuevoIdx = historialIndex - 1;
      setHistorialIndex(nuevoIdx);
      setElementos(historial[nuevoIdx]);
    }
  };

  // Rehacer (Redo)
  const handleRehacer = () => {
    if (historialIndex < historial.length - 1) {
      const nuevoIdx = historialIndex + 1;
      setHistorialIndex(nuevoIdx);
      setElementos(historial[nuevoIdx]);
    }
  };

  // Actualizar propiedades de un elemento
  const handleActualizarElemento = (id: string, cambios: Partial<ElementoKonva>) => {
    const nuevos = elementos.map((el) => (el.id === id ? { ...el, ...cambios } : el));
    registrarCambio(nuevos);
  };

  // Elemento actualmente seleccionado
  const elementoSeleccionado = elementos.find((e) => e.id === elementoSeleccionadoId) || null;

  // Añadir nuevo elemento
  const anadirElemento = (nuevo: Omit<ElementoKonva, "id">) => {
    const id = `el-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const elementoCompleto: ElementoKonva = { ...nuevo, id };
    registrarCambio([...elementos, elementoCompleto]);
    setElementoSeleccionadoId(id);
  };

  // Duplicar elemento
  const duplicarElemento = () => {
    if (!elementoSeleccionado) return;
    const id = `el-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const copia = duplicarElementoKonva(elementoSeleccionado, anchoMm, altoMm, id);
    registrarCambio([...elementos, copia]);
    setElementoSeleccionadoId(id);
    toast.success("Elemento duplicado.");
  };

  // Eliminar elemento seleccionado
  const eliminarElemento = () => {
    if (!elementoSeleccionadoId) return;
    registrarCambio(elementos.filter((e) => e.id !== elementoSeleccionadoId));
    setElementoSeleccionadoId(null);
    toast.success("Elemento eliminado.");
  };

  // Alinear elemento seleccionado
  const alinearElemento = (pos: PosicionAlineacion) => {
    if (!elementoSeleccionado) return;
    const { x, y } = alinearElementoKonva(elementoSeleccionado, pos, anchoMm, altoMm);
    handleActualizarElemento(elementoSeleccionado.id, { x, y });
  };

  // Reordenar capas (Z-Index)
  const moverCapa = (direccion: "arriba" | "abajo") => {
    if (!elementoSeleccionadoId) return;
    const reorganizados = moverCapaKonva(elementos, elementoSeleccionadoId, direccion);
    if (reorganizados !== elementos) {
      registrarCambio(reorganizados);
    }
  };

  // Buscar trabajador para vista previa real
  const handleBuscarPersonaReal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedulaBusqueda.trim()) return;
    setBuscandoCedula(true);
    try {
      const emp = await buscarEmpleadoParaCarnetAction(cedulaBusqueda.trim());
      if (emp && !("error" in emp)) {
        setDatosPersona({
          nombre: emp.nombreCompleto,
          cedula: emp.cedula,
          nac: "12/04/1985",
          correo: `${emp.cedula.toLowerCase()}@institucion.gob.ve`,
          cargo: emp.cargo || "Sin cargo registrado",
          codigo: emp.codigo || "C-0000",
          oficina: emp.departamento || "Sede Principal",
          nivel: "Operativo",
          nomina: "Empleado Regular",
          ingreso: "01/01/2020",
          sangre: "O Rh+",
          alerg: "Ninguna",
          emer: "Contacto Registrado",
          emision: new Date().toLocaleDateString("es-ES"),
          vence: "Sin vencimiento",
          foto_url: emp.fotoUrl || undefined,
        });
        setModoPreviewReal(true);
        toast.success(`Datos cargados para ${emp.nombreCompleto}`);
      } else {
        const errorMsg =
          emp && "error" in emp ? emp.error : "No se encontró ningún empleado con esa cédula.";
        toast.error(errorMsg);
      }
    } catch {
      toast.error("Error al buscar el empleado.");
    } finally {
      setBuscandoCedula(false);
    }
  };

  const restaurarPersonaFicticia = () => {
    setDatosPersona(PERSONA_FICTICIA_DEFECTO);
    setModoPreviewReal(false);
    setCedulaBusqueda("");
    toast.info("Vista previa restaurada a datos ficticios.");
  };

  return {
    caraActual,
    setCaraActual,
    escala,
    setEscala,
    mostrarGuias,
    setMostrarGuias,
    elementoSeleccionadoId,
    setElementoSeleccionadoId,
    elementos,
    setElementos,
    historial,
    historialIndex,
    reglasColor,
    setReglasColor,
    tabInspector,
    setTabInspector,
    nuevoValorNombre,
    setNuevoValorNombre,
    datosPersona,
    modoPreviewReal,
    cedulaBusqueda,
    setCedulaBusqueda,
    buscandoCedula,
    coloresResueltos,
    elementoSeleccionado,
    registrarCambio,
    handleDeshacer,
    handleRehacer,
    handleActualizarElemento,
    anadirElemento,
    duplicarElemento,
    eliminarElemento,
    alinearElemento,
    moverCapa,
    handleBuscarPersonaReal,
    restaurarPersonaFicticia,
  };
}
