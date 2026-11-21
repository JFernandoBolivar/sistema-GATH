"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Eye,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  PlusSquare,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
  CampoCredencial,
  ElementoBiblioteca,
  PlantillaMotor,
} from "../../domain/entities/carnet";
import { adaptarEditorADefinicion } from "../../application/use-cases/adaptar-definicion-plantilla";
import {
  actualizarPlantillaBorradorAction,
  getBibliotecaAction,
  getCamposAction,
  getPlantillaMotorAction,
  getSugerenciasReglasColorAction,
  getTiposCredencialAction,
  vistaPreviaPlantillaAction,
} from "../../infrastructure/actions/carnetizacion-actions";
import { useDisenadorEditor } from "../hooks/use-disenador-editor";
import { useDisenadorPaneles, type PanelMovil } from "../hooks/use-disenador-paneles";
import { DisenadorToolbar } from "../components/disenador/disenador-toolbar";
import { DisenadorHerramientasPanel } from "../components/disenador/disenador-herramientas-panel";
import { DisenadorCapasPanel } from "../components/disenador/disenador-capas-panel";
import { DisenadorPropiedadesPanel } from "../components/disenador/disenador-propiedades-panel";
import { DisenadorSeleccionMultiple } from "../components/disenador/disenador-seleccion-multiple";
import { DisenadorReglasColorPanel } from "../components/disenador/disenador-reglas-color-panel";
import { DisenadorBibliotecaDialog } from "../components/disenador/disenador-biblioteca-dialog";
import { DisenadorFondoPanel } from "../components/disenador/disenador-fondo-panel";
import {
  DisenadorVistaPreviaDialog,
  type CarasVistaPrevia,
} from "../components/disenador/disenador-vista-previa-dialog";
import {
  DisenadorLienzoControles,
  calcularEscalaAjuste,
} from "../components/disenador/disenador-lienzo-controles";
import { DisenadorPanelNavIzquierdo } from "../components/disenador/disenador-panel-nav-izquierdo";
import { DisenadorMenuAcciones } from "../components/disenador/disenador-menu-acciones";
import { useIsMobile } from "@/shared/hooks/use-mobile";

// Carga dinámica de Konva sin SSR
const KonvaCanvasStage = dynamic(
  () =>
    import("../components/disenador/konva-canvas-stage").then(
      (m) => m.KonvaCanvasStage
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full min-h-[160px] gap-2">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Cargando lienzo interactivo...</span>
      </div>
    ),
  }
);

/** Escala de referencia (px/mm) mientras no se ha medido el contenedor. */
const ESCALA_INICIAL = 4.2;
/** Alto aproximado del encabezado de la app, mientras no se ha medido (≈ 5 rem). */
const CLASE_ALTO_RESPALDO = "h-[calc(100dvh-5rem)]";

