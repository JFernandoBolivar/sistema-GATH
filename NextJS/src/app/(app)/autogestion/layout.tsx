import { AutogestionShell } from "@/modules/autogestion/ui/shell/autogestion-shell";

export default function AutogestionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AutogestionShell>{children}</AutogestionShell>;
}
