"use client";

/**
 * Página del flujo "Actualizar Ub. Administrativas" (/organizacion/actualizar-ubicacion y /organizacion/coordinaciones).
 * Paridad 100% con el legado (`actualizar-ubicacion/page.tsx`):
 * - PageLayout con título "Actualizar Informacion De Dependencias"
 * - Pestañas directas para Dirección / Gerencia / Oficina, División / Coordinación, Coordinación
 */
import PageLayout from "@/components/layout/page-layout";
import ActualizarUbicacionView from "./actualizar-ubicacion-view";

export default function OrganizacionCoordinacionesPage() {
  return (
    <PageLayout title="Actualizar Informacion De Dependencias">
      <ActualizarUbicacionView />
    </PageLayout>
  );
}

