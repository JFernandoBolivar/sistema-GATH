"use client";

/**
 * Página del flujo "Crear Ub. Administrativa" (/organizacion/crear-ubicacion y /organizacion/dependencias).
 * Paridad 100% con el legado (`crear-ubicacion/page.tsx` + `create-dependency.tsx`):
 * - PageLayout con título "Gestión de Ubicaciones Administrativas" y descripción "Registre Nuevas Ubicaciones Administrativas Para Trabajadores"
 * - Formulario jerárquico directo CreateDependency
 */
import PageLayout from "@/components/layout/page-layout";
import CreateDependency from "./create-dependency";

export default function OrganizacionDependenciasPage() {
  return (
    <PageLayout
      title="Gestión de Ubicaciones Administrativas"
      description="Registre Nuevas Ubicaciones Administrativas Para Trabajadores"
    >
      <CreateDependency />
    </PageLayout>
  );
}

