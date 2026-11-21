import { redirect } from "next/navigation";

/** Entrada del módulo: lleva a la bandeja de expedientes. */
export default function Page() {
  redirect("/captacion/expedientes");
}
