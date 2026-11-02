"use client";

/**
 * Sección "Documentos Del Familiar":
 * Réplica visual de crear-familiar.tsx del legado:
 * fieldset border-orange-600, legend naranja, FileUpload para Foto o PDF de Cédula,
 * y condicional para Partida de Nacimiento si es HIJO (A).
 */
import { FileUpload } from "@/shared/ui/components/file-upload";

export function FamiliarDocumentos({
  archivoCedula,
  onCedulaChange,
  archivoPartida,
  onPartidaChange,
  esHijo = false,
}: {
  archivoCedula: File | null;
  onCedulaChange: (file: File | null) => void;
  archivoPartida: File | null;
  onPartidaChange: (file: File | null) => void;
  esHijo?: boolean;
}) {
  return (
    <fieldset className="border grid grid-cols-1 gap-4 col-span-2 p-4 border-orange-600 rounded-sm">
      <legend className="flex gap-2 text-orange-700 font-bold">
        Documentos Del Familiar
      </legend>
      <FileUpload
        label="Foto o PDF de la Cédula"
        value={archivoCedula}
        onChange={onCedulaChange}
      />
      {esHijo && (
        <FileUpload
          label="Partida de Nacimiento"
          value={archivoPartida}
          onChange={onPartidaChange}
        />
      )}
    </fieldset>
  );
}
