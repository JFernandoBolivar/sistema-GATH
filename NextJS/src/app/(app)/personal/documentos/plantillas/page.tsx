import { redirect } from "next/navigation";

/** Alias intermedio: la ruta canónica es /documentos/plantillas. */
export default function Page() {
  redirect("/documentos/plantillas");
}
