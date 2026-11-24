import { Label } from "@/components/ui/label";

/** Etiqueta + control + mensaje de error, con el `id` enlazado. */
export function CampoForm({
  id,
  etiqueta,
  error,
  ayuda,
  children,
  className,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `grid gap-1.5 ${className}` : "grid gap-1.5"}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
