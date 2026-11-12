"use client";

import { useState } from "react";
import { MapPin, Pencil, Settings, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Input } from "@/shared/ui/components/input";
import {
  actualizarCategoriaEventoAction,
  actualizarZonaEventoAction,
  crearCategoriaEventoAction,
  crearZonaEventoAction,
  eliminarCategoriaEventoAction,
  eliminarZonaEventoAction,
} from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type { EventoCategoria, EventoZona } from "@/modules/carnetizacion/domain/entities/evento";

interface ZonasCategoriasPanelProps {
  eventoId: string;
  categorias: EventoCategoria[];
  zonas: EventoZona[];
  /** Se llama tras cada cambio para que el hub recargue las listas. */
  onCambio: (mensaje: string) => void;
}

type Edicion = { tipo: "categoria" | "zona"; id: string; nombre: string; color: string; codigo: string };

export function ZonasCategoriasPanel({ eventoId, categorias, zonas, onCambio }: ZonasCategoriasPanelProps) {
  const [catNombre, setCatNombre] = useState("");
  const [catColor, setCatColor] = useState("#001f3f");
  const [zonaNombre, setZonaNombre] = useState("");
  const [zonaCodigo, setZonaCodigo] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [porEliminar, setPorEliminar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ejecutar = async (accion: () => Promise<unknown>, mensaje: string) => {
    setError(null);
    try {
      await accion();
      setEdicion(null);
      setPorEliminar(null);
      onCambio(mensaje);
    } catch (err) {
      setPorEliminar(null);
      setError(err instanceof Error ? err.message : "No fue posible completar la acción.");
    }
  };

  const crearCategoria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNombre.trim()) return;
    void ejecutar(async () => {
      await crearCategoriaEventoAction(eventoId, { nombre: catNombre.trim(), color_primario: catColor });
      setCatNombre("");
    }, "Categoría agregada.");
  };

  const crearZona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zonaNombre.trim()) return;
    void ejecutar(async () => {
      await crearZonaEventoAction(eventoId, {
        nombre: zonaNombre.trim(),
        codigo: zonaCodigo.trim() || undefined,
      });
      setZonaNombre("");
      setZonaCodigo("");
    }, "Zona agregada.");
  };

  const guardarEdicion = () => {
    if (!edicion || !edicion.nombre.trim()) return;
    if (edicion.tipo === "categoria") {
      void ejecutar(
        () =>
          actualizarCategoriaEventoAction(edicion.id, {
            nombre: edicion.nombre.trim(),
            color_primario: edicion.color,
          }),
        "Categoría actualizada."
      );
    } else {
      void ejecutar(
        () =>
          actualizarZonaEventoAction(edicion.id, {
            nombre: edicion.nombre.trim(),
            codigo: edicion.codigo.trim(),
          }),
        "Zona actualizada."
      );
    }
  };

  const filaEdicion = (e: Edicion) => (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Nombre"
        value={e.nombre}
        onChange={(ev) => setEdicion({ ...e, nombre: ev.target.value })}
        className="h-8 min-w-32 flex-1 text-xs"
      />
      {e.tipo === "categoria" ? (
        <Input
          type="color"
          aria-label="Color"
          value={e.color}
          onChange={(ev) => setEdicion({ ...e, color: ev.target.value })}
          className="h-8 w-12 p-0.5"
        />
      ) : (
        <Input
          aria-label="Código"
          value={e.codigo}
          onChange={(ev) => setEdicion({ ...e, codigo: ev.target.value })}
          className="h-8 w-24 font-mono text-xs"
        />
      )}
      <Button type="button" size="sm" className="h-8 text-xs" onClick={guardarEdicion}>
        Guardar
      </Button>
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEdicion(null)}>
        Cancelar
      </Button>
    </div>
  );

  const acciones = (tipo: "categoria" | "zona", id: string, nombre: string, edit: Edicion) => (
    <div className="flex items-center gap-1">
      {porEliminar === id ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={() =>
              void ejecutar(
                () => (tipo === "categoria" ? eliminarCategoriaEventoAction(id) : eliminarZonaEventoAction(id)),
                tipo === "categoria" ? "Categoría eliminada." : "Zona eliminada."
              )
            }
          >
            Confirmar
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPorEliminar(null)}>
            No
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={`Renombrar ${nombre}`}
            onClick={() => setEdicion(edit)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-destructive"
            aria-label={`Eliminar ${nombre}`}
            onClick={() => setPorEliminar(id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-border/60 bg-card shadow-xs">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Settings className="size-4 text-primary" />
              Categorías de acreditación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <form onSubmit={crearCategoria} className="flex gap-2">
              <Input
                placeholder="Nombre de nueva categoría..."
                value={catNombre}
                onChange={(e) => setCatNombre(e.target.value)}
                className="h-9 text-xs"
              />
              <Input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="h-9 w-12 p-0.5"
                title="Color distintivo"
                aria-label="Color de la nueva categoría"
              />
              <Button type="submit" size="sm" className="h-9 px-3 text-xs font-semibold">
                Agregar categoría
              </Button>
            </form>
            <div className="space-y-2 border-t border-border/40 pt-2">
              {categorias.map((c) => (
                <div key={c.id} className="rounded-lg border border-border/40 bg-muted/40 p-2">
                  {edicion?.id === c.id ? (
                    filaEdicion(edicion)
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="size-3.5 rounded-full" style={{ backgroundColor: c.color_primario || "#001f3f" }} />
                        <span className="font-semibold text-foreground">{c.nombre}</span>
                      </div>
                      {acciones("categoria", c.id, c.nombre, {
                        tipo: "categoria",
                        id: c.id,
                        nombre: c.nombre,
                        color: c.color_primario || "#001f3f",
                        codigo: "",
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-xs">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <MapPin className="size-4 text-primary" />
              Zonas y puertas de acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <form onSubmit={crearZona} className="flex gap-2">
              <Input
                placeholder="Nombre de zona (ej: Auditorio)..."
                value={zonaNombre}
                onChange={(e) => setZonaNombre(e.target.value)}
                className="h-9 flex-1 text-xs"
              />
              <Input
                placeholder="Cód (ej: ZON-A)"
                value={zonaCodigo}
                onChange={(e) => setZonaCodigo(e.target.value)}
                className="h-9 w-24 font-mono text-xs"
              />
              <Button type="submit" size="sm" className="h-9 px-3 text-xs font-semibold">
                Agregar zona
              </Button>
            </form>
            <div className="space-y-2 border-t border-border/40 pt-2">
              {zonas.map((z) => (
                <div key={z.id} className="rounded-lg border border-border/40 bg-muted/40 p-2">
                  {edicion?.id === z.id ? (
                    filaEdicion(edicion)
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{z.nombre}</span>
                        {z.codigo && <span className="font-mono text-[10px] text-muted-foreground">{z.codigo}</span>}
                      </div>
                      {acciones("zona", z.id, z.nombre, {
                        tipo: "zona",
                        id: z.id,
                        nombre: z.nombre,
                        color: "",
                        codigo: z.codigo || "",
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
