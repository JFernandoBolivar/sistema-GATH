/**
 * Estilo del QR del carnet (`props.qr_estilo` del elemento QR en la definición de la
 * plantilla). Sin estilo equivale a «institucional». El backend normaliza y valida al
 * publicar (contraste WCAG >= 4,5, logo <= 24 %, ojos oscuros).
 */
export type PresetQr = "institucional" | "degradado" | "clasico" | "personalizado";
export type FormaModulosQr = "cuadrado" | "redondeado" | "puntos";

export const QR_LOGO_PCT_MIN = 15;
export const QR_LOGO_PCT_MAX = 24;

export interface QrEstiloLogo {
  activo: boolean;
  /** Id del medio de la Biblioteca (categoría Logos); null = logo de CONATEL. */
  medio_id: string | null;
  tamano_pct: number;
}

export interface QrEstilo {
  preset: PresetQr;
  forma_modulos: FormaModulosQr;
  color_modulos: string;
  color_modulos_2?: string | null;
  color_ojo_marco: string;
  color_ojo_centro: string;
  logo: QrEstiloLogo;
}

const AZUL_MARINO = "#1B2A4A";
const AZUL_LOGO = "#1264AA";
const ROJO = "#C8102E";

const LOGO_CONATEL: QrEstiloLogo = { activo: true, medio_id: null, tamano_pct: 23 };

export const PRESETS_QR: Record<Exclude<PresetQr, "personalizado">, QrEstilo> = {
  institucional: {
    preset: "institucional",
    forma_modulos: "redondeado",
    color_modulos: AZUL_MARINO,
    color_modulos_2: null,
    color_ojo_marco: AZUL_MARINO,
    color_ojo_centro: ROJO,
    logo: LOGO_CONATEL,
  },
  degradado: {
    preset: "degradado",
    forma_modulos: "redondeado",
    color_modulos: AZUL_LOGO,
    color_modulos_2: AZUL_MARINO,
    color_ojo_marco: AZUL_MARINO,
    color_ojo_centro: AZUL_MARINO,
    logo: LOGO_CONATEL,
  },
  clasico: {
    preset: "clasico",
    forma_modulos: "cuadrado",
    color_modulos: "#000000",
    color_modulos_2: null,
    color_ojo_marco: "#000000",
    color_ojo_centro: "#000000",
    logo: { activo: true, medio_id: null, tamano_pct: 24 },
  },
};

export const ETIQUETA_PRESET_QR: Record<Exclude<PresetQr, "personalizado">, string> = {
  institucional: "Institucional",
  degradado: "Degradado",
  clasico: "Clásico",
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Estilo completo a partir de lo guardado (o de nada: institucional). */
export function normalizarQrEstilo(bruto: unknown): QrEstilo {
  const o = bruto && typeof bruto === "object" ? (bruto as Partial<QrEstilo>) : {};
  const logoBruto = o.logo && typeof o.logo === "object" ? o.logo : ({} as Partial<QrEstiloLogo>);
  const base =
    o.preset === "personalizado"
      ? { ...PRESETS_QR.institucional, preset: "personalizado" as const }
      : (PRESETS_QR[o.preset as keyof typeof PRESETS_QR] ?? PRESETS_QR.institucional);
  const color = (v: unknown, defecto: string) => (typeof v === "string" && HEX.test(v) ? v : defecto);
  const personalizado = base.preset === "personalizado";
  const tamano = Number(logoBruto.tamano_pct);
  return {
    preset: base.preset,
    forma_modulos:
      personalizado && ["cuadrado", "redondeado", "puntos"].includes(String(o.forma_modulos))
        ? (o.forma_modulos as FormaModulosQr)
        : base.forma_modulos,
    color_modulos: personalizado ? color(o.color_modulos, base.color_modulos) : base.color_modulos,
    color_modulos_2: personalizado
      ? typeof o.color_modulos_2 === "string" && HEX.test(o.color_modulos_2)
        ? o.color_modulos_2
        : null
      : (base.color_modulos_2 ?? null),
    color_ojo_marco: personalizado ? color(o.color_ojo_marco, base.color_ojo_marco) : base.color_ojo_marco,
    color_ojo_centro: personalizado ? color(o.color_ojo_centro, base.color_ojo_centro) : base.color_ojo_centro,
    logo: {
      activo: logoBruto.activo === undefined ? true : Boolean(logoBruto.activo),
      medio_id: logoBruto.medio_id ? String(logoBruto.medio_id) : null,
      tamano_pct: Number.isFinite(tamano)
        ? Math.min(QR_LOGO_PCT_MAX, Math.max(QR_LOGO_PCT_MIN, Math.round(tamano)))
        : base.logo.tamano_pct,
    },
  };
}

/** Aplica un preset de un clic conservando el logo elegido (sí/no, medio y tamaño). */
export function aplicarPresetQr(actual: QrEstilo, preset: Exclude<PresetQr, "personalizado">): QrEstilo {
  return { ...PRESETS_QR[preset], logo: { ...actual.logo } };
}

/** Cambia un campo suelto: el estilo pasa a «personalizado» (salvo que solo cambie el logo). */
export function personalizarQr(actual: QrEstilo, cambios: Partial<Omit<QrEstilo, "preset" | "logo">>): QrEstilo {
  return { ...actual, ...cambios, preset: "personalizado" };
}

/** Clave estable del estilo (para la caché de vistas previas). */
export function claveQrEstilo(estilo: QrEstilo): string {
  return JSON.stringify(estilo);
}

/** Prefijo de las claves de la caché de imágenes del lienzo para vistas previas de QR. */
export const QR_PREFIJO = "qr:";

/** Clave de la vista previa de un QR en la caché de imágenes del lienzo. */
export function claveVistaPreviaQr(estilo: unknown): string {
  return `${QR_PREFIJO}${claveQrEstilo(normalizarQrEstilo(estilo))}`;
}
