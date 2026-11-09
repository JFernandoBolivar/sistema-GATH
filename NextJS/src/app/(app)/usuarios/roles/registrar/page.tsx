import { redirect } from "next/navigation";

/** El alta de roles vive ahora en el diálogo de «Roles y permisos». */
export default function RolRegistrarPage() {
  redirect("/usuarios/roles");
}
