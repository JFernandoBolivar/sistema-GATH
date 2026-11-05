"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Button } from "@/shared/ui/components/button";
import { Label } from "@/shared/ui/components/label";
import { Textarea } from "@/shared/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/components/alert";
import { crearReporteErrorLaboralAction } from "@/modules/personal/infrastructure/actions/personal-actions";

const OPCIONES_DATOS = [
  { valor: "cargo", etiqueta: "Cargo" },
  { valor: "oficina", etiqueta: "Oficina / Gerencia" },
  { valor: "fecha_ingreso", etiqueta: "Fecha de ingreso" },
  { valor: "otro", etiqueta: "Otro dato laboral" },
] as const;

type TipoDatoReportado = (typeof OPCIONES_DATOS)[number]["valor"];

export function ModalReportarErrorLaboral() {
  const [abierto, setAbierto] = useState(false);
  const [dato, setDato] = useState<TipoDatoReportado>("cargo");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: "exito" | "error";
    mensaje: string;
  } | null>(null);

  const longitud = descripcion.trim().length;
  const descripcionValida = longitud >= 10 && longitud <= 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcionValida || enviando) return;

    setEnviando(true);
    setFeedback(null);

    try {
      const res = await crearReporteErrorLaboralAction(dato, descripcion.trim());
      if (res.success) {
        setFeedback({
          tipo: "exito",
          mensaje: "Reporte de discrepancia enviado a Talento Humano exitosamente.",
        });
        setDescripcion("");
        setTimeout(() => {
          setAbierto(false);
          setFeedback(null);
        }, 2200);
      } else {
        setFeedback({
          tipo: "error",
          mensaje: res.error ?? "No se pudo registrar el reporte. Intente nuevamente.",
        });
      }
    } catch {
      setFeedback({
        tipo: "error",
        mensaje: "Error de comunicación con el servidor. Intente más tarde.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-amber-700 dark:text-amber-400 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
        >
          <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          Reportar error en datos laborales
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Reportar discrepancia en datos laborales
          </DialogTitle>
          <DialogDescription>
            Indique el dato que presenta error y describa la discrepancia. Este reporte será
            revisado por el equipo de Talento Humano sin alterar directamente su expediente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {feedback && (
            <Alert
              variant={feedback.tipo === "exito" ? "default" : "destructive"}
              className={
                feedback.tipo === "exito"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : ""
              }
            >
              {feedback.tipo === "exito" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {feedback.tipo === "exito" ? "Reporte enviado" : "Error"}
              </AlertTitle>
              <AlertDescription>{feedback.mensaje}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="select-dato-laboral">Dato que presenta error</Label>
            <Select
              value={dato}
              onValueChange={(val) => setDato(val as TipoDatoReportado)}
              disabled={enviando}
            >
              <SelectTrigger id="select-dato-laboral">
                <SelectValue placeholder="Seleccione el campo..." />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_DATOS.map((opc) => (
                  <SelectItem key={opc.valor} value={opc.valor}>
                    {opc.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="descripcion-error-laboral">Descripción del error</Label>
              <span
                className={`text-xs ${
                  longitud === 0
                    ? "text-muted-foreground"
                    : descripcionValida
                    ? "text-emerald-600"
                    : "text-destructive"
                }`}
              >
                {longitud} / 500 caracteres (mínimo 10)
              </span>
            </div>
            <Textarea
              id="descripcion-error-laboral"
              placeholder="Explique detalladamente cuál es la información correcta (ej. según resolución de nombramiento, fecha exacta de ingreso, etc.)."
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={enviando}
              maxLength={500}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAbierto(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!descripcionValida || enviando}
              className="gap-2"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Enviar reporte a RRHH"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
