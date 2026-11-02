import { redirect } from "next/navigation";

/** La portada de pasivos es el listado (G13). */
export default function PasivosRoutePage() {
  redirect("/pasivos/consultar");
}
