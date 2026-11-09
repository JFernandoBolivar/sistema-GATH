"use client";

/**
 * Página del flujo "Crear Direcciones" (/organizacion/crear-ubicacion-administrativa-direccion y /organizacion/direcciones-linea).
 * Paridad 100% con el legado (`crear-ubicacion-administrativa-direccion/page.tsx` + `create-direction-dependency.tsx`):
 * - PageLayout con título "Crear Direcciones Administrativas"
 * - Formulario directo CreateDirectionDependency
 */
import PageLayout from "@/components/layout/page-layout";
import CreateDirectionDependency from "./create-direction-dependency";

export default function OrganizacionDireccionesLineaPage() {
  return (
    <PageLayout title="Crear Direcciones Administrativas">
      <CreateDirectionDependency />
    </PageLayout>
  );
}

