import { Badge } from "@/components/ui/badge";
import type { PlantillaResumen } from "../../domain/entities/plantilla";
import { estaPublicada, textoEstado } from "../lib/etiquetas";

type EstadoPlantillaProps = Pick<PlantillaResumen, "estado" | "ultima_version" | "cambios_sin_publicar" | "activa">;

/** Insignias de estado: publicación (borrador/publicada vN/con cambios) y activa/inactiva. */
export function EstadoPlantilla({ plantilla }: { plantilla: EstadoPlantillaProps }) {
  const texto = textoEstado(plantilla);
  const variante = plantilla.cambios_sin_publicar ? "outline" : estaPublicada(plantilla) ? "default" : "secondary";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={variante} className={plantilla.cambios_sin_publicar ? "border-amber-500 text-amber-700 dark:text-amber-400" : undefined}>
        {texto}
      </Badge>
      {estaPublicada(plantilla) && (
        <Badge variant="outline" className={plantilla.activa ? "border-emerald-500 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
          {plantilla.activa ? "Activa" : "Inactiva"}
        </Badge>
      )}
    </div>
  );
}
