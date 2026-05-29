"use client";

import PageLayout from "../../../../../../components/layout/page-layout";
import { ChangeStatusPasiveForm } from "../../components/movimientos/change-status-form";

export default function ChangeStatusPasiveFormPage() {
  return (
    <PageLayout
      title="Cambiar Estatus Del Empleado"
      description="Gestione El Estatus del Empleado"
    >
      <ChangeStatusPasiveForm />
    </PageLayout>
  );
}
