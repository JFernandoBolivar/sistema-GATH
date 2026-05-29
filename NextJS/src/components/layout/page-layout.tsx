import { Card } from "@/components/ui/card";

export default function PageLayout({
  children,
  title,
  description,
}: Readonly<{
  children: React.ReactNode;
  title?: string;
  description?: string;
}>) {
  return (
    <Card className="flex h-full border-none rounded-none ">
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto bg-muted/30 p-6 space-y-2">
          <div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
          {children}
        </main>
      </div>
    </Card>
  );
}
