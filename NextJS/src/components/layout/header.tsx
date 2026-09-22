"use client";

import { SignOut } from "@/components/signout-button";
import { Breadcrumb, BreadcrumbList } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderLayout({
  children,
  title,
  subtitle,
}: Readonly<{
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}>) {
  const { data: session } = useSession();
  const isRac = session?.user?.department?.nombre_departamento === "RAC";
  const pathName = usePathname().split("/");
  const pasivoPath = ["pasivos", "gestion-pasivos"];
  const activoPath = ["personal", "gestion-trabajadores"];

  const isPasivo = pasivoPath.some((p) => pathName.includes(p));
  const isActivo = activoPath.some((p) => pathName.includes(p));

  return (
    <header className="border-b border-border px-6 py-4 shadow-sm sticky top-0 bg-blue-900/100 w-full flex flex-row justify-between items-center z-50">
      <div className="text-white">
        <div className="flex flex-row justify-start gap-4">
          <div className="self-center">{children}</div>
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-white">{subtitle}</p>}
            {isRac && (isPasivo || isActivo) && (
              <Breadcrumb className="text-white mt-1.5 cursor-pointer">
                <BreadcrumbList className="text-white">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="flex items-center gap-1 text-[1rem] cursor-pointer"
                        variant={"secondary"}
                      >
                        {isPasivo
                          ? "Gestion Personal Pasivo"
                          : isActivo
                          ? "Gestion Personal Activo"
                          : "Gestión Personal"}
                        <ChevronDownIcon className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuGroup>
                        <DropdownMenuItem className="cursor-pointer" asChild>
                          <Link href={"/personal"}>
                            Gestión De Personal Activo
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" asChild>
                          <Link href={"/pasivos"}>
                            Gestión De Personal Pasivo
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>
        </div>
      </div>

      <SignOut />
    </header>
  );
}
