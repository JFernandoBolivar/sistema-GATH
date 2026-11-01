import { redirect } from "next/navigation";

/** La edición de usuarios vive ahora en el detalle (D4). */
export default function UsersModificarPage() {
  redirect("/usuarios");
}
