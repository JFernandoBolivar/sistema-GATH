"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { PlantillaMotor } from "../../domain/entities/carnet";
import type {
  AlcanceLimpieza,
  ElementoKonva,
  PersonaMuestra,
  PosicionAlineacion,
  ReglasColorConfig,
} from "../../domain/entities/disenador";
import { adaptarDefinicionAEditor } from "../../application/use-cases/adaptar-definicion-plantilla";
import {
  alinearElementoKonva,
  alinearVariosKonva,
  alternarSeleccionKonva,
  eliminarElementosKonva,
  idsDeCaraKonva,
  duplicarElementoKonva,
  limpiarElementosKonva,
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
  const [seleccionIds, setSeleccionIds] = useState<string[]>([]);
  // Con un solo elemento seleccionado el comportamiento es el de siempre.
  const elementoSeleccionadoId = seleccionIds.length === 1 ? seleccionIds[0] : null;
  const setElementoSeleccionadoId = useCallback(
    (id: string | null) => setSeleccionIds(id ? [id] : []),
    [],
  );
  const [mostrarGuias, setMostrarGuias] = useState(true);

  // Estados de definición y capas
  const [elementos, setElementos] = useState<ElementoKonva[]>([]);
  const [historial, setHistorial] = useState<ElementoKonva[][]>([]);
  const [historialIndex, setHistorialIndex] = useState<number>(-1);
  // Refs: varias actualizaciones en el mismo tick (p. ej. mover N nodos) no pisan el estado.
  const elementosRef = useRef<ElementoKonva[]>([]);
  const historialRef = useRef<ElementoKonva[][]>([]);
  const indiceRef = useRef<number>(-1);

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

  const reiniciarHistorial = useCallback((lista: ElementoKonva[]) => {
    elementosRef.current = lista;
    historialRef.current = [lista];
    indiceRef.current = 0;
    setElementos(lista);
    setHistorial([lista]);
    setHistorialIndex(0);
  }, []);

  // Inicializar elementos desde la definición guardada (anverso/reverso del motor)
  useEffect(() => {
    if (!plantilla) return;
    const adaptada = adaptarDefinicionAEditor(plantilla.definicion);
    if (adaptada.elementos.length > 0) {
      reiniciarHistorial(adaptada.elementos);
      if (adaptada.reglasColor) setReglasColor(adaptada.reglasColor);
    } else {
      const iniciales = crearElementosInicialesDefecto(anchoMm);
      reiniciarHistorial(iniciales);
    }
  }, [plantilla, anchoMm, reiniciarHistorial]);

  // Actualizar historial para Deshacer / Rehacer
  const registrarCambio = useCallback((nuevosElementos: ElementoKonva[]) => {
    const nuevoHistorial = [...historialRef.current.slice(0, indiceRef.current + 1), nuevosElementos];
    historialRef.current = nuevoHistorial;
    indiceRef.current = nuevoHistorial.length - 1;
    elementosRef.current = nuevosElementos;
    setElementos(nuevosElementos);
    setHistorial(nuevoHistorial);
    setHistorialIndex(indiceRef.current);
  }, []);

  // Deshacer (Undo)
  const handleDeshacer = () => {
    if (indiceRef.current > 0) {
      indiceRef.current -= 1;
      elementosRef.current = historialRef.current[indiceRef.current];
      setHistorialIndex(indiceRef.current);
      setElementos(elementosRef.current);
    }
  };

  // Rehacer (Redo)
  const handleRehacer = () => {
    if (indiceRef.current < historialRef.current.length - 1) {
      indiceRef.current += 1;
      elementosRef.current = historialRef.current[indiceRef.current];
      setHistorialIndex(indiceRef.current);
      setElementos(elementosRef.current);
    }
  };

  // Actualizar propiedades de un elemento
  const handleActualizarElemento = (id: string, cambios: Partial<ElementoKonva>) => {
    const nuevos = elementosRef.current.map((el) => (el.id === id ? { ...el, ...cambios } : el));
    registrarCambio(nuevos);
  };

  // Elemento actualmente seleccionado
  const elementoSeleccionado = elementos.find((e) => e.id === elementoSeleccionadoId) || null;

  // Añadir nuevo elemento
  const anadirElemento = (nuevo: Omit<ElementoKonva, "id">) => {
    const id = `el-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const elementoCompleto: ElementoKonva = { ...nuevo, id };
    registrarCambio([...elementosRef.current, elementoCompleto]);
    setElementoSeleccionadoId(id);
  };

  // Duplicar elemento
  const duplicarElemento = () => {
    if (!elementoSeleccionado) return;
    const id = `el-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const copia = duplicarElementoKonva(elementoSeleccionado, anchoMm, altoMm, id);
    registrarCambio([...elementosRef.current, copia]);
    setElementoSeleccionadoId(id);
    toast.success("Elemento duplicado.");
  };

  // Eliminar la selección (uno o varios) en una sola entrada del historial
  const eliminarElemento = () => {
    if (seleccionIds.length === 0) return;
    registrarCambio(eliminarElementosKonva(elementosRef.current, seleccionIds));
    setSeleccionIds([]);
    toast.success(seleccionIds.length === 1 ? "Elemento eliminado." : "Elementos eliminados.");
  };

  // Selección múltiple
  const seleccionarElemento = (id: string | null, aditivo = false) => {
    if (id === null) return setSeleccionIds([]);
    setSeleccionIds((prev) => (aditivo ? alternarSeleccionKonva(prev, id) : [id]));
  };
  const seleccionarVarios = (ids: string[]) => setSeleccionIds(ids);
  const alinearSeleccion = (pos: "left" | "center-h" | "right") => {
    if (seleccionIds.length < 2) return;
    registrarCambio(alinearVariosKonva(elementosRef.current, seleccionIds, pos));
  };

  // Atajos: Supr/Delete, Escape, Ctrl+A (no se activan al escribir en un campo)
  const atajosRef = useRef({ eliminarElemento, caraActual });
  atajosRef.current = { eliminarElemento, caraActual };
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        atajosRef.current.eliminarElemento();
      } else if (e.key === "Escape") {
        setSeleccionIds([]);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSeleccionIds(idsDeCaraKonva(elementosRef.current, atajosRef.current.caraActual));
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  // Limpiar diseño: vacía la cara actual o ambas; entra al historial (se puede deshacer)
  const limpiarDiseno = (alcance: AlcanceLimpieza) => {
    registrarCambio(limpiarElementosKonva(elementosRef.current, alcance, caraActual));
    setSeleccionIds([]);
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
    const reorganizados = moverCapaKonva(elementosRef.current, elementoSeleccionadoId, direccion);
    if (reorganizados !== elementosRef.current) {
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
    seleccionIds,
    seleccionarElemento,
    seleccionarVarios,
    alinearSeleccion,
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
    limpiarDiseno,
    handleBuscarPersonaReal,
    restaurarPersonaFicticia,
  };
}
