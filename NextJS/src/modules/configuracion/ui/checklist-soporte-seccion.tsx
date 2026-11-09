"use client";

/**
 * Checklist de tipos de documento de una sección (O41).
 * Dos marcas por tipo: «Permitido» (se puede subir) y «Exigido» (una regla del
 * sistema lo requiere). Las filas exigidas quedan bloqueadas.
 */
import { useState } from "react";
import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  ReglaChecklistSoporteDTO,
  ReglaTipoSoporteDTO,
  SeccionSoporteDTO,
} from "../application/dtos/reglas-catalogos-dto";

interface EntradaChecklist {
  tipo_soporte_id: number;
  permitido: boolean;
  requerido: boolean;
}

interface Props {
  seccion: SeccionSoporteDTO;
  tipos: ReglaTipoSoporteDTO[];
  filas: ReglaChecklistSoporteDTO[];
  puedeEditar: boolean;
  pendiente: boolean;
  onGuardar: (seccion: string, entradas: EntradaChecklist[]) => void;
}

function estadoInicial(
  tipos: ReglaTipoSoporteDTO[],
  filas: ReglaChecklistSoporteDTO[],
): Record<number, EntradaChecklist> {
  const porTipo = new Map(filas.map((f) => [f.tipo_soporte_id, f]));
  return Object.fromEntries(
    tipos.map((t) => {
      const fila = porTipo.get(t.id);
      return [
        t.id,
        {
          tipo_soporte_id: t.id,
          permitido: fila?.permitido ?? false,
          requerido: fila?.requerido ?? false,
        },
      ];
    }),
  );
}

export function ChecklistSoporteSeccion({
  seccion,
  tipos,
  filas,
  puedeEditar,
  pendiente,
  onGuardar,
}: Props) {
  const [entradas, setEntradas] = useState<Record<number, EntradaChecklist>>(() =>
    estadoInicial(tipos, filas),
  );
  const [version, setVersion] = useState(JSON.stringify(filas));

  // Si el servidor devuelve un checklist nuevo, se realinea el estado local.
  const versionServidor = JSON.stringify(filas);
  if (version !== versionServidor) {
    setVersion(versionServidor);
    setEntradas(estadoInicial(tipos, filas));
  }

  const marca = (tipoId: number, campo: "permitido" | "requerido", valor: boolean) => {
    setEntradas((previo) => {
      const actual = previo[tipoId] ?? {
        tipo_soporte_id: tipoId,
        permitido: false,
        requerido: false,
      };
      const siguiente = {
        ...actual,
        [campo]: valor,
        ...(campo === "requerido" && valor ? { permitido: true } : {}),
        ...(campo === "permitido" && !valor ? { requerido: false } : {}),
      };
      return { ...previo, [tipoId]: siguiente };
    });
  };

  const guardar = () => {
    onGuardar(
      seccion.codigo,
      Object.values(entradas).filter((e) => e.permitido || e.requerido),
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{seccion.nombre}</h3>
          <p className="text-xs text-muted-foreground">
            Marque los documentos que acepta esta sección. «Exigido» los protege de eliminación.
          </p>
        </div>
        {puedeEditar ? (
          <Button type="button" size="sm" onClick={guardar} disabled={pendiente}>
            Guardar checklist
          </Button>
        ) : null}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow>
              <TableHead>Tipo de documento</TableHead>
              <TableHead className="w-[130px] text-center">Permitido</TableHead>
              <TableHead className="w-[130px] text-center">Exigido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-4 text-center text-xs text-muted-foreground">
                  No hay tipos de documento en el catálogo.
                </TableCell>
              </TableRow>
            ) : (
              tipos.map((tipo) => {
                const fila = filas.find((f) => f.tipo_soporte_id === tipo.id);
                const protegido =
                  fila?.requerido === true && (tipo.es_reservado || tipo.es_protegido);
                const estado = entradas[tipo.id] ?? {
                  tipo_soporte_id: tipo.id,
                  permitido: false,
                  requerido: false,
                };
                return (
                  <TableRow key={tipo.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{tipo.nombre}</span>
                        <span className="font-mono text-xs text-muted-foreground">{tipo.codigo}</span>
                        {tipo.es_reservado ? (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="mr-1 size-3" aria-hidden /> Reservado
                          </Badge>
                        ) : null}
                        {protegido ? (
                          <span title="Exigido por una regla del sistema">
                            <Lock className="size-3.5 text-warning" aria-hidden />
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={estado.permitido}
                        disabled={!puedeEditar || pendiente || protegido}
                        onCheckedChange={(valor) => marca(tipo.id, "permitido", valor === true)}
                        aria-label={`Permitir ${tipo.nombre} en ${seccion.nombre}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox
                          checked={estado.requerido}
                          disabled={!puedeEditar || pendiente || protegido}
                          onCheckedChange={(valor) => marca(tipo.id, "requerido", valor === true)}
                          aria-label={`Exigir ${tipo.nombre} en ${seccion.nombre}`}
                        />
                        <Label className="text-xs text-muted-foreground">Regla</Label>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
