"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRutaDocumentos } from "../hooks/use-ruta-documentos";
import { erroresPorRuta } from "../../domain/lib/errores";
import { BarraEditor } from "../components/barra-editor";
import { EditorFormulario } from "../components/editor-formulario";
import { EditorOverlay } from "../components/editor-overlay";
import { HistorialVersionesDialog } from "../components/historial-versiones-dialog";
import { MetadatosDialog } from "../components/metadatos-dialog";
import { useAvisoCambios } from "../hooks/use-aviso-cambios";
import { usePlantilla, useVariables } from "../hooks/use-documentos-datos";
import { useEditorPlantilla } from "../hooks/use-editor-plantilla";
import { useDisposicionEditor } from "../hooks/use-media-query";
import { usePermisosDocumentos } from "../hooks/use-permisos-documentos";
import { crearEntorno } from "../lib/entorno";

type Confirmacion = "publicar" | "activar" | "duplicar" | null;

export function EditorPlantillaView({ id }: { id: string }) {
  const RUTA_DOCUMENTOS = useRutaDocumentos();
  const router = useRouter();
  const { plantilla, cargando, error, status } = usePlantilla(id);
  const { catalogo, error: errorCatalogo } = useVariables();
  const { puedeGestionar } = usePermisosDocumentos();
  const { ref: refEditor, disposicion } = useDisposicionEditor();
  const editor = useEditorPlantilla({ plantilla, catalogo });
  const [confirmando, setConfirmando] = useState<Confirmacion>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [verMeta, setVerMeta] = useState(false);

  useAvisoCambios(editor.dirty);

  // Ctrl+S guarda el borrador (solo si hay cambios y permiso).
  const { guardar, dirty } = editor;
  useEffect(() => {
    if (!puedeGestionar) return;
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void guardar();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [puedeGestionar, dirty, guardar]);

  const erroresRuta = useMemo(() => erroresPorRuta(editor.errores), [editor.errores]);
  const entorno = useMemo(
    () => crearEntorno(catalogo, editor.borrador?.campos_propios ?? [], erroresRuta, !puedeGestionar),
    [catalogo, editor.borrador?.campos_propios, erroresRuta, puedeGestionar],
  );
  const payload = useMemo(
    () => (editor.borrador ? { definicion: editor.borrador.definicion, campos_propios: editor.borrador.campos_propios } : null),
    [editor.borrador],
  );

  if (error || errorCatalogo) {
    return (
      <div className="mx-auto grid max-w-lg gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold">{status === 404 ? "La plantilla no existe" : "No se pudo abrir la plantilla"}</h1>
        <p className="text-sm text-muted-foreground">{error ?? errorCatalogo}</p>
        <Button asChild className="mx-auto">
          <Link href={RUTA_DOCUMENTOS}>Volver a la lista</Link>
        </Button>
      </div>
    );
  }

  if (cargando || !editor.listo || !catalogo || !editor.borrador || !editor.servidor) {
    return (
      <div className="grid gap-4 p-4" aria-busy="true" aria-label="Cargando el editor">
        <Skeleton className="h-14 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[60dvh]" />
          <Skeleton className="h-[60dvh]" />
        </div>
      </div>
    );
  }

  const { borrador, servidor } = editor;

  const ejecutarConfirmacion = async () => {
    const accion = confirmando;
    setConfirmando(null);
    if (accion === "publicar") await editor.publicar();
    if (accion === "activar") await editor.activar(!servidor.activa);
    if (accion === "duplicar") {
      const nueva = await editor.duplicar();
      if (nueva) router.push(`${RUTA_DOCUMENTOS}/${nueva.id}`);
    }
  };

  return (
    <div ref={refEditor} className="min-h-[calc(100dvh-5rem)] min-w-0 bg-muted/30">
      <BarraEditor
        nombre={borrador.nombre}
        servidor={servidor}
        dirty={editor.dirty}
        ocupado={editor.ocupado}
        puedeGestionar={puedeGestionar}
        onGuardar={() => void editor.guardar()}
        onPublicar={() => setConfirmando("publicar")}
        onActivar={() => setConfirmando("activar")}
        onDuplicar={() => (editor.dirty ? setConfirmando("duplicar") : void ejecutarDuplicar())}
        onHistorial={() => setVerHistorial(true)}
        onMetadatos={() => setVerMeta(true)}
      />

      {!puedeGestionar && (
        <p role="status" className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Tiene permiso de consulta: puede ver la plantilla y su vista previa, pero no modificarla.
        </p>
      )}

      {servidor.modo === "formulario" ? (
        <EditorFormulario editor={editor} entorno={entorno} disposicion={disposicion} plantillaId={servidor.id} payload={payload} maxBytesLogo={catalogo.limites.max_bytes_logo} />
      ) : (
        <EditorOverlay editor={editor} entorno={entorno} disposicion={disposicion} plantillaId={servidor.id} payload={payload} maxBytesFondo={catalogo.limites.max_bytes_fondo} />
      )}

      <MetadatosDialog
        abierto={verMeta}
        onCerrar={() => setVerMeta(false)}
        borrador={borrador}
        publicada={editor.publicada}
        soloLectura={!puedeGestionar}
        errores={erroresRuta}
        onCambio={editor.cambiarMeta}
      />
      <HistorialVersionesDialog plantillaId={servidor.id} abierto={verHistorial} onCerrar={() => setVerHistorial(false)} ultimaVersion={servidor.ultima_version} />

      <AlertDialog open={confirmando !== null} onOpenChange={(v) => !v && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmando === "publicar" && "Publicar una versión nueva"}
              {confirmando === "activar" && (servidor.activa ? "Desactivar plantilla" : "Activar plantilla")}
              {confirmando === "duplicar" && "Duplicar con cambios sin guardar"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando === "publicar" &&
                `Se creará la versión ${(servidor.ultima_version ?? 0) + 1}, que no se podrá modificar y será la que use el sistema.${editor.dirty ? " Tiene cambios sin guardar: se guardarán antes de publicar." : ""}`}
              {confirmando === "activar" &&
                (servidor.activa
                  ? "La plantilla dejará de ofrecerse para generar documentos nuevos."
                  : "La plantilla se usará para generar documentos nuevos con su última versión publicada.")}
              {confirmando === "duplicar" && "Se duplica lo que está guardado; los cambios sin guardar no se copian y se mantienen aquí."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void ejecutarConfirmacion()}>
              {confirmando === "publicar" ? "Publicar" : confirmando === "activar" ? (servidor.activa ? "Desactivar" : "Activar") : "Duplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  async function ejecutarDuplicar() {
    const nueva = await editor.duplicar();
    if (nueva) router.push(`${RUTA_DOCUMENTOS}/${nueva.id}`);
  }
}
