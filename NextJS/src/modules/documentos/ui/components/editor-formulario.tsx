"use client";

import { useMemo, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Bloque,
  DefinicionFormulario,
  TipoBloque,
} from "../../domain/entities/plantilla";
import {
  actualizarBloque,
  duplicarBloque,
  eliminarBloque,
  insertarBloque,
  moverBloque,
  reordenarBloques,
} from "../../domain/lib/bloques";
import { nuevoBloque } from "../../domain/lib/factorias";
import { ubicarError, type UbicacionError } from "../../domain/lib/errores";
import type { useEditorPlantilla } from "../hooks/use-editor-plantilla";
import type { DisposicionEditor } from "../hooks/use-media-query";
import type { EntornoEditor } from "../lib/entorno";
import { AjustesDocumento } from "./ajustes-documento";
import { CamposPropiosEditor } from "./campos-propios-editor";
import { ListaBloques } from "./lista-bloques";
import { PaletaBloques } from "./paleta-bloques";
import { PanelInferior } from "./panel-inferior";
import { PropiedadesBloque } from "./propiedades-bloque";
import { ResumenErrores } from "./resumen-errores";
import { VistaPreviaPdf } from "./vista-previa-pdf";

interface Props {
  editor: ReturnType<typeof useEditorPlantilla>;
  entorno: EntornoEditor;
  disposicion: DisposicionEditor;
  plantillaId: string;
  payload: Record<string, unknown> | null;
  maxBytesLogo?: number;
}

