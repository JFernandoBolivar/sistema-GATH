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
import { Badge } from "@/shared/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import { importarInvitadosAction } from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type { ResumenImportacion } from "@/modules/carnetizacion/domain/entities/evento";

interface InvitadosImportarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoId: string;
  onImportacionCompletada: () => void;
}

export function InvitadosImportarDialog({
  open,
  onOpenChange,
  eventoId,
  onImportacionCompletada,
}: InvitadosImportarDialogProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivo(file);
    setError(null);
    setResumen(null);

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("archivo", file);
      fd.append("confirmar", "false");
      const prev = await importarInvitadosAction(eventoId, fd);
      setResumen(prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar archivo");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    if (!archivo || !resumen) return;

    try {
      setConfirmando(true);
      setError(null);
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("confirmar", "true");
      await importarInvitadosAction(eventoId, fd);
      onImportacionCompletada();
      onOpenChange(false);
      // Reset
      setArchivo(null);
      setResumen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar importación");
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Asistentes e Invitados</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con las columnas: <code>nombre, categoria, zona, documento, organizacion, correo, telefono, mesa</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          {!resumen && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <input
                type="file"
                id="csv-upload"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {loading ? "Analizando archivo..." : "Seleccionar archivo CSV"}
              </label>
              <p className="text-xs text-muted-foreground">
                Se validará la coherencia de categorías y zonas antes de registrar los invitados.
              </p>
            </div>
          )}

          {resumen && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg text-sm">
                <div className="space-x-3">
                  <span>
                    Total filas: <strong>{resumen.total_filas}</strong>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Válidas: <strong>{resumen.filas_validas}</strong>
                  </span>
                  {resumen.filas_invalidas > 0 && (
                    <span className="text-destructive">
                      Inválidas: <strong>{resumen.filas_invalidas}</strong>
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResumen(null);
                    setArchivo(null);
                  }}
                >
                  Cambiar archivo
                </Button>
              </div>

              <div className="border rounded-md max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Organización</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumen.filas.map((f) => (
                      <TableRow key={f.fila}>
                        <TableCell className="font-mono text-xs">{f.fila}</TableCell>
                        <TableCell className="font-medium">{f.nombre_completo}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{f.categoria_nombre}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{f.zona_nombre}</TableCell>
                        <TableCell className="text-xs">{f.organizacion || "—"}</TableCell>
                        <TableCell>
                          {f.valida ? (
                            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                              Válida
                            </Badge>
                          ) : (
                            <Badge variant="destructive" title={f.error}>
                              Error
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmando}
          >
            Cancelar
          </Button>
          {resumen && (
            <Button
              onClick={handleConfirmar}
              disabled={confirmando || resumen.filas_validas === 0}
            >
              {confirmando
                ? "Registrando..."
                : `Confirmar e Importar (${resumen.filas_validas})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
