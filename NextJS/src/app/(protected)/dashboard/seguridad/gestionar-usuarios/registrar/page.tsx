import PageLayout from "@/components/layout/page-layout";
import RegisterForm from "../../components/register/form-register";

export default function SecurityPage() {
  return (
    <PageLayout title="Registrar Usuarios">
      <RegisterForm />
    </PageLayout>
  );
}
