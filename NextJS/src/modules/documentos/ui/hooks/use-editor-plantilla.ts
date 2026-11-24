"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  BorradorPlantilla,
  CampoPropio,
  CatalogoVariables,
  DefinicionDocumento,
  DefinicionFormulario,
  ErrorValidacion,
  PlantillaCompleta,
} from "../../domain/entities/plantilla";
import { firmaEstable, hayCambiosSinGuardar } from "../../domain/lib/cambios";
import { erroresDeServidor } from "../../domain/lib/errores";
import { validarBorrador } from "../../domain/lib/esquemas";
import { contextoDeVariables } from "../../domain/lib/variables";
import {
  activarPlantillaAction,
  duplicarPlantillaAction,
  guardarPlantillaAction,
  publicarPlantillaAction,
} from "../../infrastructure/actions/documentos-actions";
import { subirArchivo } from "../lib/subir-archivo";
import { estaPublicada } from "../lib/etiquetas";

/** Borrador editable a partir de la plantilla del servidor. */
export function borradorDesdePlantilla(p: PlantillaCompleta): BorradorPlantilla {
  return structuredClone({
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    momento: p.momento,
    firmante: p.firmante,
    requiere_firma_clic: p.requiere_firma_clic,
    definicion: p.definicion,
    campos_propios: p.campos_propios ?? [],
  });
}

interface Params {
  plantilla: PlantillaCompleta | null;
  catalogo: CatalogoVariables | null;
}

/**
 * Estado del editor de plantillas.
 *
 * REGLA: el borrador local se siembra SOLO cuando cambia `plantilla.id`. SWR puede
 * devolver un objeto nuevo con el mismo `id` (revalidación) y eso NO debe pisar
 * las ediciones sin guardar. Se hace durante el render (patrón de React para
 * ajustar estado cuando cambia una prop), sin efectos que dependan del objeto entero.
 */