/** Editor del modo «formulario propio»: ajustes + paleta + lista ordenable + propiedades + vista previa. */
export function EditorFormulario({ editor, entorno, disposicion, plantillaId, payload, maxBytesLogo }: Props) {
  const { borrador } = editor;
  const definicion = borrador!.definicion as DefinicionFormulario;
  const ro = entorno.soloLectura;
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [tabIzq, setTabIzq] = useState("bloques");
  const [tabMovil, setTabMovil] = useState("diseno");

  const bloques = definicion.bloques;
  const seleccionado = bloques.find((b) => b.id === seleccionId) ?? null;
  const indiceSel = seleccionado ? bloques.indexOf(seleccionado) : -1;

  const cambiarBloques = (fn: (l: Bloque[]) => Bloque[]) =>
    editor.cambiarDefinicion<DefinicionFormulario>((d) => ({ ...d, bloques: fn(d.bloques) }));

  const conErrorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of editor.errores) {
      const u = ubicarError(e.ruta, "formulario", definicion);
      if (u.bloqueId) ids.add(u.bloqueId);
    }
    return ids;
  }, [editor.errores, definicion]);

  const agregar = (tipo: TipoBloque) => {
    const nuevo = nuevoBloque(tipo, bloques, entorno.catalogo);
    cambiarBloques((l) => insertarBloque(l, nuevo, seleccionId));
    setSeleccionId(nuevo.id);
    setTabIzq("bloques");
  };

  const ir = (u: UbicacionError) => {
    if (u.bloqueId) {
      setSeleccionId(u.bloqueId);
      setTabIzq("bloques");
      setTabMovil("diseno");
      requestAnimationFrame(() =>
        document.querySelector(`[data-bloque-id="${u.bloqueId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
    } else if (u.campoPropioIdx !== undefined) setTabIzq("propios");
    else if (u.ajustes) setTabIzq("documento");
  };

  const propiedades = seleccionado ? (
    <PropiedadesBloque
      key={seleccionado.id}
      bloque={seleccionado}
      indice={indiceSel}
      entorno={entorno}
      onCambio={(c) => cambiarBloques((l) => actualizarBloque(l, seleccionado.id, c))}
    />
  ) : (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      Seleccione un bloque de la lista para editar sus propiedades.
    </p>
  );

  const columnaDiseno = (
    <Tabs value={tabIzq} onValueChange={setTabIzq} className="min-w-0">
      <TabsList className="w-full">
        <TabsTrigger value="bloques">Bloques</TabsTrigger>
        <TabsTrigger value="documento">Documento</TabsTrigger>
        <TabsTrigger value="propios">Campos propios</TabsTrigger>
      </TabsList>
      <TabsContent value="bloques" className="grid gap-4">
        <ResumenErrores errores={editor.errores} modo="formulario" definicion={definicion} onIr={ir} />
        {!ro && <PaletaBloques onAgregar={agregar} haySeleccion={seleccionado !== null} />}
        <section aria-labelledby="titulo-lista" className="grid gap-2">
          <h3 id="titulo-lista" className="font-semibold">Bloques del documento ({bloques.length})</h3>
          <ListaBloques
            bloques={bloques}
            seleccionadoId={seleccionId}
            conErrorIds={conErrorIds}
            soloLectura={ro}
            onSeleccionar={setSeleccionId}
            onReordenar={(desde, hacia) => cambiarBloques((l) => reordenarBloques(l, desde, hacia))}
            onMover={(id, d) => cambiarBloques((l) => moverBloque(l, id, d))}
            onDuplicar={(id) => {
              const r = duplicarBloque(bloques, id);
              cambiarBloques(() => r.lista);
              if (r.nuevoId) setSeleccionId(r.nuevoId);
            }}
            onEliminar={(id) => {
              cambiarBloques((l) => eliminarBloque(l, id));
              if (id === seleccionId) setSeleccionId(null);
            }}
          />
        </section>
      </TabsContent>
      <TabsContent value="documento">
        <AjustesDocumento
          definicion={definicion}
          onCambio={(fn) => editor.cambiarDefinicion<DefinicionFormulario>(fn)}
          onSubirLogo={editor.subirLogo}
          subiendo={editor.ocupado === "subiendo"}
          progreso={editor.progresoSubida}
          entorno={entorno}
          maxBytesLogo={maxBytesLogo}
        />
      </TabsContent>
      <TabsContent value="propios">
        <CamposPropiosEditor campos={borrador!.campos_propios} onCambio={editor.cambiarCamposPropios} entorno={entorno} />
      </TabsContent>
    </Tabs>
  );

  const vista = <VistaPreviaPdf plantillaId={plantillaId} payload={payload} className="h-full" altoClase="min-h-[32rem] flex-1" />;

  if (disposicion === "ancho") {
    return (
      <div className="grid grid-cols-[22rem_minmax(20rem,26rem)_minmax(0,1fr)] gap-4 p-4">
        <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto pr-1">{columnaDiseno}</div>
        <aside aria-label="Propiedades del bloque" className="max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-xl border bg-background p-4">
          {propiedades}
        </aside>
        <div className="sticky top-20 h-[calc(100dvh-9rem)]">{vista}</div>
      </div>
    );
  }

  if (disposicion === "medio") {
    return (
      <>
        <div className="grid grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)] gap-4 p-4">
          <div className="min-w-0">{columnaDiseno}</div>
          <div className="sticky top-20 h-[calc(100dvh-14rem)]">{vista}</div>
        </div>
        {seleccionado && (
          <PanelInferior titulo={`Propiedades del bloque ${indiceSel + 1}`} onCerrar={() => setSeleccionId(null)}>
            {propiedades}
          </PanelInferior>
        )}
      </>
    );
  }

  return (
    <>
      <Tabs value={tabMovil} onValueChange={setTabMovil} className="p-3">
        <TabsList className="w-full">
          <TabsTrigger value="diseno">Diseño</TabsTrigger>
          <TabsTrigger value="vista">Vista previa</TabsTrigger>
        </TabsList>
        <TabsContent value="diseno">{columnaDiseno}</TabsContent>
        <TabsContent value="vista" className="flex min-h-[70dvh] flex-col">
          {vista}
        </TabsContent>
      </Tabs>
      {seleccionado && tabMovil === "diseno" && (
        <PanelInferior titulo={`Propiedades del bloque ${indiceSel + 1}`} onCerrar={() => setSeleccionId(null)}>
          {propiedades}
        </PanelInferior>
      )}
    </>
  );
}
