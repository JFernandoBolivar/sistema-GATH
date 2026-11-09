import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <Card className="flex h-full min-w-0 border-none rounded-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 min-w-0 flex-1 bg-muted/30">
          <ScrollArea className="h-full">
            <div className="p-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                <p className="text-muted-foreground mt-1">{description}</p>
              </div>
              {children}
            </div>
          </ScrollArea>
        </main>
      </div>
    </Card>
  );
}