interface Props {
  plantillaId: string;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export function DisenadorView({ plantillaId }: Props) {
  const isMobile = useIsMobile();

  const router = useRouter();
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [modalBibliotecaOpen, setModalBibliotecaOpen] = useState(false);
  const [vistaPreviaAbierta, setVistaPreviaAbierta] = useState(false);
  const [carasVistaPrevia, setCarasVistaPrevia] = useState<CarasVistaPrevia | null>(null);
  const [isPendingVistaPrevia, startVistaPrevia] = useTransition();

  // Nodos montados actualmente (callback refs: cambian al pasar de escritorio a móvil)
  const [raiz, setRaiz] = useState<HTMLDivElement | null>(null);
  const [contenedorLienzo, setContenedorLienzo] = useState<HTMLDivElement | null>(null);

  // Alto del encabezado de la app (distancia de la raíz al borde superior de la página)
  const [offsetSuperior, setOffsetSuperior] = useState<number | null>(null);
  // Escala de ajuste automático (px/mm) medida en el observer
  const [escalaAjuste, setEscalaAjuste] = useState(ESCALA_INICIAL);
  // Si el usuario hizo zoom manual no se reajusta al redimensionar
  const escalaManualRef = useRef(false);

  // ── Consultas SWR ───────────────────────────────────────────────────────────
  const { data: respuestaPlantilla, mutate: mutatePlantilla } = useSWR(
    ["plantilla-motor", plantillaId],
    () => getPlantillaMotorAction(plantillaId),
    // Sin revalidar solo por foco o reconexión: el editor no debe recargarse mientras se trabaja.
    { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false },
  );

  const plantilla: PlantillaMotor | null =
    respuestaPlantilla && respuestaPlantilla.success ? respuestaPlantilla.data : null;

  const { data: respuestaCampos } = useSWR(
    ["campos-disenador", plantilla?.codigo_tipo || "trabajador"],
    () => getCamposAction(plantilla?.codigo_tipo || "trabajador")
  );
  const camposDisponibles: CampoCredencial[] =
    respuestaCampos && respuestaCampos.success ? respuestaCampos.data : [];

  const {
    data: respuestaBiblioteca,
    isLoading: cargandoBiblioteca,
    error: errorBiblioteca,
  } = useSWR("biblioteca-medios-disenador", () => getBibliotecaAction());
  const mediosBiblioteca: ElementoBiblioteca[] =
    respuestaBiblioteca && respuestaBiblioteca.success ? respuestaBiblioteca.data : [];
  const errorBibliotecaMedios = errorBiblioteca
    ? "No se pudo cargar la biblioteca de medios."
    : respuestaBiblioteca && !respuestaBiblioteca.success
      ? respuestaBiblioteca.error
      : null;

  const { data: tiposCredencial } = useSWR("tipos-credencial-disenador", () =>
    getTiposCredencialAction(),
  );
  const tiposExternos = (tiposCredencial ?? []).filter(
    (t) => t.activo && t.grupo !== "trabajador" && t.grupo !== "pasivo",
  );

  const { data: sugerenciasReglasColor, isLoading: cargandoSugerencias } = useSWR(
    "sugerencias-reglas-color-disenador",
    () => getSugerenciasReglasColorAction(),
  );

  const anchoMm = plantilla?.ancho_mm || 54.0;
  const altoMm = plantilla?.alto_mm || 85.6;

  const editor = useDisenadorEditor({ plantilla, anchoMm, altoMm });
  const { setEscala } = editor;

  const campoSeleccionadoMeta =
    editor.elementoSeleccionado?.t === "field"
      ? camposDisponibles.find((c) => c.codigo === editor.elementoSeleccionado?.field) || null
      : null;

  const paneles = useDisenadorPaneles({
    isMobile,
    setTabInspector: editor.setTabInspector,
  });
  const { panelIzquierdo, setPanelIzquierdo, panelMovil, setPanelMovil, mostrarPropiedades } =
    paneles;

  // ── Alto de la raíz: viewport menos el encabezado real de la app ───────────
  // Ningún ancestro tiene alto definido, así que se mide dónde empieza la raíz
  // (justo debajo del HeaderLayout sticky) y se descuenta del viewport.
  useEffect(() => {
    if (!raiz) return;
    const medir = () => setOffsetSuperior(Math.round(raiz.getBoundingClientRect().top + window.scrollY));
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, [raiz]);

  // ── Escala automática: observa el wrapper del lienzo (tamaño independiente) ─
  const margenLienzo = isMobile ? 12 : 32;
  // En escritorio, las medidas y el zoom van en una franja superior reservada: el carnet se
  // ajusta debajo y los controles nunca lo tapan. En móvil el zoom va en columna al costado.
  const franjaControles = isMobile ? 0 : 48;
  useEffect(() => {
    if (!contenedorLienzo) return;
    const medir = () => {
      const nueva = calcularEscalaAjuste(
        contenedorLienzo.clientWidth,
        contenedorLienzo.clientHeight - franjaControles,
        anchoMm,
        altoMm,
        margenLienzo,
      );
      setEscalaAjuste(nueva);
      if (!escalaManualRef.current) setEscala(nueva);
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(contenedorLienzo);
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, [contenedorLienzo, anchoMm, altoMm, margenLienzo, franjaControles, setEscala]);

  // Cambio de escala por el usuario → modo manual
  const handleCambiarEscalaManual = (nuevaEscala: number | ((prev: number) => number)) => {
    escalaManualRef.current = true;
    setEscala(nuevaEscala);
  };

  // «Ajustar»: vuelve al modo automático
  const handleAjustarLienzo = () => {
    escalaManualRef.current = false;
    setEscala(escalaAjuste);
  };

  // ── Selección → mostrar Propiedades (desde los manejadores, no desde un efecto) ──
  const alSeleccionarElemento = (id: string | null, aditivo?: boolean) => {
    editor.seleccionarElemento(id, aditivo);
    if (id !== null) mostrarPropiedades();
  };
  const alSeleccionarVarios = (ids: string[]) => {
    editor.seleccionarVarios(ids);
    if (ids.length > 0) mostrarPropiedades();
  };
  const alSeleccionarCapa = (id: string | null) => {
    editor.setElementoSeleccionadoId(id);
    if (id !== null) mostrarPropiedades();
  };

  // ── Vista previa PDF ────────────────────────────────────────────────────────
  const abrirVistaPrevia = () => {
    if (!plantilla) return;
    setCarasVistaPrevia(null);
    setVistaPreviaAbierta(true);
    startVistaPrevia(async () => {
      const definicion = adaptarEditorADefinicion(
        plantilla.definicion,
        editor.elementos,
        editor.reglasColor,
        anchoMm,
        altoMm,
        plantilla.orientacion,
        editor.fondos,
      );
      const res = await vistaPreviaPlantillaAction(String(plantilla.id), definicion);
      if (res.success && res.data) {
        setCarasVistaPrevia(res.data);
      } else {
        setVistaPreviaAbierta(false);
        toast.error(res.message || "No se pudo generar la vista previa.");
      }
    });
  };

  // ── Guardar Borrador ────────────────────────────────────────────────────────
  const guardarBorrador = () => {
    if (!plantilla) return;
    startTransition(async () => {
      const definicion = adaptarEditorADefinicion(
        plantilla.definicion,
        editor.elementos,
        editor.reglasColor,
        anchoMm,
        altoMm,
        plantilla.orientacion,
        editor.fondos,
      );

      const res = await actualizarPlantillaBorradorAction(plantilla.id, { definicion });

      if (res.success) {
        toast.success("Definición de plantilla guardada exitosamente.");
        editor.marcarGuardado();
        mutatePlantilla();
      } else {
        toast.error(res.error || "No se pudo guardar la plantilla.");
      }
    });
  };

  // ── Contenido de cada panel (compartido por escritorio y móvil) ─────────────
  const contenidoAgregar = (
    <DisenadorHerramientasPanel
      caraActual={editor.caraActual}
      camposDisponibles={camposDisponibles}
      onAnadirElemento={editor.anadirElemento}
      onAbrirBiblioteca={() => setModalBibliotecaOpen(true)}
    />
  );

  const contenidoFondo = (
    <DisenadorFondoPanel
      cara={editor.caraActual}
      fondo={editor.fondos[editor.caraActual]}
      mediosBiblioteca={mediosBiblioteca}
      cargandoMedios={cargandoBiblioteca}
      errorMedios={errorBibliotecaMedios}
      onSeleccionarFondo={editor.seleccionarFondo}
      onQuitarFondo={editor.quitarFondo}
    />
  );

  const contenidoCapas = (
    <DisenadorCapasPanel
      caraActual={editor.caraActual}
      elementos={editor.elementos}
      elementoSeleccionadoId={editor.elementoSeleccionadoId}
      onSeleccionarElemento={alSeleccionarCapa}
      onMoverCapa={editor.moverCapa}
      onActualizarElemento={editor.handleActualizarElemento}
    />
  );

  const contenidoColores = (
    <DisenadorReglasColorPanel
      reglasColor={editor.reglasColor}
      onActualizarReglasColor={editor.setReglasColor}
      nuevoValorNombre={editor.nuevoValorNombre}
      onCambiarNuevoValorNombre={editor.setNuevoValorNombre}
      tiposExternos={tiposExternos}
      sugerenciasReglasColor={sugerenciasReglasColor}
      cargandoSugerencias={cargandoSugerencias}
    />
  );

  const contenidoPropiedades =
    editor.seleccionIds.length > 1 ? (
      <DisenadorSeleccionMultiple
        cantidad={editor.seleccionIds.length}
        onEliminar={editor.eliminarElemento}
        onAlinear={editor.alinearSeleccion}
      />
    ) : (
      <DisenadorPropiedadesPanel
        elementoSeleccionado={editor.elementoSeleccionado}
        elementos={editor.elementos}
        campoSeleccionadoMeta={campoSeleccionadoMeta}
        onActualizarElemento={editor.handleActualizarElemento}
        onDuplicarElemento={editor.duplicarElemento}
        onEliminarElemento={editor.eliminarElemento}
        onAlinearElemento={editor.alinearElemento}
        mediosBiblioteca={mediosBiblioteca}
        controlForma={{
          edicionPuntos: editor.edicionPuntos,
          onEditarPuntos: editor.iniciarEdicionPuntos,
          onTerminarEdicion: editor.terminarEdicionPuntos,
          onCambiarRadioPunto: editor.cambiarRadioPuntoEditado,
          onEliminarPunto: editor.eliminarPuntoEditado,
          onConvertirAPathLibre: editor.convertirAPathLibre,
          onConvertirEnFormaLibre: editor.convertirEnFormaLibre,
        }}
      />
    );

  // ── Panel del inspector derecho (escritorio) ────────────────────────────────
  const inspectorDerecho = (
    <>
      {/* Selector de pestaña del inspector */}
      <div className="flex border-b bg-muted/20 px-2 pt-1 gap-1">
        <Button
          type="button"
          variant={editor.tabInspector === "propiedades" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 h-7 text-xs font-semibold"
          onClick={() => editor.setTabInspector("propiedades")}
        >
          Propiedades
        </Button>
        <Button
          type="button"
          variant={editor.tabInspector === "colores" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 h-7 text-xs font-semibold gap-1.5"
          onClick={() => editor.setTabInspector("colores")}
        >
          <Palette className="size-3.5" />
          Reglas de Color
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {editor.tabInspector === "colores" ? contenidoColores : contenidoPropiedades}
        </div>
      </ScrollArea>
    </>
  );

  // ── Panel izquierdo activo (escritorio) ─────────────────────────────────────
  const panelIzquierdoContenido = (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-3">
        {panelIzquierdo === "agregar"
          ? contenidoAgregar
          : panelIzquierdo === "fondo"
            ? contenidoFondo
            : contenidoCapas}
      </div>
    </ScrollArea>
  );

  // ── Lienzo (mismo nodo observado en escritorio y móvil) ─────────────────────
  const lienzoCentral = (
    <div
      ref={setContenedorLienzo}
      className={cn(
        "relative bg-muted/20",
        isMobile ? "h-[38svh] shrink-0 border-b" : "flex-1 min-h-0 min-w-0",
      )}
    >
      {/* Área desplazable (solo con zoom manual mayor al contenedor) */}
      <div className="absolute inset-x-0 bottom-0 overflow-auto" style={{ top: franjaControles }}>
        <div className="flex min-h-full min-w-full">
          <div className="m-auto shrink-0 p-3">
            <KonvaCanvasStage
              anchoMm={anchoMm}
              altoMm={altoMm}
              escala={editor.escala}
              elementos={editor.elementos}
              caraActual={editor.caraActual}
              seleccionIds={editor.seleccionIds}
              onSeleccionarElemento={alSeleccionarElemento}
              onSeleccionarVarios={alSeleccionarVarios}
              onActualizarElemento={editor.handleActualizarElemento}
              datosPersona={editor.datosPersona}
              coloresRegla={editor.coloresResueltos}
              mostrarGuias={editor.mostrarGuias}
              fondo={editor.fondos[editor.caraActual]}
              edicionPuntos={editor.edicionPuntos}
              onSeleccionarPunto={editor.seleccionarPunto}
              onMoverPunto={editor.moverPuntoEditado}
              onAgregarPunto={editor.agregarPuntoEditado}
              anchorSize={isMobile ? 16 : 8}
            />
          </div>
        </div>
      </div>

      {/* Pista y salida del modo «Editar puntos» */}
      {editor.edicionPuntos && (
        <div className="absolute bottom-2 left-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-background/95 py-1 pl-3 pr-1 text-xs shadow-md">
          <span className="truncate">Arrastra los puntos para cambiar la forma</span>
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0 gap-1 rounded-full px-3 text-xs"
            onClick={editor.terminarEdicionPuntos}
          >
            <Check className="size-3.5" aria-hidden />
            Listo
          </Button>
        </div>
      )}

      {/* Medidas y cara (no interactivo) */}
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:text-[11px]">
        {isMobile ? editor.caraActual : `${anchoMm} × ${altoMm} mm · ${editor.caraActual}`}
      </span>

      {/* Controles de zoom sobre el lienzo (en móvil, en columna al borde para no tapar el carnet) */}
      <div className="absolute right-2 top-2 z-10">
        <DisenadorLienzoControles
          escala={editor.escala}
          onCambiarEscala={handleCambiarEscalaManual}
          onAjustar={handleAjustarLienzo}
          tactil={isMobile}
          vertical={isMobile}
        />
      </div>
    </div>
  );

  // ── Encabezado compacto (una sola fila) ─────────────────────────────────────
  const encabezado = (
    <div className="flex items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 border-b bg-background shrink-0">
      {/* Volver a Plantillas */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9 shrink-0" asChild>
              <Link
                href="/carnetizacion/plantillas"
                aria-label="Volver a Plantillas"
                onClick={(e) => {
                  if (editor.sinGuardar) {
                    e.preventDefault();
                    setConfirmarSalida(true);
                  }
                }}
              >
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Volver a Plantillas</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Nombre de la plantilla (visualmente oculto en pantallas muy angostas) */}
      <h1 className="sr-only sm:not-sr-only text-sm font-semibold truncate min-w-0 flex-1">
        {plantilla?.nombre || "Cargando plantilla..."}
      </h1>
      <div className="flex-1 sm:hidden" aria-hidden />

      {/* Cara y deshacer/rehacer */}
      <div className="shrink-0">
        <DisenadorToolbar
          compacto
          ocultarZoom
          ocultarBusqueda
          ocultarLimpiar
          caraActual={editor.caraActual}
          onCambiarCara={(cara) => {
            editor.setCaraActual(cara);
            editor.setElementoSeleccionadoId(null);
          }}
          onDeshacer={editor.handleDeshacer}
          onRehacer={editor.handleRehacer}
          onLimpiar={editor.limpiarDiseno}
          puedeDeshacer={editor.historialIndex > 0}
          puedeRehacer={editor.historialIndex < editor.historial.length - 1}
          escala={editor.escala}
          onCambiarEscala={handleCambiarEscalaManual}
          modoPreviewReal={editor.modoPreviewReal}
          datosPersona={editor.datosPersona}
          cedulaBusqueda={editor.cedulaBusqueda}
          onCambiarCedulaBusqueda={editor.setCedulaBusqueda}
          buscandoCedula={editor.buscandoCedula}
          onBuscarPersonaReal={editor.handleBuscarPersonaReal}
          onRestaurarPersonaFicticia={editor.restaurarPersonaFicticia}
        />
      </div>

      {/* Acciones principales */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Vista previa PDF: visible directamente en pantallas ≥ sm (en móvil va en «⋯») */}
        <Button
          size="sm"
          variant="outline"
          onClick={abrirVistaPrevia}
          disabled={!plantilla || isPendingVistaPrevia}
          className="gap-1.5 hidden sm:flex"
          aria-label="Vista previa PDF"
        >
          {isPendingVistaPrevia ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Eye className="size-4" />
          )}
          Vista previa PDF
        </Button>

        {/* Indicador de cambios pendientes (escritorio y móvil) */}
        {editor.sinGuardar && (
          <span
            role="status"
            data-testid="indicador-sin-guardar"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <span className="size-2 rounded-full bg-amber-500" aria-hidden />
            <span className="hidden sm:inline">Cambios sin guardar</span>
            <span className="sr-only sm:hidden">Cambios sin guardar</span>
          </span>
        )}

        {/* Guardar Borrador: siempre visible */}
        <Button
          size="sm"
          onClick={guardarBorrador}
          disabled={isPending}
          className="gap-1.5"
          aria-label="Guardar Borrador"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span className="hidden sm:inline">Guardar Borrador</span>
        </Button>

        {/* Menú de acciones secundarias: guías, persona real, limpiar diseño */}
        <DisenadorMenuAcciones
          caraActual={editor.caraActual}
          mostrarGuias={editor.mostrarGuias}
          onAlternarGuias={() => editor.setMostrarGuias(!editor.mostrarGuias)}
          onVistaPrevia={abrirVistaPrevia}
          vistaPreviaDeshabilitada={!plantilla || isPendingVistaPrevia}
          onLimpiar={editor.limpiarDiseno}
          modoPreviewReal={editor.modoPreviewReal}
          datosPersona={editor.datosPersona}
          cedulaBusqueda={editor.cedulaBusqueda}
          onCambiarCedulaBusqueda={editor.setCedulaBusqueda}
          buscandoCedula={editor.buscandoCedula}
          onBuscarPersonaReal={editor.handleBuscarPersonaReal}
          onRestaurarPersonaFicticia={editor.restaurarPersonaFicticia}
          tactil={isMobile}
        />
      </div>
    </div>
  );

  // ── Modales (presentes en escritorio y móvil) ───────────────────────────────
  const modales = (
    <>
      <DisenadorVistaPreviaDialog
        open={vistaPreviaAbierta}
        onOpenChange={setVistaPreviaAbierta}
        caras={carasVistaPrevia}
        cargando={isPendingVistaPrevia}
      />

      <AlertDialog open={confirmarSalida} onOpenChange={setConfirmarSalida}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar en el diseño. Si sales ahora se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/carnetizacion/plantillas")}>
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DisenadorBibliotecaDialog
        open={modalBibliotecaOpen}
        onOpenChange={setModalBibliotecaOpen}
        mediosBiblioteca={mediosBiblioteca}
        caraActual={editor.caraActual}
        onAnadirElemento={editor.anadirElemento}
      />
    </>
  );

  // Alto explícito: viewport menos encabezado de la app (sin scroll de página)
  const estiloRaiz =
    offsetSuperior !== null ? { height: `calc(100dvh - ${offsetSuperior}px)` } : undefined;

  // ── Vista Móvil (< 1024 px) ─────────────────────────────────────────────────
  if (isMobile) {
    const BOTONES_MOVIL: {
      id: PanelMovil;
      label: string;
      aria: string;
      titulo: string;
      Icono: React.ElementType;
      contenido: React.ReactNode;
    }[] = [
      {
        id: "agregar",
        label: "Agregar",
        aria: "Panel de herramientas para agregar elementos",
        titulo: "Agregar elementos",
        Icono: PlusSquare,
        contenido: contenidoAgregar,
      },
      {
        id: "fondo",
        label: "Fondo",
        aria: "Panel de fondo del carnet",
        titulo: "Fondo del carnet",
        Icono: ImageIcon,
        contenido: contenidoFondo,
      },
      {
        id: "capas",
        label: "Capas",
        aria: "Panel de capas",
        titulo: "Capas",
        Icono: Layers,
        contenido: contenidoCapas,
      },
      {
        id: "propiedades",
        label: "Propiedades",
        aria: "Panel de propiedades",
        titulo: "Propiedades",
        Icono: SlidersHorizontal,
        contenido: contenidoPropiedades,
      },
      {
        id: "colores",
        label: "Colores",
        aria: "Panel de reglas de color",
        titulo: "Reglas de color",
        Icono: Palette,
        contenido: contenidoColores,
      },
    ];
    const activoMovil = BOTONES_MOVIL.find((b) => b.id === panelMovil);

    return (
      <div
        ref={setRaiz}
        style={estiloRaiz}
        className={cn("flex flex-col overflow-hidden", CLASE_ALTO_RESPALDO)}
      >
        {encabezado}

        {/* Lienzo fijo arriba, ajustado al ancho de la pantalla */}
        {lienzoCentral}

        {/* Panel inferior NO modal: una región fija sobre la barra. No se usa el Drawer de vaul
            porque, aun con modal={false}, marca el resto de la página con aria-hidden y el lector
            de pantalla pierde el carnet y la barra mientras el panel está abierto. */}
        {activoMovil && (
          <section
            data-slot="panel-movil"
            aria-labelledby="titulo-panel-movil"
            className="fixed inset-x-0 bottom-14 z-30 flex max-h-[40svh] flex-col rounded-t-xl border-t bg-background shadow-lg"
            onKeyDown={(e) => {
              if (e.key === "Escape") setPanelMovil(null);
            }}
          >
            <header className="flex items-center justify-between border-b px-4 py-1.5">
              <h2 id="titulo-panel-movil" className="text-sm font-semibold">
                {activoMovil.titulo}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Cerrar panel de ${activoMovil.titulo.toLowerCase()}`}
                onClick={() => setPanelMovil(null)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{activoMovil.contenido}</div>
          </section>
        )}

        {/* Barra inferior fija (por encima del panel) */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex h-14 border-t bg-background"
          aria-label="Barra de herramientas del diseñador"
        >
          {BOTONES_MOVIL.map(({ id, label, aria, Icono }) => {
            const activo = panelMovil === id;
            return (
              <button
                key={id}
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-1 text-[10px] font-medium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  activo
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label={aria}
                aria-pressed={activo}
                onClick={() => setPanelMovil(activo ? null : id)}
              >
                <Icono className="size-5" aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {modales}
      </div>
    );
  }

  // ── Vista Escritorio (≥ 1024 px) ────────────────────────────────────────────
  return (
    <div
      ref={setRaiz}
      style={estiloRaiz}
      className={cn("flex flex-col overflow-hidden", CLASE_ALTO_RESPALDO)}
    >
      {/* Encabezado compacto fijo */}
      {encabezado}

      {/* Área principal del diseñador */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Columna izquierda: barra de íconos + panel activo */}
        <div className="flex border-r shrink-0 h-full">
          <DisenadorPanelNavIzquierdo
            panelActivo={panelIzquierdo}
            onCambiarPanel={setPanelIzquierdo}
          />

          <div className="w-64 flex flex-col h-full border-r">{panelIzquierdoContenido}</div>
        </div>

        {/* Centro: lienzo */}
        {lienzoCentral}

        {/* Panel derecho: inspector */}
        <div className="w-72 flex flex-col border-l h-full shrink-0">{inspectorDerecho}</div>
      </div>

      {modales}
    </div>
  );
}