export function useEditorPlantilla({ plantilla, catalogo }: Params) {
  const [idSembrado, setIdSembrado] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<BorradorPlantilla | null>(null);
  const [base, setBase] = useState<BorradorPlantilla | null>(null);
  const [servidor, setServidor] = useState<PlantillaCompleta | null>(null);
  const [erroresServidor, setErroresServidor] = useState<ErrorValidacion[]>([]);
  const [ocupado, setOcupado] = useState<null | "guardando" | "publicando" | "activando" | "duplicando" | "subiendo">(null);
  const [progresoSubida, setProgresoSubida] = useState<number | null>(null);
  /** Cambia al subir otro PDF de fondo: rompe la caché de las páginas PNG. */
  const [versionFondo, setVersionFondo] = useState(0);

  if (plantilla && plantilla.id !== idSembrado) {
    setIdSembrado(plantilla.id);
    const inicial = borradorDesdePlantilla(plantilla);
    setBorrador(inicial);
    setBase(structuredClone(inicial));
    setServidor(plantilla);
    setErroresServidor([]);
  }

  // Los manejadores asíncronos leen siempre lo último; se actualiza tras cada render confirmado.
  const borradorRef = useRef(borrador);
  const servidorRef = useRef(servidor);
  useEffect(() => {
    borradorRef.current = borrador;
    servidorRef.current = servidor;
  });

  const dirty = hayCambiosSinGuardar(borrador, base);
  const publicada = servidor ? estaPublicada(servidor) : false;

  /** Toda edición pasa por aquí: limpia los errores del servidor, que ya no aplican. */
  const cambiar = useCallback((fn: (b: BorradorPlantilla) => BorradorPlantilla) => {
    setBorrador((b) => (b ? fn(b) : b));
    setErroresServidor([]);
  }, []);

  const cambiarMeta = useCallback(
    (parcial: Partial<Omit<BorradorPlantilla, "definicion" | "campos_propios">>) => cambiar((b) => ({ ...b, ...parcial })),
    [cambiar],
  );
  const cambiarDefinicion = useCallback(
    <T extends DefinicionDocumento>(fn: (d: T) => T) =>
      cambiar((b) => ({ ...b, definicion: fn(b.definicion as T) })),
    [cambiar],
  );
  const cambiarCamposPropios = useCallback(
    (fn: (c: CampoPropio[]) => CampoPropio[]) => cambiar((b) => ({ ...b, campos_propios: fn(b.campos_propios) })),
    [cambiar],
  );

  const erroresLocales = useMemo<ErrorValidacion[]>(() => {
    if (!borrador || !servidor || !catalogo) return [];
    return validarBorrador(
      { modo: servidor.modo, definicion: borrador.definicion, campos_propios: borrador.campos_propios },
      contextoDeVariables(catalogo, borrador.campos_propios),
      servidor.fondo_paginas,
    );
  }, [borrador, servidor, catalogo]);

  const errores = useMemo(() => [...erroresServidor, ...erroresLocales], [erroresServidor, erroresLocales]);

  const guardar = useCallback(async (): Promise<boolean> => {
    const enviado = borradorRef.current;
    const actual = servidorRef.current;
    if (!enviado || !actual) return false;
    setOcupado("guardando");
    const { codigo, ...sinCodigo } = enviado;
    const cuerpo = estaPublicada(actual) ? sinCodigo : { codigo, ...sinCodigo };
    const r = await guardarPlantillaAction(actual.id, cuerpo);
    setOcupado(null);
    if (!r.success) {
      setErroresServidor(erroresDeServidor(r.errores));
      toast.error(r.error);
      return false;
    }
    const nuevoBase = borradorDesdePlantilla(r.data);
    setServidor(r.data);
    setBase(nuevoBase);
    // Si no se editó durante el guardado, el borrador adopta la forma normalizada del servidor.
    if (firmaEstable(borradorRef.current) === firmaEstable(enviado)) setBorrador(structuredClone(nuevoBase));
    setErroresServidor([]);
    toast.success("Borrador guardado.");
    return true;
  }, []);

  const publicar = useCallback(async (): Promise<boolean> => {
    const actual = servidorRef.current;
    if (!actual) return false;
    if (hayCambiosSinGuardar(borradorRef.current, base) && !(await guardar())) return false;
    setOcupado("publicando");
    const r = await publicarPlantillaAction(actual.id);
    setOcupado(null);
    if (!r.success) {
      setErroresServidor(erroresDeServidor(r.errores));
      toast.error(r.error);
      return false;
    }
    setServidor(r.data.plantilla);
    toast.success(`Versión ${r.data.version.numero} publicada.`);
    return true;
  }, [base, guardar]);

  const activar = useCallback(async (activa: boolean): Promise<boolean> => {
    const actual = servidorRef.current;
    if (!actual) return false;
    setOcupado("activando");
    const r = await activarPlantillaAction(actual.id, activa);
    setOcupado(null);
    if (!r.success) {
      toast.error(r.error);
      return false;
    }
    setServidor((s) => (s ? { ...s, activa: r.data.activa } : s));
    toast.success(activa ? "Plantilla activada." : "Plantilla desactivada.");
    return true;
  }, []);

  const duplicar = useCallback(async (): Promise<PlantillaCompleta | null> => {
    const actual = servidorRef.current;
    if (!actual) return null;
    setOcupado("duplicando");
    const r = await duplicarPlantillaAction(actual.id);
    setOcupado(null);
    if (!r.success) {
      toast.error(r.error);
      return null;
    }
    toast.success("Plantilla duplicada como borrador.");
    return r.data;
  }, []);

  /** Sube el logo: el servidor deja `encabezado.tipo = logo_propio`; se refleja en borrador y base sin tocar el resto. */
  const subirLogo = useCallback(async (archivo: File): Promise<boolean> => {
    const actual = servidorRef.current;
    if (!actual) return false;
    setOcupado("subiendo");
    setProgresoSubida(0);
    const r = await subirArchivo<PlantillaCompleta>(`/api/documentos/plantillas/${actual.id}/logo`, archivo, setProgresoSubida);
    setOcupado(null);
    setProgresoSubida(null);
    if (!r.ok || !r.data) {
      toast.error(r.message ?? "No se pudo subir el logo.");
      return false;
    }
    const enc = (r.data.definicion as DefinicionFormulario).encabezado;
    const aplicar = (b: BorradorPlantilla | null) =>
      b ? { ...b, definicion: { ...(b.definicion as DefinicionFormulario), encabezado: { ...(b.definicion as DefinicionFormulario).encabezado, tipo: enc.tipo, logo_clave: enc.logo_clave } } } : b;
    setBorrador(aplicar);
    setBase(aplicar);
    toast.success("Logo cargado.");
    return true;
  }, []);

  /** Sube el PDF de fondo: solo cambian las páginas del fondo; el borrador local no se toca. */
  const subirFondo = useCallback(async (archivo: File): Promise<boolean> => {
    const actual = servidorRef.current;
    if (!actual) return false;
    setOcupado("subiendo");
    setProgresoSubida(0);
    const r = await subirArchivo<PlantillaCompleta>(`/api/documentos/plantillas/${actual.id}/fondo`, archivo, setProgresoSubida);
    setOcupado(null);
    setProgresoSubida(null);
    if (!r.ok || !r.data) {
      toast.error(r.message ?? "No se pudo subir el PDF.");
      return false;
    }
    const nuevo = r.data;
    setServidor((s) =>
      s ? { ...s, tiene_fondo: true, fondo_nombre: nuevo.fondo_nombre, fondo_paginas: nuevo.fondo_paginas } : s,
    );
    setVersionFondo((v) => v + 1);
    toast.success(`PDF cargado: ${nuevo.fondo_paginas.length} página(s).`);
    return true;
  }, []);

  return {
    listo: borrador !== null && servidor !== null,
    borrador,
    servidor,
    dirty,
    publicada,
    ocupado,
    progresoSubida,
    versionFondo,
    errores,
    cambiarMeta,
    cambiarDefinicion,
    cambiarCamposPropios,
    guardar,
    publicar,
    activar,
    duplicar,
    subirLogo,
    subirFondo,
  };
}
