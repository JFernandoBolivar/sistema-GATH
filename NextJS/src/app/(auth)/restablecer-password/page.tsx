import { Suspense } from "react";
import RestablecerPasswordForm from "@/modules/auth/ui/restablecer-password-form";
import { Card } from "@/shared/ui/components/card";
import Image from "next/image";

interface RestablecerPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function RestablecerPasswordPage({
  searchParams,
}: RestablecerPasswordPageProps) {
  const params = await searchParams;
  const token = params?.token ?? "";

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-4">
      <Card className="grid h-[80%] lg:w-[70%] lg:grid-cols-2 p-0 backdrop-blur-3xl bg-slate-400/55 text-white border-0">
        <div className="flex flex-col p-6 md:p-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">
              <Suspense
                fallback={
                  <div className="text-center text-white py-8 text-sm">
                    Cargando formulario...
                  </div>
                }
              >
                <RestablecerPasswordForm tokenInicial={token} />
              </Suspense>
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block rounded-2xl">
          <Image
            height={2000}
            width={2000}
            src="/logoLogin.png"
            alt="Logo CONATEL"
            priority
            className="rounded-br-lg rounded-tr-lg absolute inset-0 h-full w-full dark:brightness-[0.2] dark:grayscale object-cover"
          />
        </div>
      </Card>
    </div>
  );
}
