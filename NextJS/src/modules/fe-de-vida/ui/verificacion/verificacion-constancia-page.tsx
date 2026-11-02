import { verificarConstanciaAction } from "../../infrastructure/actions/verificacion-constancia-actions";
import { FichaVerificacion } from "./ficha-verificacion";

/** Página pública de la ficha de verificación: se abre sin sesión desde el QR de la constancia. */
export default async function VerificacionConstanciaPage({ codigo }: { codigo: string }) {
  const resultado = await verificarConstanciaAction(codigo);
  return <FichaVerificacion resultado={resultado} />;
}
