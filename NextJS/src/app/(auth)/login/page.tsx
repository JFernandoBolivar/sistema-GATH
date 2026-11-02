import LoginForm from "@/modules/auth/ui/login-form";
import { Card } from "@/shared/ui/components/card";
import Image from "next/image";

export default function LoginPage() {
  return (
    <main className="relative flex h-full w-full flex-col items-center justify-center gap-4">
      <Card className="grid h-[80%] lg:w-[78%] lg:grid-cols-2 p-0 backdrop-blur-3xl bg-slate-400/55 text-white border-0">
        <div className="flex flex-col p-6 md:p-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">
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
