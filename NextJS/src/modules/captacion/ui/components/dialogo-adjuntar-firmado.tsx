"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validarPdfFirmado } from "../../domain/ingreso-corto";

interface Props {
  pendiente?: boolean;
  error?: string | null;
  onConfirmar: (formData: FormData) => void;
  onCancelar: () => void;
}

/** Adjunta a posteriori el Punto de Cuenta firmado y escaneado (PDF obligatorio aquí). */
export function DialogoAdjuntarFirmado({ pendiente = false, error, onConfirmar, onCancelar }: Props) {
  const [pdf, setPdf] = useState<File | null>(null);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  function confirmar() {
    const mensaje = pdf ? validarPdfFirmado(pdf) : "Seleccione el archivo PDF firmado.";
    setErrorPdf(mensaje);
    if (mensaje || !pdf) return;
    const form = new FormData();
    form.set("pdf_firmado", pdf);
    onConfirmar(form);
  }

  return (
    <Dialog open onOpenChange={(a) => (!a && !pendiente ? onCancelar() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjuntar el Punto de Cuenta firmado</DialogTitle>
          <DialogDescription>Suba el escaneo del Punto de Cuenta firmado. Solo se puede adjuntar una vez.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            confirmar();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firmado-pdf">Archivo PDF *</Label>
            <Input
              id="firmado-pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const archivo = e.target.files?.[0] ?? null;
                setPdf(archivo);
                setErrorPdf(archivo ? validarPdfFirmado(archivo) : null);
              }}
              aria-invalid={Boolean(errorPdf)}
              aria-describedby={errorPdf ? "firmado-pdf-error" : "firmado-pdf-ayuda"}
              className="pt-2"
            />
            {errorPdf ? (
              <p id="firmado-pdf-error" role="alert" className="text-sm text-danger">{errorPdf}</p>
            ) : (
              <p id="firmado-pdf-ayuda" className="text-sm text-muted-foreground">Solo PDF, hasta 10 MB.</p>
            )}
          </div>
          {error ? <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onCancelar} disabled={pendiente}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Adjuntar PDF firmado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
