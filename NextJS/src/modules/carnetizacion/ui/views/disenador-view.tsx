"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Palette, Save } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import type { CampoCredencial, ElementoBiblioteca, PlantillaMotor } from "../../domain/entities/carnet";
import { adaptarEditorADefinicion } from "../../application/use-cases/adaptar-definicion-plantilla";
import {
  actualizarPlantillaBorradorAction,
  getBibliotecaAction,
  getCamposAction,
  getPlantillaMotorAction,
  getTiposCredencialAction,
} from "../../infrastructure/actions/carnetizacion-actions";
import { useDisenadorEditor } from "../hooks/use-disenador-editor";
import { DisenadorToolbar } from "../components/disenador/disenador-toolbar";
import { DisenadorHerramientasPanel } from "../components/disenador/disenador-herramientas-panel";
import { DisenadorCapasPanel } from "../components/disenador/disenador-capas-panel";
import { DisenadorPropiedadesPanel } from "../components/disenador/disenador-propiedades-panel";
import { DisenadorSeleccionMultiple } from "../components/disenador/disenador-seleccion-multiple";
import { DisenadorReglasColorPanel } from "../components/disenador/disenador-reglas-color-panel";
import { DisenadorBibliotecaDialog } from "../components/disenador/disenador-biblioteca-dialog";

// Carga dinámica de Konva sin SSR
const KonvaCanvasStage = dynamic(
  () =>
    import("../components/disenador/konva-canvas-stage").then(
      (m) => m.KonvaCanvasStage
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-2">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Cargando lienzo interactivo...</span>
      </div>
    ),
  }
);

interface Props {
  plantillaId: string;
}

