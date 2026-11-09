"use client";

/** Impresión por lote de credenciales externas y temporales (O45-A). */
import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/ui/components/table";

import type { TipoCredencial } from "../../domain/entities/carnet";
import type { CredencialExternaApiItem } from "../../infrastructure/http/credenciales-externas-api";
import { generarLoteCredencialesPdfAction, getCredencialesExternasAction } from "../../infrastructure/actions/credenciales-externas-actions";
import { getTiposCredencialAction } from "../../infrastructure/actions/carnetizacion-actions";

type Fila = CredencialExternaApiItem & { grupo: "externo" | "temporal" };

export default function LoteCredencialesView() {
  const [tipos, setTipos] = useState<TipoCredencial[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [grupo, setGrupo] = useState("TODOS");
  const [cargando, setCargando] = useState(true);
  const [isPending, startTransition] = useTransition();

  const etiquetas = useMemo(() => new Map(tipos.map((t) => [t.codigo, t.nombre])), [tipos]);

  useEffect(() => {
    startTransition(async () => {
      const catalogo = await getTiposCredencialAction();
      if (Array.isArray(catalogo)) setTipos(catalogo);
      const [externas, temporales] = await Promise.all([
        getCredencialesExternasAction("externo"),
        getCredencialesExternasAction("temporal"),
      ]);
      const juntas: Fila[] = [];
      if (Array.isArray(externas)) juntas.push(...externas.map((f) => ({ ...f, grupo: "externo" as const })));
      if (Array.isArray(temporales)) juntas.push(...temporales.map((f) => ({ ...f, grupo: "temporal" as const })));
      setFilas(juntas);
      setCargando(false);
    });
  }, []);

  const visibles = filas.filter((f) => grupo === "TODOS" || f.grupo === grupo);

  const alternar = (id: string) => {
    setSeleccion((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const generar = () => {
    if (seleccion.size === 0) {
      toast.error("Seleccione al menos una credencial.");
      return;
    }
    startTransition(async () => {
      const resultado = await generarLoteCredencialesPdfAction(Array.from(seleccion));
      if (!(resultado instanceof Blob)) {
        toast.error((resultado as { error: string }).error ?? "No fue posible generar el lote.");
        return;
      }
      const url = URL.createObjectURL(resultado);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "lote_credenciales.pdf";
      enlace.click();
      // Liberar después de que el navegador inicie la descarga (D7).
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Lote generado.");
    });
  };

  return (
    <PageLayout title="Impresión por lote" description="Hojas A4 con varias credenciales y marcas de corte.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Printer className="size-4" /> Credenciales disponibles</CardTitle>
            <CardDescription>Seleccione las credenciales y genere el PDF del lote.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={grupo} onValueChange={setGrupo}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los grupos</SelectItem>
                <SelectItem value="externo">Visitantes / contratistas</SelectItem>
                <SelectItem value="temporal">Temporales</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generar} disabled={isPending || seleccion.size === 0}>
              <Download className="size-4 mr-1" /> Generar lote ({seleccion.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Vigencia hasta</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin credenciales.</TableCell></TableRow>
                ) : visibles.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell>
                      <Checkbox checked={seleccion.has(fila.id)} onCheckedChange={() => alternar(fila.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{fila.nombre}</TableCell>
                    <TableCell>{fila.documento}</TableCell>
                    <TableCell>{etiquetas.get(fila.tipo_credencial) ?? fila.tipo_credencial}</TableCell>
                    <TableCell>{fila.grupo === "temporal" ? "Temporal" : "Externo"}</TableCell>
                    <TableCell>{new Date(fila.vigencia_hasta).toLocaleString("es-VE")}</TableCell>
                    <TableCell>{fila.estado}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
