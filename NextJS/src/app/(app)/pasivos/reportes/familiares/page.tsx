import PageLayout from "@/components/layout/page-layout";
import ReportFamilyPasivos from "@/modules/reportes/ui/components/report-family-pasivos";

export default function PasivosReportesFamiliaresPage() {
  return (
    <PageLayout
      title="Reporte De Familiares De Pasivos"
      description="Filtre La Información De Los Familiares Del Personal Pasivo"
    >
      <ReportFamilyPasivos />
    </PageLayout>
  );
}
