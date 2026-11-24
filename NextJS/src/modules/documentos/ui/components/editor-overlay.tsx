"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon, SquareCheckBig, Table2, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CampoOverlay,
  DefinicionOverlay,
  GeometriaCampo,
  TipoCampoOverlay,
} from "../../domain/entities/plantilla";
import {
  actualizarCampoEnPagina,
  agregarCampo,
  agregarPaginaOrigen,
  duplicarCampo,
  duplicarPagina,
  eliminarCampo,
  moverPagina,
  quitarPagina,
} from "../../domain/lib/bloques";
import { ubicarError, type UbicacionError } from "../../domain/lib/errores";
import { ETIQUETAS_CAMPO_OVERLAY, nuevoCampoOverlay } from "../../domain/lib/factorias";
import { limitarCampoALaPagina } from "../../domain/lib/lienzo";
import type { useEditorPlantilla } from "../hooks/use-editor-plantilla";
import type { DisposicionEditor } from "../hooks/use-media-query";
import type { EntornoEditor } from "../lib/entorno";
import { urlPaginaFondo } from "../lib/subir-archivo";
import { CamposPropiosEditor } from "./campos-propios-editor";
import { LienzoOverlay } from "./lienzo-overlay";
import { MiniaturasPaginas } from "./miniaturas-paginas";
import { PanelInferior } from "./panel-inferior";
import { PropiedadesCampo } from "./propiedades-campo";
import { ResumenErrores } from "./resumen-errores";
import { VistaPreviaPdf } from "./vista-previa-pdf";
import { ZonaSubidaPdf } from "./zona-subida-pdf";

interface Props {
  editor: ReturnType<typeof useEditorPlantilla>;
  entorno: EntornoEditor;
  disposicion: DisposicionEditor;
  plantillaId: string;
  payload: Record<string, unknown> | null;
  maxBytesFondo?: number;
}

const ICONOS_CAMPO: Record<TipoCampoOverlay, typeof Type> = {
  texto: Type,
  casilla: SquareCheckBig,
  foto: ImageIcon,
  tabla: Table2,
};

