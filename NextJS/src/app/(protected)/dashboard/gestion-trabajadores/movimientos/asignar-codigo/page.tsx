"use client";

import PageLayout from "../../../../../../components/layout/page-layout";
import { AsigCode } from "../../components/movimientos/asignar-codigo-form";

export default function AsignarCodigoPage() {
  return (
    <PageLayout
      title="Asignación De Cargos"
      description="Asigne Un Nuevo Código Al Personal"
    >
      <AsigCode />
    </PageLayout>
  );
}
