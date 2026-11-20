"use client";

/** Impresión por lote: carnets de trabajadores + credenciales externas (B-6). */
import { useCallback, useEffect, useState, useTransition } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Label } from "@/shared/ui/components/label";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/ui/components/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/shared/ui/components/tabs";

import type { TipoCredencial } from "../../domain/entities/carnet";
import type { ColaImpresionCarnet } from "../../domain/entities/cola-impresion";
import type { CredencialExterna } from "../../domain/entities/credencial-externa";
import { MODO_DUPLEX_POR_DEFECTO, MODOS_DUPLEX, type ModoDuplex } from "../../domain/entities/modo-duplex";
import {
  generarLoteCarnetsTrabajadoresPdfAction,
  getColaImpresionCarnetsAction,
  getTiposCredencialAction,
} from "../../infrastructure/actions/carnetizacion-actions";
import {
  generarLoteCredencialesPdfAction,
  getCredencialesExternasAction,
} from "../../infrastructure/actions/credenciales-externas-actions";

// ---------------------------------------------------------------------------
// Helper: descarga un Blob como archivo en el navegador.
// ---------------------------------------------------------------------------
function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  // Liberar después de que el navegador inicie la descarga (D7).
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Pestaña Trabajadores
// ---------------------------------------------------------------------------
interface TabTrabajadoresProps {
  modoDuplex: ModoDuplex;
}

