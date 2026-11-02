"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/shared/ui/components/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept?: string;
  label: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  className?: string;
}

export function FileUpload({
  accept = "image/jpeg,image/png,application/pdf",
  label,
  value,
  onChange,
  className,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File | null) => {
      onChange(file);
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const inputId = `file-upload-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  if (value) {
    return (
      <div className={cn("flex items-center gap-3 rounded-md border border-green-300 bg-green-50 p-3", className)}>
        <FileText className="size-8 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800 truncate">{value.name}</p>
          <p className="text-xs text-green-600">{(value.size / 1024).toFixed(1)} KB</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 cursor-pointer text-red-500 hover:text-red-700"
          onClick={() => handleFile(null)}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors cursor-pointer",
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100",
        )}
        onClick={() => document.getElementById(inputId)?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            document.getElementById(inputId)?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={label}
      >
        <Upload className="size-8 text-gray-400" />
        <p className="text-sm text-gray-500 text-center">
          <span className="font-medium text-blue-600">Click para seleccionar</span> o arrastrar y soltar
        </p>
        <p className="text-xs text-gray-400">PDF, JPG o PNG</p>
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}

export default FileUpload;
