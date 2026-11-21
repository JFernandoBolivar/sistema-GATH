/** Formato de presentación (hora de Venezuela) de la bandeja de Captación. */

export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "—";
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Caracas",
  }).format(f);
}

export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "—";
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Caracas",
  }).format(f);
}

export function nombreCompleto(p: { nombres: string; apellidos: string }): string {
  return `${p.nombres} ${p.apellidos}`.trim();
}

export function formatearTamano(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Quién hizo el cambio, en lenguaje claro. */
export function describirActor(tipo: string, cedula: string): string {
  if (tipo === "SISTEMA") return "Sistema";
  if (tipo === "POSTULANTE") return "El postulante";
  return cedula ? `Captación (C.I. ${cedula})` : "Personal";
}
