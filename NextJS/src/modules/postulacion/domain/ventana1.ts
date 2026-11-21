/**
 * Formulario de la Ventana 1 (datos básicos del postulante). Espejo de
 * `domain/services/datos_ventana.py` del backend: las claves desconocidas se rechazan allí.
 */

export const OPCIONES_ESTADO_CIVIL = [
  "Soltero(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viudo(a)",
  "Unión estable de hecho",
] as const;

export const LIMITES_VENTANA1 = {
  nombres: 150,
  apellidos: 150,
  correo: 254,
  direccion: 300,
  contactoNombre: 150,
  contactoParentesco: 40,
} as const;

/** Campos que el backend exige para enviar la Ventana 1 (además de los nombres). */
export const CAMPOS_OBLIGATORIOS_ENVIO = ["fecha_nacimiento", "sexo"] as const;
export type CampoObligatorioEnvio = (typeof CAMPOS_OBLIGATORIOS_ENVIO)[number];

export const ETIQUETA_CAMPO: Record<string, string> = {
  nombres: "Nombres",
  apellidos: "Apellidos",
  fecha_nacimiento: "Fecha de nacimiento",
  sexo: "Sexo",
};

export interface ContactoEmergencia {
  nombre: string;
  telefono: string;
  parentesco: string;
}

/** Valores del formulario (todo texto; vacío = no informado). */
export interface ValoresVentana1 {
  nombres: string;
  apellidos: string;
  correo: string;
  telefonoMovil: string;
  fechaNacimiento: string;
  sexo: "" | "M" | "F";
  nacionalidad: "" | "V" | "E";
  estadoCivil: string;
  direccionHabitacion: string;
  telefonoAlterno: string;
  contactoEmergencia: ContactoEmergencia;
}

export const VALORES_VACIOS: ValoresVentana1 = {
  nombres: "",
  apellidos: "",
  correo: "",
  telefonoMovil: "",
  fechaNacimiento: "",
  sexo: "",
  nacionalidad: "",
  estadoCivil: "",
  direccionHabitacion: "",
  telefonoAlterno: "",
  contactoEmergencia: { nombre: "", telefono: "", parentesco: "" },
};

/** Claves del backend (`datos_ventana1`) → campo del formulario, para marcar errores del servidor. */
export const CAMPO_FORMULARIO_POR_CLAVE: Record<string, string> = {
  nombres: "nombres",
  apellidos: "apellidos",
  correo: "correo",
  telefono_movil: "telefonoMovil",
  "datos_ventana1.fecha_nacimiento": "fechaNacimiento",
  "datos_ventana1.sexo": "sexo",
  "datos_ventana1.nacionalidad": "nacionalidad",
  "datos_ventana1.estado_civil": "estadoCivil",
  "datos_ventana1.direccion_habitacion": "direccionHabitacion",
  "datos_ventana1.telefono_alterno": "telefonoAlterno",
  "datos_ventana1.contacto_emergencia": "contactoEmergencia.nombre",
  "datos_ventana1.contacto_emergencia.nombre": "contactoEmergencia.nombre",
  "datos_ventana1.contacto_emergencia.telefono": "contactoEmergencia.telefono",
  "datos_ventana1.contacto_emergencia.parentesco": "contactoEmergencia.parentesco",
};

/** Campos que aún faltan para poder enviar (los obligatorios del backend y los nombres). */
export function camposFaltantesParaEnviar(valores: ValoresVentana1): string[] {
  const faltan: string[] = [];
  if (!valores.nombres.trim()) faltan.push("nombres");
  if (!valores.apellidos.trim()) faltan.push("apellidos");
  if (!valores.fechaNacimiento.trim()) faltan.push("fecha_nacimiento");
  if (!valores.sexo) faltan.push("sexo");
  return faltan;
}

export interface CuerpoBorrador {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono_movil: string;
  datos_ventana1: Record<string, unknown>;
}

const recortado = (v: string) => v.trim().replace(/\s+/g, " ");

/**
 * Cuerpo del `PUT borrador/`. `datos_ventana1` REEMPLAZA lo guardado, así que se envía siempre
 * completo y sin claves vacías (un campo vacío equivale a no informado).
 */
export function construirCuerpoBorrador(valores: ValoresVentana1): CuerpoBorrador {
  const datos: Record<string, unknown> = {};
  const poner = (clave: string, valor: string) => {
    if (valor) datos[clave] = valor;
  };
  poner("fecha_nacimiento", valores.fechaNacimiento.trim());
  poner("sexo", valores.sexo);
  poner("nacionalidad", valores.nacionalidad);
  poner("estado_civil", recortado(valores.estadoCivil));
  poner("direccion_habitacion", recortado(valores.direccionHabitacion));
  poner("telefono_alterno", valores.telefonoAlterno.trim());

  const contacto: Record<string, string> = {};
  const c = valores.contactoEmergencia;
  if (recortado(c.nombre)) contacto.nombre = recortado(c.nombre);
  if (c.telefono.trim()) contacto.telefono = c.telefono.trim();
  if (recortado(c.parentesco)) contacto.parentesco = recortado(c.parentesco);
  if (Object.keys(contacto).length > 0) datos.contacto_emergencia = contacto;

  return {
    nombres: recortado(valores.nombres),
    apellidos: recortado(valores.apellidos),
    correo: valores.correo.trim(),
    telefono_movil: valores.telefonoMovil.trim(),
    datos_ventana1: datos,
  };
}

const aTexto = (v: unknown): string => (typeof v === "string" ? v : "");

/** Valores iniciales del formulario a partir de lo que ya hay guardado en el expediente. */
export function valoresDesdeExpediente(
  postulante: { nombres: string; apellidos: string; correo: string; telefonoMovil: string },
  datos: Record<string, unknown>,
): ValoresVentana1 {
  const contacto =
    datos.contacto_emergencia && typeof datos.contacto_emergencia === "object"
      ? (datos.contacto_emergencia as Record<string, unknown>)
      : {};
  const sexo = aTexto(datos.sexo);
  const nacionalidad = aTexto(datos.nacionalidad);
  return {
    nombres: postulante.nombres,
    apellidos: postulante.apellidos,
    correo: postulante.correo,
    telefonoMovil: postulante.telefonoMovil,
    fechaNacimiento: aTexto(datos.fecha_nacimiento),
    sexo: sexo === "M" || sexo === "F" ? sexo : "",
    nacionalidad: nacionalidad === "V" || nacionalidad === "E" ? nacionalidad : "",
    estadoCivil: aTexto(datos.estado_civil),
    direccionHabitacion: aTexto(datos.direccion_habitacion),
    telefonoAlterno: aTexto(datos.telefono_alterno),
    contactoEmergencia: {
      nombre: aTexto(contacto.nombre),
      telefono: aTexto(contacto.telefono),
      parentesco: aTexto(contacto.parentesco),
    },
  };
}
