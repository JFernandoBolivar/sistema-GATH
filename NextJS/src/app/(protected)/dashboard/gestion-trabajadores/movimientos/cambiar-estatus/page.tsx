"use client";

import PageLayout from "../../../../../../components/layout/page-layout";
import { ChangeStatusForm } from "../../components/movimientos/change-status-form";

export default function ChangeStatusPage() {
  return (
    <PageLayout
      title="Cambiar Estatus Del Empleado"
      description="Gestione El Estatus del Empleado"
    >
      <ChangeStatusForm />
    </PageLayout>
  );
}
