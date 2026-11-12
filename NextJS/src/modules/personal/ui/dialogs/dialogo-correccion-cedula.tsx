"use client";

/**
 * Confirmación de la corrección de cédula: muestra a quién afecta (vista previa), pide el
 * motivo y que se escriba la cédula nueva. No ejecuta nada: devuelve motivo y confirmación.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Textarea } from "@/shared/ui/components/textarea";

import type { VistaPreviaCorreccionCedula } from "../../domain/entities/correccion-cedula";
import {
  MOTIVO_CEDULA_MAX,
  MOTIVO_CEDULA_MIN,
  confirmacionCedulaCoincide,
} from "../schema/schema-correccion-cedula";

interface DialogoCorreccionCedulaProps {
  vistaPrevia: VistaPreviaCorreccionCedula | null;
  ejecutando: boolean;
  error: string | null;
  onCancelar: () => void;
  onConfirmar: (motivo: string, confirmacion: string) => void;
}

export function DialogoCorreccionCedula({
  vistaPrevia,
  ejecutando,
  error,
  onCancelar,
  onConfirmar,
}: DialogoCorreccionCedulaProps) {
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const motivoValido =
    motivo.trim().length >= MOTIVO_CEDULA_MIN && motivo.trim().length <= MOTIVO_CEDULA_MAX;
  const coincide = vistaPrevia
    ? confirmacionCedulaCoincide(confirmacion, vistaPrevia.cedulaNueva)
    : false;

  return (
    <Dialog
      open={vistaPrevia !== null}
      onOpenChange={(abierto) => !abierto && !ejecutando && onCancelar()}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar corrección de cédula</DialogTitle>
          <DialogDescription>
            {vistaPrevia?.trabajador.nombre} ({vistaPrevia?.trabajador.condicion}): cédula{" "}
            {vistaPrevia?.trabajador.cedulaActual} a <strong>{vistaPrevia?.cedulaNueva}</strong>.
          </DialogDescription>
        </DialogHeader>
        {vistaPrevia && (
          <div className="flex flex-col gap-3">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm" data-testid="cuenta-cedula">
              <li>
                {!vistaPrevia.cuenta.existe
                  ? "No tiene cuenta de acceso."
                  : vistaPrevia.cuenta.claveInicialPendiente
                    ? "Aún no ha cambiado su clave inicial: su clave pasará a ser la cédula nueva."
                    : "Ya cambió su clave: la conserva."}
              </li>
              {vistaPrevia.cuenta.existe && (
                <li>Se cerrarán sus sesiones abiertas y deberá ingresar de nuevo.</li>
              )}
              <li>Su información se actualiza en todo el sistema; no se pierde nada.</li>
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Ver detalle ({vistaPrevia.totalRegistros} registros)
              </summary>
              <table className="mt-2 w-full text-sm" data-testid="tabla-afectados">
                <thead>
                  <tr className="text-left">
                    <th className="py-1 font-medium">Dónde</th>
                    <th className="py-1 text-right font-medium">Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {vistaPrevia.afectados.map((a) => (
                    <tr key={a.tabla} className="border-t">
                      <td className="py-1">{a.tabla}</td>
                      <td className="py-1 text-right">{a.registros}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cedula-motivo">
            Motivo (de {MOTIVO_CEDULA_MIN} a {MOTIVO_CEDULA_MAX} caracteres)
          </Label>
          <Textarea
            id="cedula-motivo"
            value={motivo}
            disabled={ejecutando}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cedula-confirmacion">Escriba la cédula nueva para confirmar</Label>
          <Input
            id="cedula-confirmacion"
            inputMode="numeric"
            autoComplete="off"
            value={confirmacion}
            disabled={ejecutando}
            maxLength={9}
            pattern="[0-9]*"
            onChange={(e) => setConfirmacion(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={ejecutando} onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!coincide || !motivoValido || ejecutando}
            onClick={() => onConfirmar(motivo.trim(), confirmacion.trim())}
          >
            {ejecutando && <Loader2 className="size-4 animate-spin mr-1" />}
            Corregir cédula y guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
