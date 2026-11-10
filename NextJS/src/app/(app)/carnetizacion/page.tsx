import { redirect } from "next/navigation";

/**
 * La entrada de Carnetización abre directamente la Consola de Emisión.
 * El panel intermedio de tarjetas se eliminó por pedido de diseño
 * (feedback 2026-11-10): el usuario entra a trabajar, no a un índice.
 */
export default function Page() {
  redirect("/carnetizacion/emision");
}
