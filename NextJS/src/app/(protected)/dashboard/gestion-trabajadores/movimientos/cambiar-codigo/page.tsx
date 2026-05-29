"use client";

import PageLayout from "../../../../../../components/layout/page-layout";
import { ChangeCodeForm } from "../../components/movimientos/cambiar-codigo-form";

export default function ChangeCodePage() {
  return (
    <PageLayout
      title="Cambiar Cargo"
      description="Asigne Un Cambio de Cargo Al Empleado"
    >
      <ChangeCodeForm />
    </PageLayout>
  );
}
