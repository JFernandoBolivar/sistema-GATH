import { formatearFechaHora } from "@/modules/autogestion/ui/formato-solicitud";

export { formatearFechaHora };

const SOLO_FECHA = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium",
  timeZone: "America/Caracas",
});

export function formatearSoloFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? iso : SOLO_FECHA.format(f);
}

/** ISO → valor de `<input type="datetime-local">` en hora local del navegador. */
export function aInputLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}`;
}

/** Descarga un PDF recibido en base64 con el nombre indicado. */
export function descargarBase64Pdf(base64: string, nombre: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