function TabTrabajadores({ modoDuplex }: TabTrabajadoresProps) {
  const [cola, setCola] = useState<ColaImpresionCarnet[]>([]);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [marcarImpresos, setMarcarImpresos] = useState(true);
  const [isPending, startTransition] = useTransition();

  const cargarCola = useCallback(() => {
    startTransition(async () => {
      setCargando(true);
      const resultado = await getColaImpresionCarnetsAction();
      if (Array.isArray(resultado)) {
        setCola(resultado);
      } else {
        toast.error(resultado.error ?? "No fue posible cargar la cola de impresión.");
      }
      setCargando(false);
    });
  }, []);

  useEffect(() => {
    cargarCola();
  }, [cargarCola]);

  const alternar = (id: number) => {
    setSeleccion((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const todosMarcados = cola.length > 0 && cola.every((c) => seleccion.has(c.carnetId));

  const toggleTodos = () => {
    if (todosMarcados) {
      setSeleccion(new Set());
    } else {
      setSeleccion(new Set(cola.map((c) => c.carnetId)));
    }
  };

  const generar = () => {
    startTransition(async () => {
      // IDs en el orden original de la cola.
      const ids = cola.filter((c) => seleccion.has(c.carnetId)).map((c) => c.carnetId);
      const resultado = await generarLoteCarnetsTrabajadoresPdfAction(ids, modoDuplex, marcarImpresos);
      if (!(resultado instanceof Blob)) {
        toast.error((resultado as { error: string }).error ?? "No fue posible generar el lote.");
        return;
      }
      descargarBlob(resultado, "lote_carnets_trabajadores.pdf");
      toast.success(
        marcarImpresos
          ? "Lote generado y carnets marcados como impresos."
          : "Lote generado.",
      );
      if (marcarImpresos) {
        setSeleccion(new Set());
        cargarCola();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tabla de la cola */}
      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Seleccionar todos los carnets pendientes"
                  checked={todosMarcados}
                  onCheckedChange={toggleTodos}
                />
              </TableHead>
              <TableHead>Titular</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Emitido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cola.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin carnets pendientes de imprimir.
                </TableCell>
              </TableRow>
            ) : cola.map((item) => (
              <TableRow key={item.carnetId}>
                <TableCell>
                  <Checkbox
                    aria-label={`Seleccionar a ${item.nombre}`}
                    checked={seleccion.has(item.carnetId)}
                    onCheckedChange={() => alternar(item.carnetId)}
                  />
                </TableCell>
                <TableCell className="font-medium">{item.nombre}</TableCell>
                <TableCell>{item.cedula}</TableCell>
                <TableCell>{item.cargo}</TableCell>
                <TableCell>{item.departamento}</TableCell>
                <TableCell>{item.motivo}</TableCell>
                <TableCell>
                  {item.fechaEmision
                    ? new Date(item.fechaEmision).toLocaleString("es-VE")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Toolbar de generación */}
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="marcar-impresos"
            checked={marcarImpresos}
            onCheckedChange={(v) => setMarcarImpresos(Boolean(v))}
          />
          <Label htmlFor="marcar-impresos" className="cursor-pointer text-sm">
            Marcar como impresos al generar
          </Label>
        </div>
        <Button
          onClick={generar}
          disabled={isPending || seleccion.size === 0}
        >
          <Download className="size-4 mr-1" aria-hidden />
          Generar lote ({seleccion.size})
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pestaña Visitantes y temporales
// ---------------------------------------------------------------------------
interface TabExternasProps {
  modoDuplex: ModoDuplex;
}

type FilaExterna = CredencialExterna & { grupo: "externo" | "temporal" };

function TabExternas({ modoDuplex }: TabExternasProps) {
  const [tipos, setTipos] = useState<TipoCredencial[]>([]);
  const [filas, setFilas] = useState<FilaExterna[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [grupo, setGrupo] = useState("TODOS");
  const [cargando, setCargando] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const catalogo = await getTiposCredencialAction();
      if (Array.isArray(catalogo)) setTipos(catalogo);
      const [externas, temporales] = await Promise.all([
        getCredencialesExternasAction("externo"),
        getCredencialesExternasAction("temporal"),
      ]);
      const juntas: FilaExterna[] = [];
      if (Array.isArray(externas)) juntas.push(...externas.map((f) => ({ ...f, grupo: "externo" as const })));
      if (Array.isArray(temporales)) juntas.push(...temporales.map((f) => ({ ...f, grupo: "temporal" as const })));
      setFilas(juntas);
      setCargando(false);
    });
  }, []);

  const etiquetas = new Map(tipos.map((t) => [t.codigo, t.nombre]));
  const visibles = filas.filter((f) => grupo === "TODOS" || f.grupo === grupo);

  const alternar = (id: string) => {
    setSeleccion((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const todosMarcados = visibles.length > 0 && visibles.every((f) => seleccion.has(f.id));

  const toggleTodos = () => {
    if (todosMarcados) {
      setSeleccion((actual) => {
        const nuevo = new Set(actual);
        visibles.forEach((f) => nuevo.delete(f.id));
        return nuevo;
      });
    } else {
      setSeleccion((actual) => {
        const nuevo = new Set(actual);
        visibles.forEach((f) => nuevo.add(f.id));
        return nuevo;
      });
    }
  };

  const generar = () => {
    startTransition(async () => {
      const ids = Array.from(seleccion);
      const resultado = await generarLoteCredencialesPdfAction(ids, modoDuplex);
      if (!(resultado instanceof Blob)) {
        toast.error((resultado as { error: string }).error ?? "No fue posible generar el lote.");
        return;
      }
      descargarBlob(resultado, "lote_credenciales.pdf");
      toast.success("Lote generado.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro de grupo */}
      <div className="flex items-center gap-2">
        <Label htmlFor="filtro-grupo" className="shrink-0 text-sm">
          Grupo
        </Label>
        <select
          id="filtro-grupo"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          className="min-h-11 rounded-md border border-input bg-card px-3 text-base"
        >
          <option value="TODOS">Todos los grupos</option>
          <option value="externo">Visitantes / contratistas</option>
          <option value="temporal">Temporales</option>
        </select>
      </div>

      {/* Tabla */}
      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Seleccionar todos los visibles"
                  checked={todosMarcados}
                  onCheckedChange={toggleTodos}
                />
              </TableHead>
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
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin credenciales.
                </TableCell>
              </TableRow>
            ) : visibles.map((fila) => (
              <TableRow key={fila.id}>
                <TableCell>
                  <Checkbox
                    aria-label={`Seleccionar a ${fila.nombre}`}
                    checked={seleccion.has(fila.id)}
                    onCheckedChange={() => alternar(fila.id)}
                  />
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

      {/* Toolbar */}
      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={generar} disabled={isPending || seleccion.size === 0}>
          <Download className="size-4 mr-1" aria-hidden />
          Generar lote ({seleccion.size})
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista principal
// ---------------------------------------------------------------------------
export default function LoteCredencialesView() {
  const [modoDuplex, setModoDuplex] = useState<ModoDuplex>(MODO_DUPLEX_POR_DEFECTO);

  // Contadores de las pestañas se alimentarán desde los hijos; los dejamos
  // estáticos en el título para no requerir estado elevado innecesario.
  return (
    <PageLayout
      title="Impresión por lote"
      description="Genere un PDF con varios carnets o credenciales para imprimir de una sola vez."
    >
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Printer className="size-4" aria-hidden />
              Impresión por lote
            </CardTitle>
            <CardDescription>
              Seleccione los documentos que desea imprimir y elija el modo de dúplex de su impresora.
            </CardDescription>
          </div>

          {/* Selector nativo de modo dúplex */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="modo-duplex" className="text-sm font-medium leading-none">
              Modo de impresión
            </label>
            <select
              id="modo-duplex"
              value={modoDuplex}
              onChange={(e) => setModoDuplex(e.target.value as ModoDuplex)}
              className="min-h-11 rounded-md border border-input bg-card px-3 text-base"
            >
              {MODOS_DUPLEX.map((m) => (
                <option key={m.valor} value={m.valor} title={m.ayuda}>
                  {m.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="trabajadores">
            <TabsList>
              <TabsTrigger value="trabajadores">Trabajadores</TabsTrigger>
              <TabsTrigger value="externas">Visitantes y temporales</TabsTrigger>
            </TabsList>

            <TabsContent value="trabajadores" className="mt-4">
              <TabTrabajadores modoDuplex={modoDuplex} />
            </TabsContent>

            <TabsContent value="externas" className="mt-4">
              <TabExternas modoDuplex={modoDuplex} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
