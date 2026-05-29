"use client";

import PageLayout from "../../../../../../components/layout/page-layout";
import { PasivoPasiveForm } from "../../components/movimientos/cambiar-personal-pasivo-form";

export default function PasivoPage() {
  return (
    <PageLayout
      title="Gestión De Personal"
      description="Gestionar El Personal Trabajador"
    >
      <PasivoPasiveForm />
    </PageLayout>
  );
}
