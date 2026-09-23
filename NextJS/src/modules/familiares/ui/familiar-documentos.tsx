"use client";

/**
 * Sección "Documentos" del mini-expediente del familiar
 * (`/familiares/registrar`): 2 archivos opcionales (cédula, partida de
 * nacimiento), paridad con el legado (`file_cedula`/`file_partida_nacimiento`
 * en `schemaFamilyEmployeeOne`). No se integra al `useForm` con zodResolver
 * del resto de la página (mismo criterio que la foto de empleado en
 * Personal): son 2 `<input type="file">` simples cuyo valor se sube recién
 * después de crear el familiar (se necesita su id), vía
 * `subirDocumentoFamiliarAction`.
 */
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

export function FamiliarDocumentos({
  archivoCedula,
  onCedulaChange,
  archivoPartida,
  onPartidaChange,
}: {
  archivoCedula: File | null;
  onCedulaChange: (file: File | null) => void;
  archivoPartida: File | null;
  onPartidaChange: (file: File | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Documentos (opcional)</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field>
          <Label htmlFor="documentoCedula">Cédula (imagen o PDF, máx. 5MB)</Label>
          <Input
            id="documentoCedula"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => onCedulaChange(e.target.files?.[0] ?? null)}
          />
          {archivoCedula && <p className="text-xs text-muted-foreground">{archivoCedula.name}</p>}
        </Field>
        <Field>
          <Label htmlFor="documentoPartida">Partida de nacimiento (imagen o PDF, máx. 5MB)</Label>
          <Input
            id="documentoPartida"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => onPartidaChange(e.target.files?.[0] ?? null)}
          />
          {archivoPartida && <p className="text-xs text-muted-foreground">{archivoPartida.name}</p>}
        </Field>
      </div>
    </div>
  );
}
