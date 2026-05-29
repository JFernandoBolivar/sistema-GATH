"use client";

import PageLayout from "../../../../../../components/layout/page-layout";
import { PasivoForm } from "../../components/movimientos/cambiar-personal-pasivo-form";

export default function PasivoPage() {
  return (
    <PageLayout
      title="Gestión De Personal"
      description="Gestionar El Personal Trabajador"
    >
      <PasivoForm />
    </PageLayout>
  );
}
