import { redirect } from "next/navigation";

/** Ruta heredada: el diseño vive ahora en el editor único de plantillas. */
export default function Page() {
  redirect("/documentos/plantillas?grupo=punto_cuenta");
}
