import {
  type CambioEntity,
  type ItemBorrador,
  type SeccionCodigo,
  type ValorCambio,
} from "../entities/solicitud-actualizacion";
import { CAMPO_REGISTRO_NUEVO } from "../value-objects/campos-seccion";

/** Registro editado dentro del borrador: una modificación (campos cambiados) o un registro nuevo. */
export interface RegistroBorrador {
  seccion: SeccionCodigo;
  entidad: string;
  /** Identificador del registro modificado; `null` en registros únicos y en registros nuevos. */
  entidadId: string | null;
  accion: "MODIFICAR" | "CREAR";
  valores: Record<string, ValorCambio>;
}

/** La foto se gestiona por soportes: el servidor rechaza `seccion=foto` en el borrador. */
export function cambioAItem(cambio: CambioEntity): ItemBorrador | null {
  if (cambio.seccion === "foto") return null;
  return {
    seccion: cambio.seccion,
    entidad: cambio.entidadDestino,
    accion: cambio.accion,
    campo: cambio.campo,
    valor: cambio.valorPropuesto,
    entidadId: cambio.entidadId,
  };
}

export function cambiosAItems(cambios: CambioEntity[]): ItemBorrador[] {
  return cambios.map(cambioAItem).filter((i): i is ItemBorrador => i !== null);
}

function esObjeto(valor: ValorCambio): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

/** Agrupa los ítems en registros (MODIFICAR por entidad+id, un CREAR por registro nuevo). */
export function itemsARegistros(items: ItemBorrador[]): RegistroBorrador[] {
  const registros: RegistroBorrador[] = [];
  const indice = new Map<string, RegistroBorrador>();
  for (const item of items) {
    const seccion = item.seccion as SeccionCodigo;
    if (item.accion === "CREAR") {
      registros.push({
        seccion,
        entidad: item.entidad,
        entidadId: null,
        accion: "CREAR",
        valores: esObjeto(item.valor) ? ({ ...item.valor } as Record<string, ValorCambio>) : {},
      });
      continue;
    }
    const clave = `${item.seccion}|${item.entidad}|${item.entidadId ?? ""}`;
    let registro = indice.get(clave);
    if (!registro) {
      registro = {
        seccion,
        entidad: item.entidad,
        entidadId: item.entidadId ?? null,
        accion: "MODIFICAR",
        valores: {},
      };
      indice.set(clave, registro);
      registros.push(registro);
    }
    registro.valores[item.campo] = item.valor;
  }
  return registros;
}

export function registrosAItems(registros: RegistroBorrador[]): ItemBorrador[] {
  return registros.flatMap<ItemBorrador>((r) => {
    if (r.accion === "CREAR") {
      return [
        {
          seccion: r.seccion,
          entidad: r.entidad,
          accion: "CREAR",
          campo: CAMPO_REGISTRO_NUEVO,
          valor: r.valores,
        },
      ];
    }
    return Object.entries(r.valores).map<ItemBorrador>(([campo, valor]) => ({
      seccion: r.seccion,
      entidad: r.entidad,
      accion: "MODIFICAR",
      campo,
      valor,
      entidadId: r.entidadId,
    }));
  });
}

/** Normaliza para comparar: vacío, `undefined` y `null` son lo mismo. */
export function normalizarValor(valor: unknown): ValorCambio {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "string") return valor.trim() === "" ? null : valor.trim();
  return valor as ValorCambio;
}

/** Solo los campos que realmente difieren del valor vigente en la ficha. */
export function diferencias(
  original: Record<string, unknown>,
  nuevos: Record<string, unknown>,
): Record<string, ValorCambio> {
  const cambios: Record<string, ValorCambio> = {};
  for (const [campo, valor] of Object.entries(nuevos)) {
    const nuevo = normalizarValor(valor);
    if (nuevo !== normalizarValor(original[campo])) cambios[campo] = nuevo;
  }
  return cambios;
}

/** Reemplaza en el borrador los registros de una sección+entidad por los recibidos. */
export function reemplazarRegistrosDeEntidad(
  items: ItemBorrador[],
  seccion: SeccionCodigo,
  entidad: string,
  registros: RegistroBorrador[],
): ItemBorrador[] {
  const resto = items.filter((i) => !(i.seccion === seccion && i.entidad === entidad));
  return [...resto, ...registrosAItems(registros)];
}
