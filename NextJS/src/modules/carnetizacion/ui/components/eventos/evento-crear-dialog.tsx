"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Textarea } from "@/shared/ui/components/textarea";
import { crearEventoAction } from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type { Evento } from "@/modules/carnetizacion/domain/entities/evento";

interface EventoCrearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventoCreado: (evento: Evento) => void;
}

export function EventoCrearDialog({
  open,
  onOpenChange,
  onEventoCreado,
}: EventoCrearDialogProps) {
  const [nombre, setNombre] = useState("");
  const [lugar, setLugar] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !lugar.trim() || !fechaInicio || !fechaFin) {
      setError("Por favor completa los campos obligatorios.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const nuevo = await crearEventoAction({
        nombre: nombre.trim(),
        lugar: lugar.trim(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        descripcion: descripcion.trim(),
      });
      onEventoCreado(nuevo);
      onOpenChange(false);
      // Reset
      setNombre("");
      setLugar("");
      setFechaInicio("");
      setFechaFin("");
      setDescripcion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Evento</DialogTitle>
            <DialogDescription>
              Crea un evento institucional para gestionar invitados, categorías, zonas
              y control de acceso con QR.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="nombre">
                Nombre del evento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                placeholder="Ej. Encuentro Anual de Telecomunicaciones 2026"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="lugar">
                Lugar / Sede <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lugar"
                placeholder="Ej. Auditorio Principal FITELVEN"
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="fechaInicio">
                  Fecha y hora inicio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fechaInicio"
                  type="datetime-local"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="fechaFin">
                  Fecha y hora fin <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fechaFin"
                  type="datetime-local"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="descripcion">Descripción / Notas</Label>
              <Textarea
                id="descripcion"
                placeholder="Detalles sobre el aforo, protocolo o instrucciones..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Configuración inicial por defecto:</p>
              <p>• 4 categorías: Invitado especial, Autoridad, Prensa, Staff</p>
              <p>• 3 zonas: Salón principal, Área de prensa, Todas las áreas</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
