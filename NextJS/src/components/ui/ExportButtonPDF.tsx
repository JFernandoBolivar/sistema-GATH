"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocumentProps } from "@react-pdf/renderer";
import { ReactElement, useCallback, useState } from "react";

interface ExportButtonProps {
  document: ReactElement<DocumentProps>;
  fileName: string;
  buttonText?: string;
  className?: string;
}

export default function ExportButton({
  document: pdfDocument,
  fileName = "reporte.pdf",
  buttonText = "Descargar PDF",
  className,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(pdfDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const a = globalThis.document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }, [pdfDocument, fileName]);

  return (
    <Button
      className={`${cn(className)} bg-blue-600 hover:bg-blue-800`}
      disabled={loading}
      onClick={handleClick}
      type="button"
    >
      {loading ? "Generando archivo…" : buttonText}
    </Button>
  );
}
