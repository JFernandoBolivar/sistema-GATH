"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { PlantillaMotor } from "../../domain/entities/carnet";
import type {
  AlcanceLimpieza,
  ElementoKonva,
  FondoCara,
  FondosCara,
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
import {
  agregarPuntoCercano,
  cambiosFormaLibre,
  cambiarRadioPunto,
  eliminarPunto,
  generarPathDesdePuntos,
  moverPunto,
  puntosDesdePath,
  PUNTOS_FRANJA_DIAGONAL,
  PUNTOS_TRIANGULO,
  type PuntoForma,
} from "../../domain/entities/forma-puntos";
import { crearElementosInicialesDefecto } from "../../domain/entities/disenador-plantilla-defecto";
import { buscarEmpleadoParaCarnetAction } from "../../infrastructure/actions/carnetizacion-actions";

/** Estado que entra al historial de deshacer/rehacer: capas y fondos por cara. */
interface InstantaneaEditor {
  elementos: ElementoKonva[];
  fondos: FondosCara;
}

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
  // Modo «Editar puntos»: elemento en edición y vértice seleccionado
  const [edicionPuntos, setEdicionPuntos] = useState<{ id: string; indice: number | null } | null>(null);
  const edicionRef = useRef(edicionPuntos);
  edicionRef.current = edicionPuntos;

  // Estados de definición y capas
  const [elementos, setElementos] = useState<ElementoKonva[]>([]);
  // Fondo por cara (B-2): no es una capa; se guarda aparte para dibujarlo antes de todo.
  const [fondos, setFondos] = useState<FondosCara>({});
  const [historial, setHistorial] = useState<InstantaneaEditor[]>([]);
  const [historialIndex, setHistorialIndex] = useState<number>(-1);
  // Refs: varias actualizaciones en el mismo tick (p. ej. mover N nodos) no pisan el estado.
  const elementosRef = useRef<ElementoKonva[]>([]);
  const fondosRef = useRef<FondosCara>({});
  const historialRef = useRef<InstantaneaEditor[]>([]);
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

  const reiniciarHistorial = useCallback((lista: ElementoKonva[], fondosIniciales: FondosCara) => {
    elementosRef.current = lista;
    fondosRef.current = fondosIniciales;
    const inicial: InstantaneaEditor = { elementos: lista, fondos: fondosIniciales };
    historialRef.current = [inicial];
    indiceRef.current = 0;
    setElementos(lista);
    setFondos(fondosIniciales);
    setHistorial([inicial]);
    setHistorialIndex(0);
  }, []);

  // Última versión guardada o cargada: referencia a la instantánea y a las reglas de color.
  // «Sin guardar» = la instantánea actual ya no es esa (deshacer hasta ella lo limpia).
  const [base, setBase] = useState<{ snap: InstantaneaEditor | null; reglas: ReglasColorConfig | null }>({
    snap: null,
    reglas: null,
  });
  const reglasRef = useRef(reglasColor);
  reglasRef.current = reglasColor;
  const idCargadoRef = useRef<string | null>(null);

  // Inicializar elementos desde la definición guardada (anverso/reverso del motor).
  // Solo cuando cambia la plantilla (id): una revalidación de SWR devuelve un objeto nuevo
  // con el mismo id y NO debe borrar los cambios sin guardar.
  useEffect(() => {
    if (!plantilla) return;
    if (idCargadoRef.current === plantilla.id) return;
    idCargadoRef.current = plantilla.id;
    const adaptada = adaptarDefinicionAEditor(plantilla.definicion);
    if (adaptada.elementos.length > 0) {
      reiniciarHistorial(adaptada.elementos, adaptada.fondos);
    } else {
      const iniciales = crearElementosInicialesDefecto(anchoMm);
      reiniciarHistorial(iniciales, adaptada.fondos);
    }
    const reglasIniciales =
      adaptada.elementos.length > 0 && adaptada.reglasColor ? adaptada.reglasColor : reglasRef.current;
    if (reglasIniciales !== reglasRef.current) setReglasColor(reglasIniciales);
    setBase({ snap: historialRef.current[0], reglas: reglasIniciales });
  }, [plantilla, anchoMm, reiniciarHistorial]);

  const sinGuardar =
    base.snap !== null &&
    (historialRef.current[indiceRef.current] !== base.snap || reglasColor !== base.reglas);
  // Tras guardar con éxito: lo actual pasa a ser la referencia.
  const marcarGuardado = useCallback(() => {
    setBase({ snap: historialRef.current[indiceRef.current] ?? null, reglas: reglasRef.current });
  }, []);

  // Aviso nativo al recargar o cerrar la pestaña con cambios pendientes
  useEffect(() => {
    if (!sinGuardar) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [sinGuardar]);

  // Actualizar historial para Deshacer / Rehacer
  // Cada instantánea guarda elementos y fondos por cara, para deshacer también los fondos.
  const registrarInstantanea = useCallback((instantanea: InstantaneaEditor) => {
    const nuevoHistorial = [...historialRef.current.slice(0, indiceRef.current + 1), instantanea];
    historialRef.current = nuevoHistorial;
    indiceRef.current = nuevoHistorial.length - 1;
    elementosRef.current = instantanea.elementos;
    fondosRef.current = instantanea.fondos;
    setElementos(instantanea.elementos);
    setFondos(instantanea.fondos);
    setHistorial(nuevoHistorial);
    setHistorialIndex(indiceRef.current);
  }, []);

  const registrarCambio = useCallback(
    (nuevosElementos: ElementoKonva[]) =>
      registrarInstantanea({ elementos: nuevosElementos, fondos: fondosRef.current }),
    [registrarInstantanea],
  );

  const restaurarInstantanea = () => {
    const instantanea = historialRef.current[indiceRef.current];
    elementosRef.current = instantanea.elementos;
    fondosRef.current = instantanea.fondos;
    setHistorialIndex(indiceRef.current);
    setElementos(instantanea.elementos);
    setFondos(instantanea.fondos);
  };

  // Deshacer (Undo)
  const handleDeshacer = () => {
    if (indiceRef.current > 0) {
      indiceRef.current -= 1;
      restaurarInstantanea();
    }
  };

  // Rehacer (Redo)
  const handleRehacer = () => {
    if (indiceRef.current < historialRef.current.length - 1) {
      indiceRef.current += 1;
      restaurarInstantanea();
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

  // --- Edición de puntos (cada cambio entra al historial: se puede deshacer) ---
  const aplicarPuntos = (id: string, puntos: PuntoForma[], extra: Partial<ElementoKonva> = {}) => {
    const el = elementosRef.current.find((e) => e.id === id);
    if (!el) return;
    handleActualizarElemento(id, {
      t: "path",
      puntos,
      path: generarPathDesdePuntos(puntos, el.w, el.h),
      ...extra,
    });
  };

  const iniciarEdicionPuntos = (id: string) => {
    const el = elementosRef.current.find((e) => e.id === id);
    if (!el) return;
    if (!el.puntos) {
      const inicial: PuntoForma[] | null =
        el.t === "tri"
          ? [...PUNTOS_TRIANGULO]
          : el.t === "diag"
            ? [...PUNTOS_FRANJA_DIAGONAL]
            : el.t === "path"
              ? puntosDesdePath(el.path || "")
              : null;
      if (!inicial) {
        toast.error("Esta forma no se puede editar por puntos; usa el código SVG avanzado.");
        return;
      }
      if (el.t === "path" && el.path && /[CQcq]/.test(el.path)) {
        toast.info("Las curvas pasaron a vértices; usa el radio de cada punto para curvar esa esquina.");
      }
      aplicarPuntos(id, inicial);
    }
    setSeleccionIds([id]);
    setEdicionPuntos({ id, indice: null });
  };
  /** Rectángulo o círculo → forma libre por puntos, y entra directo en «Editar puntos». */
  const convertirEnFormaLibre = (id: string) => {
    const el = elementosRef.current.find((e) => e.id === id);
    const cambios = el && cambiosFormaLibre(el);
    if (!cambios) return;
    aplicarPuntos(id, cambios.puntos, cambios.extra);
    setSeleccionIds([id]);
    setEdicionPuntos({ id, indice: null });
  };
  const terminarEdicionPuntos = () => setEdicionPuntos(null);
  const seleccionarPunto = (indice: number | null) =>
    setEdicionPuntos((prev) => (prev ? { ...prev, indice } : prev));
  const moverPuntoEditado = (indice: number, x: number, y: number) => {
    const ed = edicionRef.current;
    const el = ed && elementosRef.current.find((e) => e.id === ed.id);
    if (!ed || !el?.puntos) return;
    aplicarPuntos(ed.id, moverPunto(el.puntos, indice, x, y));
  };
  const agregarPuntoEditado = (x: number, y: number) => {
    const ed = edicionRef.current;
    const el = ed && elementosRef.current.find((e) => e.id === ed.id);
    if (!ed || !el?.puntos) return;
    const res = agregarPuntoCercano(el.puntos, x, y, el.w, el.h);
    aplicarPuntos(ed.id, res.puntos);
    setEdicionPuntos({ id: ed.id, indice: res.indice });
  };
  const eliminarPuntoEditado = () => {
    const ed = edicionRef.current;
    const el = ed && elementosRef.current.find((e) => e.id === ed.id);
    if (!ed || ed.indice === null || !el?.puntos) return;
    if (el.puntos.length <= 3) {
      toast.warning("Una forma necesita al menos 3 puntos.");
      return;
    }
    aplicarPuntos(ed.id, eliminarPunto(el.puntos, ed.indice));
    setEdicionPuntos({ id: ed.id, indice: null });
  };
  const cambiarRadioPuntoEditado = (indice: number, r: number) => {
    const ed = edicionRef.current;
    const el = ed && elementosRef.current.find((e) => e.id === ed.id);
    if (!ed || !el?.puntos) return;
    aplicarPuntos(ed.id, cambiarRadioPunto(el.puntos, indice, r));
  };
  /** Pasa la forma a path libre (sin puntos) para editar el código a mano. */
  const convertirAPathLibre = (id: string) => {
    handleActualizarElemento(id, { puntos: undefined });
    setEdicionPuntos(null);
  };

  // Al cambiar la selección se sale del modo de edición de puntos
  useEffect(() => {
    if (edicionPuntos && !(seleccionIds.length === 1 && seleccionIds[0] === edicionPuntos.id)) {
      setEdicionPuntos(null);
    }
  }, [seleccionIds, edicionPuntos]);

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
  const atajosRef = useRef({ eliminarElemento, eliminarPuntoEditado, caraActual });
  atajosRef.current = { eliminarElemento, eliminarPuntoEditado, caraActual };
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (edicionRef.current) {
        // En «Editar puntos» Supr/Retroceso borra el vértice y Esc sale del modo.
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          atajosRef.current.eliminarPuntoEditado();
        } else if (e.key === "Escape") {
          setEdicionPuntos(null);
        }
        return;
      }
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

  // Fondo de una cara (B-2): elegir una imagen de la biblioteca o quitarla.
  const seleccionarFondo = (cara: "anverso" | "reverso", fondo: FondoCara) => {
    registrarInstantanea({
      elementos: elementosRef.current,
      fondos: { ...fondosRef.current, [cara]: fondo },
    });
  };
  const quitarFondo = (cara: "anverso" | "reverso") => {
    const resto = { ...fondosRef.current };
    delete resto[cara];
    registrarInstantanea({ elementos: elementosRef.current, fondos: resto });
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
    edicionPuntos,
    iniciarEdicionPuntos,
    terminarEdicionPuntos,
    seleccionarPunto,
    moverPuntoEditado,
    agregarPuntoEditado,
    eliminarPuntoEditado,
    cambiarRadioPuntoEditado,
    convertirAPathLibre,
    convertirEnFormaLibre,
    sinGuardar,
    marcarGuardado,
    seleccionIds,
    seleccionarElemento,
    seleccionarVarios,
    alinearSeleccion,
    elementos,
    setElementos,
    fondos,
    seleccionarFondo,
    quitarFondo,
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
