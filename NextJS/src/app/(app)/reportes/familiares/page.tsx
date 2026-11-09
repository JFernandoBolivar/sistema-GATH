import PageLayout from "@/components/layout/page-layout";
import ReportFamily from "@/modules/reportes/ui/components/report-family";

export default function ReportFamilyPage() {
  return (
    <PageLayout
      title="Reporte De Familiares"
      description="Filtre La Información de los Familiares"
    >
      <ReportFamily />
    </PageLayout>
  );
}
