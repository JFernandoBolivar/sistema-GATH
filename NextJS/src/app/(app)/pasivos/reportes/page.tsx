import PageLayout from "@/components/layout/page-layout";
import ReportPasivos from "@/modules/reportes/ui/components/report-pasivos";

export default function PasivosReportesPage() {
  return (
    <PageLayout
      title="Reporte De Pasivos"
      description="Filtre La Información De Los Pasivos"
    >
      <ReportPasivos />
    </PageLayout>
  );
}
