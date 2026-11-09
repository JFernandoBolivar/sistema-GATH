import LoginForm from "@/modules/auth/ui/login-form";
import { Card } from "@/shared/ui/components/card";
import Image from "next/image";

export default function LoginPage() {
  return (
    <main className="relative flex h-full w-full flex-col items-center justify-center gap-4">
      <Card className="grid w-full max-w-sm sm:max-w-md lg:max-w-4xl min-h-[460px] lg:grid-cols-2 p-0 backdrop-blur-3xl bg-slate-400/55 text-white border-0 shadow-2xl rounded-2xl overflow-hidden">
        <div className="flex flex-col p-6 sm:p-8 md:p-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs sm:max-w-sm">
              <LoginForm />
            </div>
          </div>
        </div>
        <div className="relative hidden overflow-hidden rounded-2xl bg-slate-950 lg:block">
          <Image
            height={2000}
            width={2000}
            src="/logoLogin.png"
            alt="CONATEL"
            className="rounded-br-lg rounded-tr-lg absolute inset-0 h-full w-full object-cover object-center dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </Card>
    </main>
  );
}
