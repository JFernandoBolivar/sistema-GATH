import type { ReactNode } from "react";
import PersonalLayout from "../personal/layout";

/**
 * M-3: Dirección General vive dentro de «Gestión de Trabajadores» (grupo «Ingreso de
 * personal»); reutiliza su encabezado y su menú lateral. La ruta no cambia
 * porque los avisos y correos del backend enlazan a ella.
 */
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <PersonalLayout>{children}</PersonalLayout>;
}
