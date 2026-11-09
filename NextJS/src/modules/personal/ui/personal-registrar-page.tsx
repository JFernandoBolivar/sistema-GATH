"use client";

/**
 * Página de alta de personal — ruta propia `/personal/registrar`, paridad
 * con el legado (`gestion-trabajadores/personal-trabajador/registrar/`):
 * mismo título/descripción y el mismo wizard de 7 pasos
 * (`registrar/form-multi-steps.tsx`). Opera exclusivamente con DTOs (R5) y
 * delega la mutación a las Server Actions del módulo (R7).
 */
import PageLayout from "@/components/layout/page-layout";

import MultiStepForm from "./registrar/form-multi-steps";

export default function PersonalRegistrarPage() {
  return (
    <PageLayout title="Captación de información del trabajador" description="Recopilación en pasos estrategicos">
      <MultiStepForm />
    </PageLayout>
  );
}
