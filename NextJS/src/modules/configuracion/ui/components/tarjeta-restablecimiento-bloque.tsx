"use client";

/**
 * Tarjeta «Restablecer contraseñas en bloque» (U2) de Parámetros: título, descripción y el
 * botón que abre el asistente de 3 pasos en un Dialog. Solo el superadministrador puede
 * (el asistente avisa ante un 403).
 */
import { useState } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { AsistenteRestablecimientoBloque } from "./asistente-restablecimiento-bloque";

export function TarjetaRestablecimientoBloque() {
  const [abierto, setAbierto] = useState(false);

  return (
    <Card data-testid="tarjeta-restablecimiento-bloque">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" aria-hidden="true" /> Restablecer contraseñas en bloque
          </CardTitle>
          <CardDescription>
            Repone la cédula como clave y abre un nuevo plazo para quienes no pudieron ingresar.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
          Restablecer contraseñas en bloque
        </Button>
      </CardHeader>
      {abierto && (
        <AsistenteRestablecimientoBloque abierto={abierto} onCerrar={() => setAbierto(false)} />
      )}
    </Card>
  );
}