export function DisenadorView({ plantillaId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [modalBibliotecaOpen, setModalBibliotecaOpen] = useState(false);

  // Consultas SWR
  const { data: respuestaPlantilla, mutate: mutatePlantilla } = useSWR(
    ["plantilla-motor", plantillaId],
    () => getPlantillaMotorAction(plantillaId)
  );

  const plantilla: PlantillaMotor | null =
    respuestaPlantilla && respuestaPlantilla.success ? respuestaPlantilla.data : null;

  const { data: respuestaCampos } = useSWR(
    ["campos-disenador", plantilla?.codigo_tipo || "trabajador"],
    () => getCamposAction(plantilla?.codigo_tipo || "trabajador")
  );
  const camposDisponibles: CampoCredencial[] =
    respuestaCampos && respuestaCampos.success ? respuestaCampos.data : [];

  const { data: respuestaBiblioteca } = useSWR(
    "biblioteca-medios-disenador",
    () => getBibliotecaAction()
  );
  const mediosBiblioteca: ElementoBiblioteca[] =
    respuestaBiblioteca && respuestaBiblioteca.success ? respuestaBiblioteca.data : [];

  // Tipos de credencial externa del catálogo: se sugieren como valores de la regla por nómina.
  const { data: tiposCredencial } = useSWR("tipos-credencial-disenador", () =>
    getTiposCredencialAction(),
  );
  const tiposExternos = (tiposCredencial ?? []).filter(
    (t) => t.activo && t.grupo !== "trabajador" && t.grupo !== "pasivo",
  );

  const anchoMm = plantilla?.ancho_mm || 54.0;
  const altoMm = plantilla?.alto_mm || 85.6;

  const editor = useDisenadorEditor({
    plantilla,
    anchoMm,
    altoMm,
  });

  const campoSeleccionadoMeta =
    editor.elementoSeleccionado?.t === "field"
      ? camposDisponibles.find((c) => c.codigo === editor.elementoSeleccionado?.field) || null
      : null;

  // Guardar Borrador en Backend
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
      );

      const res = await actualizarPlantillaBorradorAction(plantilla.id, {
        definicion,
      });

      if (res.success) {
        toast.success("Definición de plantilla guardada exitosamente.");
        mutatePlantilla();
      } else {
        toast.error(res.error || "No se pudo guardar la plantilla.");
      }
    });
  };

  return (
    <PageLayout
      title={`Diseñador de Carnet: ${plantilla?.nombre || "Cargando..."}`}
      description="Editor visual paramétrico por capas en milímetros con soporte para doble cara y datos del expediente."
    >
      {/* Botones de Cabecera */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/carnetizacion/plantillas" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Volver a Plantillas
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={guardarBorrador}
          disabled={isPending}
          className="gap-1.5"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar Borrador
        </Button>
      </div>

      {/* Barra superior de herramientas y caras */}
      <DisenadorToolbar
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
        onCambiarEscala={editor.setEscala}
        modoPreviewReal={editor.modoPreviewReal}
        datosPersona={editor.datosPersona}
        cedulaBusqueda={editor.cedulaBusqueda}
        onCambiarCedulaBusqueda={editor.setCedulaBusqueda}
        buscandoCedula={editor.buscandoCedula}
        onBuscarPersonaReal={editor.handleBuscarPersonaReal}
        onRestaurarPersonaFicticia={editor.restaurarPersonaFicticia}
      />

      {/* Grid Principal del Diseñador */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* PANEL IZQUIERDO: Herramientas y Capas (3 columnas) */}
        <div className="lg:col-span-3 space-y-4">
          <DisenadorHerramientasPanel
            caraActual={editor.caraActual}
            camposDisponibles={camposDisponibles}
            onAnadirElemento={editor.anadirElemento}
            onAbrirBiblioteca={() => setModalBibliotecaOpen(true)}
          />

          <DisenadorCapasPanel
            caraActual={editor.caraActual}
            elementos={editor.elementos}
            elementoSeleccionadoId={editor.elementoSeleccionadoId}
            onSeleccionarElemento={editor.setElementoSeleccionadoId}
            onMoverCapa={editor.moverCapa}
            onActualizarElemento={editor.handleActualizarElemento}
          />
        </div>

        {/* CENTRO: Lienzo Konva Canvas (6 columnas) */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-muted/20 border rounded-xl min-h-[580px] overflow-auto">
          <div className="relative">
            <KonvaCanvasStage
              anchoMm={anchoMm}
              altoMm={altoMm}
              escala={editor.escala}
              elementos={editor.elementos}
              caraActual={editor.caraActual}
              seleccionIds={editor.seleccionIds}
              onSeleccionarElemento={editor.seleccionarElemento}
              onSeleccionarVarios={editor.seleccionarVarios}
              onActualizarElemento={editor.handleActualizarElemento}
              datosPersona={editor.datosPersona}
              coloresRegla={editor.coloresResueltos}
              mostrarGuias={editor.mostrarGuias}
              edicionPuntos={editor.edicionPuntos}
              onSeleccionarPunto={editor.seleccionarPunto}
              onMoverPunto={editor.moverPuntoEditado}
              onAgregarPunto={editor.agregarPuntoEditado}
            />
          </div>
          <span className="text-[11px] text-muted-foreground mt-4 font-mono">
            Dimensiones físicas: {anchoMm} × {altoMm} mm • Cara: {editor.caraActual}
          </span>
        </div>

        {/* PANEL DERECHO: Inspector de Propiedades y Reglas de Color (3 columnas) */}
        <div className="lg:col-span-3 space-y-3">
          {/* Selector de Pestaña del Inspector */}
          <div className="flex border bg-muted/20 p-1 rounded-lg gap-1">
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

          {editor.tabInspector === "colores" ? (
            <DisenadorReglasColorPanel
              reglasColor={editor.reglasColor}
              onActualizarReglasColor={editor.setReglasColor}
              nuevoValorNombre={editor.nuevoValorNombre}
              onCambiarNuevoValorNombre={editor.setNuevoValorNombre}
              tiposExternos={tiposExternos}
            />
          ) : editor.seleccionIds.length > 1 ? (
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
              }}
            />
          )}
        </div>
      </div>

      {/* MODAL SELECCIONAR MEDIO DE BIBLIOTECA */}
      <DisenadorBibliotecaDialog
        open={modalBibliotecaOpen}
        onOpenChange={setModalBibliotecaOpen}
        mediosBiblioteca={mediosBiblioteca}
        caraActual={editor.caraActual}
        onAnadirElemento={editor.anadirElemento}
      />
    </PageLayout>
  );
}
