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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Switch } from "@/shared/ui/components/switch";
import { Textarea } from "@/shared/ui/components/textarea";
import { crearInvitadoAction } from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type {
  EventoCategoria,
  EventoInvitado,
  EventoZona,
} from "@/modules/carnetizacion/domain/entities/evento";

interface InvitadoCrearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoId: string;
  categorias: EventoCategoria[];
  zonas: EventoZona[];
  onInvitadoCreado: (invitado: EventoInvitado) => void;
}

export function InvitadoCrearDialog({
  open,
  onOpenChange,
  eventoId,
  categorias,
  zonas,
  onInvitadoCreado,
}: InvitadoCrearDialogProps) {
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [documento, setDocumento] = useState("");
  const [organizacion, setOrganizacion] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id || "");
  const [zonaId, setZonaId] = useState(zonas[0]?.id || "");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mesa, setMesa] = useState("");
  const [esAcompanante, setEsAcompanante] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim() || !categoriaId || !zonaId) {
      setError("El nombre completo, la categoría y la zona son obligatorios.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const nuevo = await crearInvitadoAction(eventoId, {
        nombre_completo: nombreCompleto.trim(),
        categoria_id: categoriaId,
        zona_id: zonaId,
        documento_identidad: documento.trim(),
        organizacion: organizacion.trim(),
        correo: correo.trim(),
        telefono: telefono.trim(),
        mesa: mesa.trim(),
        es_acompanante: esAcompanante,
        observaciones: observaciones.trim(),
      });
      onInvitadoCreado(nuevo);
      onOpenChange(false);
      // Reset
      setNombreCompleto("");
      setDocumento("");
      setOrganizacion("");
      setCorreo("");
      setTelefono("");
      setMesa("");
      setEsAcompanante(false);
      setObservaciones("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar invitado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Invitado</DialogTitle>
            <DialogDescription>
              Agrega un asistente individualmente con su categoría de acreditación y
              zona asignada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="inv-nombre">
                Nombre y Apellido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inv-nombre"
                placeholder="Ej. Ing. Carlos Mendoza"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inv-doc">Cédula / Documento</Label>
                <Input
                  id="inv-doc"
                  placeholder="Ej. V-12345678"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="inv-org">Organización / Empresa</Label>
                <Input
                  id="inv-org"
                  placeholder="Ej. Conatel / Cantv"
                  value={organizacion}
                  onChange={(e) => setOrganizacion(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>
                  Categoría <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={categoriaId || categorias[0]?.id || ""}
                  onValueChange={setCategoriaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>
                  Zona permitida <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={zonaId || zonas[0]?.id || ""}
                  onValueChange={setZonaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {zonas.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inv-correo">Correo electrónico</Label>
                <Input
                  id="inv-correo"
                  type="email"
                  placeholder="invitado@correo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="inv-mesa">Mesa / Ubicación</Label>
                <Input
                  id="inv-mesa"
                  placeholder="Ej. Mesa 4 / Fila B"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="acompanante-switch"
                checked={esAcompanante}
                onCheckedChange={setEsAcompanante}
              />
              <Label htmlFor="acompanante-switch" className="text-sm font-normal">
                Es acompañante vinculado a un trabajador institucional
              </Label>
            </div>

            <div className="space-y-1">
              <Label htmlFor="inv-obs">Observaciones</Label>
              <Textarea
                id="inv-obs"
                placeholder="Requerimientos especiales, dietas, protocolo..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
              />
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
              {loading ? "Guardando..." : "Guardar Invitado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
