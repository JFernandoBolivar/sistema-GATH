import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/** Indicador de carga genérico, reutilizable por cualquier módulo/página de `(app)`. */
export default function Loading({
  className,
  promiseMessage,
}: {
  className?: string;
  promiseMessage?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardContent>
        <div className="relative size-60 m-auto flex items-center justify-center">
          <div className="absolute inset-2 rounded-full border-b-2 border-blue-500 animate-spin" />
          <div className="absolute inset-7 rounded-full border-t-2 border-red-500 animate-spin direction-[reverse] animation-duration-[0.8s]" />
          <div className="text-lg text-inherit animate-pulse text-center">
            {promiseMessage ? promiseMessage : "Ejecutando Operacion"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
