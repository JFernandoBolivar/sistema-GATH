import { redirect } from "next/navigation";

/** Entrada del módulo: lleva a la bandeja de solicitudes. */
export default function Page() {
  redirect("/presupuesto/solicitudes");
}
