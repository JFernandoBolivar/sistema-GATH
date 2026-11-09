/**
 * Marca en rojo los campos que el backend rechazó (QA 2026-11-04).
 *
 * El backend devuelve `data.errores` con la ruta de cada dato que falló, en el
 * nombre del API (snake_case, listas con índice): `{ "cedula": ["..."],
 * "contacto_emergencia.0.telefono": ["..."] }`. Esta función los lleva a
 * `form.setError` del formulario (react-hook-form), así el `FormMessage` del
 * campo muestra el mensaje y el control queda con borde rojo (`aria-invalid`).
 *
 * - `mapa` traduce nombres del API a nombres del formulario cuando difieren
 *   (`{ cedulaidentidad: "cedula" }`). Para rutas con índice basta mapear el
 *   prefijo: `{ contacto_emergencia: "contactos" }`.
 * - Sin mapa, se prueba el nombre tal cual y su versión camelCase.
 * - Enfoca el primer campo con error.
 * - Devuelve los mensajes que no se pudieron ubicar en ningún campo, para
 *   mostrarlos en el aviso general.
 */
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

const aCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function traducir(ruta: string, mapa: Record<string, string>): string {
  if (mapa[ruta]) return mapa[ruta];
  // Prefijo mapeado: "contacto_emergencia.0.telefono" con { contacto_emergencia: "contactos" }.
  const partes = ruta.split(".");
  for (let i = partes.length - 1; i > 0; i--) {
    const prefijo = partes.slice(0, i).join(".");
    if (mapa[prefijo]) return [mapa[prefijo], ...partes.slice(i).map((p) => mapa[p] ?? p)].join(".");
  }
  return ruta;
}

function existe<T extends FieldValues>(form: UseFormReturn<T>, nombre: string): boolean {
  // Un campo opcional puede valer `undefined` y aun así estar montado en el formulario.
  const montados = (form.control as unknown as { _names?: { mount?: Set<string> } })._names?.mount;
  if (montados?.has(nombre)) return true;
  try {
    return form.getValues(nombre as Path<T>) !== undefined;
  } catch {
    return false;
  }
}

export function aplicarErroresServidor<T extends FieldValues>(
  form: UseFormReturn<T>,
  errores: Record<string, string[]> | undefined | null,
  mapa: Record<string, string> = {},
): string[] {
  if (!errores) return [];
  const sinUbicar: string[] = [];
  let primero = true;
  for (const [ruta, mensajes] of Object.entries(errores)) {
    const mensaje = (mensajes ?? []).filter(Boolean).join(" ");
    if (!mensaje) continue;
    const traducida = traducir(ruta, mapa);
    const candidatos = [traducida, aCamel(traducida), ruta, aCamel(ruta)];
    const nombre = candidatos.find((c) => existe(form, c));
    if (!nombre) {
      sinUbicar.push(mensaje);
      continue;
    }
    form.setError(nombre as Path<T>, { type: "server", message: mensaje }, { shouldFocus: primero });
    primero = false;
  }
  return sinUbicar;
}
