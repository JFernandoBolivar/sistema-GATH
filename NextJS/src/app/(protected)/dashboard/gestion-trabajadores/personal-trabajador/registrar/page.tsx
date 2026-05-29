"use client";
import PageLayout from "../../../../../../components/layout/page-layout";
import MultiStepForm from "./forms/form-multi-steps";

export default function RegistrarEmpleadoPage() {
  return (
    <PageLayout
      title="Captación de información del trabajador"
      description="Recopilación en pasos estrategicos"
    >
      <MultiStepForm />
    </PageLayout>
  );
}
