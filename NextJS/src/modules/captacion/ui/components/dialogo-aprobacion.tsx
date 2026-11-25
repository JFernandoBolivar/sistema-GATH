"use client";

import { useState } from "react";
import { FileUp, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hoyEnVenezuela, validarAprobacion, validarPdfFirmado } from "../../domain/ingreso-corto";

interface Props {
  /** Número del Punto de Cuenta que se firmó (para el texto). */
  numeroPuntoCuenta?: string;
  pendiente?: boolean;
  error?: string | null;
  /** Recibe el formulario ya validado (`fecha_firma` y, si se eligió, `pdf_firmado`). */
  onConfirmar: (formData: FormData) => void;
  onCancelar: () => void;
}

/**
 * Registro de la aprobación firmada fuera del sistema: fecha de la firma (obligatoria, no futura) y, si se tiene,
 * el Punto de Cuenta firmado escaneado en PDF. Se monta solo mientras está abierto.
 */
export function DialogoAprobacion({ numeroPuntoCuenta, pendiente = false, error, onConfirmar, onCancelar }: Props) {
  const [fecha, setFecha] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const hoy = hoyEnVenezuela();

  function confirmar() {
    const e = validarAprobacion({ fechaFirma: fecha, pdfFirmado: pdf }, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const form = new FormData();
    form.set("fecha_firma", fecha);
    if (pdf) form.set("pdf_firmado", pdf);
    onConfirmar(form);
  }

  return (
    <Dialog open onOpenChange={(a) => (!a && !pendiente ? onCancelar() : undefined)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-5 text-primary" aria-hidden /> Registrar la aprobación firmada
          </DialogTitle>
          <DialogDescription>
            La aprobación se firma en papel, fuera del sistema. Aquí queda constancia de la fecha en que se firmó
            {numeroPuntoCuenta ? ` el Punto de Cuenta ${numeroPuntoCuenta}` : " el Punto de Cuenta"}; el expediente pasa a «Aprobado».
          </DialogDescription>
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
            <Label htmlFor="aprobacion-fecha">Fecha de la firma *</Label>
            <Input
              id="aprobacion-fecha"
              type="date"
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-invalid={Boolean(errores.fechaFirma)}
              aria-describedby={errores.fechaFirma ? "aprobacion-fecha-error" : "aprobacion-fecha-ayuda"}
              required
            />
            {errores.fechaFirma ? (
              <p id="aprobacion-fecha-error" role="alert" className="text-sm text-danger">{errores.fechaFirma}</p>
            ) : (
              <p id="aprobacion-fecha-ayuda" className="text-sm text-muted-foreground">El día en que se firmó; no puede ser una fecha futura.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aprobacion-pdf">Punto de Cuenta firmado, escaneado en PDF (opcional)</Label>
            <Input
              id="aprobacion-pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const archivo = e.target.files?.[0] ?? null;
                setPdf(archivo);
                // El error del archivo se ve apenas se elige, no al final.
                setErrores((prev) => {
                  const { pdfFirmado: _quitado, ...resto } = prev;
                  const mensaje = validarPdfFirmado(archivo);
                  return mensaje ? { ...resto, pdfFirmado: mensaje } : resto;
                });
              }}
              aria-invalid={Boolean(errores.pdfFirmado)}
              aria-describedby={errores.pdfFirmado ? "aprobacion-pdf-error" : "aprobacion-pdf-ayuda"}
              className="pt-2"
            />
            {errores.pdfFirmado ? (
              <p id="aprobacion-pdf-error" role="alert" className="text-sm text-danger">{errores.pdfFirmado}</p>
            ) : (
              <p id="aprobacion-pdf-ayuda" className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <FileUp className="mt-0.5 size-4 shrink-0" aria-hidden /> Solo PDF, hasta 10 MB. Si todavía no lo tiene, puede adjuntarlo después.
              </p>
            )}
          </div>

          {error ? (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{error}</p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onCancelar} disabled={pendiente}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Registrar aprobación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
