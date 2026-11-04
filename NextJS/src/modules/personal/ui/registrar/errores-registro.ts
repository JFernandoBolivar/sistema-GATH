/**
 * Errores del servidor en el registro multipaso (QA 2026-11-04).
 *
 * El backend responde con `data.errores` usando las rutas del API
 * (`cedula`, `contacto_emergencia.0.telefono`, `datos_vivienda.estado`...). Cada
 * paso del wizard es un formulario aparte con sus propios nombres, así que aquí
 * se traduce cada ruta al paso que la contiene y al nombre del campo en ese
 * formulario. El wizard vuelve al primer paso con errores y cada paso marca en
 * rojo sus campos al montarse (`useErroresDelPaso`).
 */
import { useEffect } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

export type ErroresServidor = Record<string, string[]>;

interface Destino {
  paso: number;
  campo: string;
}

/** Campos de primer nivel del paso 1 (nombre en el API -> nombre en el formulario). */
const PASO_1: Record<string, string> = {
  cedula: "cedulaidentidad",
  nombres: "nombres",
  apellidos: "apellidos",
  sexo_id: "sexoid",
  fecha_nacimiento: "fecha_nacimiento",
  estado_civil_id: "estadoCivil",
  nacionalidad_id: "nacionalidad_id",
  correo: "correo",
  telefono_movil: "telefono_movil",
  telefono_habitacion: "telefono_habitacion",
  carnet_patria: "carnet_patria",
  carnet_patria_serial: "carnet_patria_serial",
};

/** Listas: prefijo del API -> [paso, prefijo del formulario, hoja del API -> hoja del formulario]. */
const LISTAS: Record<string, { paso: number; prefijo: string; hojas: Record<string, string> }> = {
  contacto_emergencia: {
    paso: 0,
    prefijo: "contacto_emergencia",
    hojas: { relacion: "relacion_id" },
  },
  formacion_academica: {
    paso: 1,
    prefijo: "formacion_academica",
    hojas: {
      nivel_academico: "nivel_Academico_id",
      carrera: "carrera_id",
      mencion: "mencion_id",
      institucion: "institucion_id",
    },
  },
  formacion_complementaria: {
    paso: 2,
    prefijo: "formacion_complementaria",
    hojas: {
      capacitacion: "capacitacion_id",
      institucion: "institucion_id",
      procedencia: "procedencia_id",
      grupo: "grupo_id",
      fechaInicio: "fecha_inicio",
      fechaFin: "fecha_fin",
    },
  },
  antecedentes: {
    paso: 3,
    prefijo: "antecedentes",
    hojas: { organismo: "organismo_id" },
  },
};

/** Objetos anidados: prefijo del API -> [paso, prefijo del formulario, hoja del API -> hoja del formulario]. */
const OBJETOS: Record<string, { paso: number; prefijo: string; hojas: Record<string, string> }> = {
  perfil_salud: { paso: 4, prefijo: "perfil_salud", hojas: { grupo_sanguineo: "grupoSanguineo" } },
  perfil_fisico: { paso: 5, prefijo: "perfil_fisico", hojas: {} },
  datos_vivienda: {
    paso: 6,
    prefijo: "datos_vivienda",
    hojas: {
      estado: "estado_id",
      municipio: "municipio_id",
      condicion_vivienda: "condicion_vivienda_id",
      codigo_postal: "codigo_postal_id",
    },
  },
};

/** Paso y campo del formulario de una ruta del API; `null` si no corresponde a ningún campo del wizard. */
export function destinoDeRuta(ruta: string): Destino | null {
  const partes = ruta.split(".");
  const [raiz, ...resto] = partes;
  if (resto.length === 0 && PASO_1[raiz]) return { paso: 0, campo: PASO_1[raiz] };
  const lista = LISTAS[raiz];
  if (lista && resto.length >= 1) {
    const [indice, hoja] = resto;
    if (!/^\d+$/.test(indice)) return null;
    if (!hoja) return { paso: lista.paso, campo: `${lista.prefijo}.${indice}` };
    return { paso: lista.paso, campo: `${lista.prefijo}.${indice}.${lista.hojas[hoja] ?? hoja}` };
  }
  const objeto = OBJETOS[raiz];
  if (objeto && resto.length === 1) {
    return { paso: objeto.paso, campo: `${objeto.prefijo}.${objeto.hojas[resto[0]] ?? resto[0]}` };
  }
  return null;
}

/** Primer paso (el más bajo) que tiene errores, o `null` si ninguno se puede ubicar. */
export function primerPasoConErrores(errores: ErroresServidor | undefined | null): number | null {
  if (!errores) return null;
  const pasos = Object.keys(errores)
    .map((ruta) => destinoDeRuta(ruta)?.paso)
    .filter((p): p is number => p !== undefined);
  return pasos.length ? Math.min(...pasos) : null;
}

/** Mensajes de las rutas que no se pudieron ubicar en ningún campo (para el aviso general). */
export function erroresSinCampo(errores: ErroresServidor | undefined | null): string[] {
  if (!errores) return [];
  return Object.entries(errores)
    .filter(([ruta]) => destinoDeRuta(ruta) === null)
    .flatMap(([, mensajes]) => mensajes);
}

/** Marca en rojo los campos de `paso` y enfoca el primero. */
export function marcarErroresDelPaso<T extends FieldValues>(
  form: UseFormReturn<T>,
  errores: ErroresServidor | undefined | null,
  paso: number,
): void {
  if (!errores) return;
  let primero = true;
  for (const [ruta, mensajes] of Object.entries(errores)) {
    const destino = destinoDeRuta(ruta);
    if (!destino || destino.paso !== paso) continue;
    const mensaje = mensajes.filter(Boolean).join(" ");
    if (!mensaje) continue;
    form.setError(destino.campo as Path<T>, { type: "server", message: mensaje }, { shouldFocus: primero });
    primero = false;
  }
}

/** Efecto de cada paso: al montarse, marca los errores del servidor que le corresponden. */
export function useErroresDelPaso<T extends FieldValues>(
  form: UseFormReturn<T>,
  errores: ErroresServidor | undefined | null,
  paso: number,
): void {
  useEffect(() => {
    marcarErroresDelPaso(form, errores, paso);
    // Solo al montar el paso (el wizard lo vuelve a montar con cada intento fallido).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Aviso general del guardado fallido. */
export function avisarErrorDeRegistro(mensaje: string, errores: ErroresServidor | undefined | null) {
  const sinCampo = erroresSinCampo(errores);
  toast.error(sinCampo.length ? sinCampo.join(" ") : mensaje);
}
