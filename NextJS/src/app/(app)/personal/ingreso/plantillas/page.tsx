import { redirect } from "next/navigation";

/** Ruta anterior del listado: se conserva como redirección. */
export default function Page() {
  redirect("/documentos/plantillas");
}
