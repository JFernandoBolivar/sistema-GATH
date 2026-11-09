import PageLayout from "@/components/layout/page-layout";
import ActualizarUbicacionView from "@/modules/organizacion/ui/actualizar-ubicacion-view";

/**
 * Página "Actualizar Ub. Admnistrativas" (/organizacion/actualizar-ubicacion).
 * Paridad 100% con `actualizar-ubicacion/page.tsx` del proyecto legado.
 */
export default function ActualizarUbicacionRoutePage() {
  return (
    <PageLayout title="Actualizar Informacion De Dependencias">
      <ActualizarUbicacionView />
    </PageLayout>
  );
}