/** Editor del modo «formato de terceros»: PDF de fondo, páginas, lienzo con campos y vista previa. */
export function EditorOverlay({
  editor,
  entorno,
  disposicion,
  plantillaId,
  payload,
  maxBytesFondo,
}: Props) {
  const { borrador, servidor } = editor;
  const definicion = borrador!.definicion as DefinicionOverlay;
  const fondoPaginas = servidor!.fondo_paginas ?? [];
  const ro = entorno.soloLectura;
  const [paginaSel, setPaginaSel] = useState(0);
  const [campoId, setCampoId] = useState<string | null>(null);
  const [tabDer, setTabDer] = useState("propiedades");
  const [tabMovil, setTabMovil] = useState("diseno");
  const [tabExtra, setTabExtra] = useState("pdf");

  const paginaIdx = Math.min(paginaSel, Math.max(0, definicion.paginas.length - 1));
  const paginaDoc = definicion.paginas[paginaIdx];
  const dim = paginaDoc ? fondoPaginas.find((f) => f.numero === paginaDoc.origen) : undefined;
  const campo = paginaDoc?.campos.find((c) => c.id === campoId) ?? null;
  const campoIdx = campo && paginaDoc ? paginaDoc.campos.indexOf(campo) : -1;
  const version = `${servidor!.fondo_nombre ?? ""}-${editor.versionFondo}`;

  const cambiarDef = (fn: (d: DefinicionOverlay) => DefinicionOverlay) =>
    editor.cambiarDefinicion<DefinicionOverlay>(fn);

  const { conErrorIds, conErrorPaginas } = useMemo(() => {
    const ids = new Set<string>();
    const paginas = new Set<number>();
    for (const e of editor.errores) {
      const u = ubicarError(e.ruta, "pdf_overlay", definicion);
      if (u.campoId && u.paginaIdx === paginaIdx) ids.add(u.campoId);
      if (u.paginaIdx !== undefined) paginas.add(u.paginaIdx);
    }
    return { conErrorIds: ids, conErrorPaginas: paginas };
  }, [editor.errores, definicion, paginaIdx]);

  const agregar = (tipo: TipoCampoOverlay) => {
    if (!paginaDoc || !dim) return;
    const todos = definicion.paginas.flatMap((p) => p.campos);
    const desplazo = (paginaDoc.campos.length % 10) * 5;
    const base = nuevoCampoOverlay(
      tipo,
      todos,
      { x: 20 + desplazo, y: 20 + desplazo },
      entorno.catalogo,
    );
    const nuevo = limitarCampoALaPagina(base, dim) as CampoOverlay;
    cambiarDef((d) => agregarCampo(d, paginaIdx, nuevo));
    setCampoId(nuevo.id);
    setTabDer("propiedades");
  };

  const ir = (u: UbicacionError) => {
    if (u.paginaIdx !== undefined) setPaginaSel(u.paginaIdx);
    if (u.campoId) {
      setCampoId(u.campoId);
      setTabDer("propiedades");
      setTabMovil("diseno");
    } else if (u.campoPropioIdx !== undefined) {
      setTabDer("propios");
      setTabExtra("propios");
    }
  };

  const subida = (
    <ZonaSubidaPdf
      nombreActual={servidor!.fondo_nombre}
      numPaginas={fondoPaginas.length}
      subiendo={editor.ocupado === "subiendo"}
      progreso={editor.progresoSubida}
      maxBytes={maxBytesFondo}
      soloLectura={ro}
      onSubir={editor.subirFondo}
    />
  );

  const propios = (
    <CamposPropiosEditor
      campos={borrador!.campos_propios}
      onCambio={editor.cambiarCamposPropios}
      entorno={entorno}
    />
  );

  const propiedades =
    campo && paginaDoc && dim ? (
      <PropiedadesCampo
        key={campo.id}
        campo={campo}
        ruta={`paginas.${paginaIdx}.campos.${campoIdx}`}
        pagina={dim}
        entorno={entorno}
        onCambio={(c) => cambiarDef((d) => actualizarCampoEnPagina(d, paginaIdx, campo.id, c))}
        onDuplicar={() => {
          const r = duplicarCampo(definicion, paginaIdx, campo.id);
          cambiarDef(() => r.definicion);
          if (r.nuevoId) setCampoId(r.nuevoId);
        }}
        onEliminar={() => {
          cambiarDef((d) => eliminarCampo(d, paginaIdx, campo.id));
          setCampoId(null);
        }}
      />
    ) : (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Seleccione un campo en la página para editar sus propiedades, o agregue uno con la barra de
        herramientas.
      </p>
    );

  const vista = (
    <VistaPreviaPdf
      plantillaId={plantillaId}
      payload={payload}
      className="h-full"
      altoClase="min-h-[32rem] flex-1"
    />
  );

  const herramientas = (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Agregar campo">
      {(Object.keys(ETIQUETAS_CAMPO_OVERLAY) as TipoCampoOverlay[]).map((t) => {
        const Icono = ICONOS_CAMPO[t];
        return (
          <Button
            key={t}
            type="button"
            size="sm"
            variant="outline"
            disabled={ro || !paginaDoc || !dim}
            onClick={() => agregar(t)}
          >
            <Icono aria-hidden /> {ETIQUETAS_CAMPO_OVERLAY[t]}
          </Button>
        );
      })}
    </div>
  );

  const zonaDiseno = (
    <div className="grid min-w-0 gap-4">
      {fondoPaginas.length === 0 ? (
        <div className="mx-auto w-full max-w-xl pt-4">
          {subida}
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Primero suba el PDF del formato oficial; después elegirá sus páginas y colocará los
            datos encima.
          </p>
        </div>
      ) : (
        <>
          <ResumenErrores
            errores={editor.errores}
            modo="pdf_overlay"
            definicion={definicion}
            onIr={ir}
          />
          <div
            className={
              disposicion === "movil"
                ? "grid min-w-0 gap-3"
                : "grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-3"
            }
          >
            <div
              className={
                disposicion === "movil"
                  ? "min-w-0"
                  : "sticky top-20 max-h-[calc(100dvh-7rem)] min-w-0 overflow-y-auto overflow-x-hidden rounded-lg border bg-background p-2"
              }
            >
              <MiniaturasPaginas
                plantillaId={plantillaId}
                version={version}
                fondoPaginas={fondoPaginas}
                paginasDoc={definicion.paginas}
                paginaIdx={paginaIdx}
                conErrorPaginas={conErrorPaginas}
                soloLectura={ro}
                orientacion={disposicion === "movil" ? "horizontal" : "vertical"}
                onSeleccionar={(i) => {
                  setPaginaSel(i);
                  setCampoId(null);
                }}
                onAgregar={(origen) => {
                  cambiarDef((d) => agregarPaginaOrigen(d, origen));
                  setPaginaSel(definicion.paginas.length);
                  setCampoId(null);
                }}
                onQuitar={(i) => {
                  cambiarDef((d) => quitarPagina(d, i));
                  setPaginaSel(Math.max(0, i - 1));
                  setCampoId(null);
                }}
                onMover={(i, delta) => {
                  cambiarDef((d) => moverPagina(d, i, delta));
                  setPaginaSel(i + delta);
                }}
                onDuplicar={(i) => {
                  cambiarDef((d) => duplicarPagina(d, i));
                  setPaginaSel(i + 1);
                  setCampoId(null);
                }}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              {paginaDoc && dim ? (
                <>
                  {!ro && herramientas}
                  <LienzoOverlay
                    pagina={dim}
                    imagenUrl={urlPaginaFondo(plantillaId, paginaDoc.origen, version)}
                    campos={paginaDoc.campos}
                    seleccionadoId={campoId}
                    conErrorIds={conErrorIds}
                    soloLectura={ro}
                    onSeleccionar={setCampoId}
                    onCambiarGeometria={(id, g: GeometriaCampo) =>
                      cambiarDef((d) => actualizarCampoEnPagina(d, paginaIdx, id, g))
                    }
                    onEliminar={(id) => {
                      cambiarDef((d) => eliminarCampo(d, paginaIdx, id));
                      setCampoId(null);
                    }}
                  />
                </>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {paginaDoc
                    ? "La página elegida ya no existe en el PDF de fondo; quítela o suba otro PDF."
                    : "Agregue una página del PDF para empezar."}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (disposicion !== "movil") {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] gap-4 p-4">
        <div className="min-w-0">{zonaDiseno}</div>
        <aside
          aria-label="Panel lateral"
          className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border bg-background p-3"
        >
          <Tabs value={tabDer} onValueChange={setTabDer}>
            <TabsList className="w-full">
              <TabsTrigger value="propiedades">Campo</TabsTrigger>
              <TabsTrigger value="vista">Vista previa</TabsTrigger>
              <TabsTrigger value="pdf">PDF</TabsTrigger>
              <TabsTrigger value="propios">Propios</TabsTrigger>
            </TabsList>
            <TabsContent value="propiedades">{propiedades}</TabsContent>
            <TabsContent value="vista" className="flex h-[calc(100dvh-12rem)] flex-col">
              {vista}
            </TabsContent>
            <TabsContent value="pdf">{subida}</TabsContent>
            <TabsContent value="propios">{propios}</TabsContent>
          </Tabs>
        </aside>
      </div>
    );
  }

  return (
    <>
      <Tabs value={tabMovil} onValueChange={setTabMovil} className="p-3">
        <TabsList className="w-full">
          <TabsTrigger value="diseno">Diseño</TabsTrigger>
          <TabsTrigger value="vista">Vista previa</TabsTrigger>
        </TabsList>
        <TabsContent value="diseno" className="grid gap-4">
          {zonaDiseno}
          {fondoPaginas.length > 0 && (
            <Tabs value={tabExtra} onValueChange={setTabExtra}>
              <TabsList className="w-full">
                <TabsTrigger value="pdf">PDF de fondo</TabsTrigger>
                <TabsTrigger value="propios">Campos propios</TabsTrigger>
              </TabsList>
              <TabsContent value="pdf">{subida}</TabsContent>
              <TabsContent value="propios">{propios}</TabsContent>
            </Tabs>
          )}
        </TabsContent>
        <TabsContent value="vista" className="flex min-h-[70dvh] flex-col">
          {vista}
        </TabsContent>
      </Tabs>
      {campo && tabMovil === "diseno" && (
        <PanelInferior
          titulo={`Propiedades: ${ETIQUETAS_CAMPO_OVERLAY[campo.tipo]}`}
          onCerrar={() => setCampoId(null)}
        >
          {propiedades}
        </PanelInferior>
      )}
    </>
  );
}
