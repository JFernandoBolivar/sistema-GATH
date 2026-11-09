import { redirect } from "next/navigation";

/** La matriz vive ahora en la pestaña «Matriz de permisos» de Roles y permisos. */
export default function MatrizRoute() {
  redirect("/usuarios/roles?tab=matriz");
}
