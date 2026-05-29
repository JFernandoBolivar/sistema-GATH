"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocumentProps } from "@react-pdf/renderer";
import dynamic from "next/dynamic";
import { ReactElement } from "react";

interface ExportButtonProps {
  document: ReactElement<DocumentProps>;
  fileName: string;
  buttonText?: string;
  className?: string;
}

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  {
    ssr: false,
    loading: () => (
      <Button className={`bg-blue-600 opacity-50`} disabled>
        Preparando...
      </Button>
    ),
  },
);

export default function ExportButton({
  document,
  fileName = "reporte.pdf",
  buttonText = "Descargar PDF",
  className,
}: ExportButtonProps) {
  return (
    <PDFDownloadLink document={document} fileName={fileName}>
      {({ loading }) => (
        <Button
          className={`${cn(className)} bg-blue-600 hover:bg-blue-800`}
          disabled={loading}
          type="button"
        >
          {loading ? "Generando archivo..." : buttonText}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
