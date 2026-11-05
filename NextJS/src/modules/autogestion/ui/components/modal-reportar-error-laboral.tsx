"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/form";
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
import {
  DESCRIPCION_MAX,
  reporteErrorLaboralSchema,
  type ReporteErrorLaboralValores,
} from "../schema/schema-reporte-error";

const OPCIONES_DATOS: ReadonlyArray<{
  valor: ReporteErrorLaboralValores["dato"];
  etiqueta: string;
}> = [
  { valor: "cargo", etiqueta: "Cargo" },
  { valor: "oficina", etiqueta: "Oficina / Gerencia" },
  { valor: "fecha_ingreso", etiqueta: "Fecha de ingreso" },
  { valor: "otro", etiqueta: "Otro dato laboral" },
];

export function ModalReportarErrorLaboral() {
  const [abierto, setAbierto] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: "exito" | "error";
    mensaje: string;
  } | null>(null);

  const form = useForm<ReporteErrorLaboralValores>({
    resolver: zodResolver(reporteErrorLaboralSchema),
    defaultValues: { dato: "cargo", descripcion: "" },
    mode: "onChange",
  });
  const enviando = form.formState.isSubmitting;
  const longitud = (useWatch({ control: form.control, name: "descripcion" }) ?? "").length;

  const onSubmit = async (v: ReporteErrorLaboralValores) => {
    setFeedback(null);
    try {
      const res = await crearReporteErrorLaboralAction(v.dato, v.descripcion);
      if (res.success) {
        setFeedback({
          tipo: "exito",
          mensaje: "Reporte de discrepancia enviado a Talento Humano exitosamente.",
        });
        form.reset();
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
                <AlertTitle>{feedback.tipo === "exito" ? "Reporte enviado" : "Error"}</AlertTitle>
                <AlertDescription>{feedback.mensaje}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="dato"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dato que presenta error</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={enviando}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccione el campo..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OPCIONES_DATOS.map((opc) => (
                        <SelectItem key={opc.valor} value={opc.valor}>
                          {opc.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del error</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      maxLength={DESCRIPCION_MAX}
                      disabled={enviando}
                      className="h-32 resize-none"
                      placeholder="Explique detalladamente cuál es la información correcta (ej. según resolución de nombramiento, fecha exacta de ingreso, etc.)."
                    />
                  </FormControl>
                  <div className="flex items-start justify-between gap-2">
                    <FormMessage />
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {longitud}/{DESCRIPCION_MAX}
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAbierto(false)}
                disabled={enviando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando} className="gap-2">
                {enviando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar reporte a RRHH"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
