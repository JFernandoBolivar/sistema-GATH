"use client";
import { cn } from "@/lib/utils";
import { DocumentProps } from "@react-pdf/renderer";
import dynamic from "next/dynamic";
import { ReactElement } from "react";

const DynamicPDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false },
);

interface PDFViewProps {
  document: ReactElement<DocumentProps>;
  className?: string;
}

export default function PDFView({ document, className }: PDFViewProps) {
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm">
      <DynamicPDFViewer className={cn(className)} showToolbar={true}>
        {document}
      </DynamicPDFViewer>
    </div>
  );
}
