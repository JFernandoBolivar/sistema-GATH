import PageLayout from "@/components/layout/page-layout";
import FormRegisterUser from "@/modules/identidad/ui/components/form-register-user";

export default function SecurityRegisterPage() {
  return (
    <PageLayout title="Registrar Usuarios">
      <FormRegisterUser />
    </PageLayout>
  );
}
