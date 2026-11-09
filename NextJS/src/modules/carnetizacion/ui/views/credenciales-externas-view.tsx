"use client";

/**
 * Visitas y contratistas / credencial temporal (O45-A).
 * Formulario + listado + PDF + devolución/anulación + envío por correo.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Mail, Plus, RotateCcw, Search, UserX } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/ui/components/table";

import type { TipoCredencial } from "../../domain/entities/carnet";
import type { CredencialExternaApiItem } from "../../infrastructure/http/credenciales-externas-api";
import {
  anularCredencialExternaAction,
  crearCredencialExternaAction,
  descargarCredencialPdfAction,
  devolverCredencialExternaAction,
  enviarCredencialExternaAction,
  getCredencialesExternasAction,
} from "../../infrastructure/actions/credenciales-externas-actions";
import { buscarPersonalCarnetAction, getTiposCredencialAction } from "../../infrastructure/actions/carnetizacion-actions";

interface Props {
  grupo: "externo" | "temporal";
}

function fechaLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function aIso(valor: string): string {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? new Date().toISOString() : fecha.toISOString();
}

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  // Liberar después de que el navegador inicie la descarga (D7).
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ESTADOS = ["ACTIVA", "DEVUELTA", "ANULADA", "VENCIDA"] as const;

export default function CredencialesExternasView({ grupo }: Props) {
  const temporal = grupo === "temporal";
  const [tipos, setTipos] = useState<TipoCredencial[]>([]);
  const [filas, setFilas] = useState<CredencialExternaApiItem[]>([]);
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [cargando, setCargando] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [tipoCodigo, setTipoCodigo] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    documento: "",
    correo: "",
    empresa: "",
    contrato: "",
    persona: "",
    motivo: "",
    observaciones: "",
    desde: fechaLocal(new Date()),
    hasta: fechaLocal(new Date(Date.now() + 4 * 60 * 60 * 1000)),
    horas: "8",
  });
  const [busqueda, setBusqueda] = useState("");
  const [empleado, setEmpleado] = useState<{ cedula: string; nombre: string } | null>(null);

  const etiquetas = useMemo(
    () => new Map(tipos.map((t) => [t.codigo, t.nombre])),
    [tipos],
  );

  const cargar = (estado = estadoFiltro) => {
    startTransition(async () => {
      setCargando(true);
      const data = await getCredencialesExternasAction(grupo, {
        estado: estado === "TODOS" ? undefined : estado,
      });
      if (Array.isArray(data)) setFilas(data);
      else toast.error(data.error);
      setCargando(false);
    });
  };

  useEffect(() => {
    startTransition(async () => {
      const catalogo = await getTiposCredencialAction(grupo);
      if (Array.isArray(catalogo)) {
        setTipos(catalogo);
        setTipoCodigo((actual) => actual || catalogo[0]?.codigo || "");
      }
      const data = await getCredencialesExternasAction(grupo);
      if (Array.isArray(data)) setFilas(data);
      setCargando(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo]);

  const buscarTrabajador = () => {
    startTransition(async () => {
      const resultado = await buscarPersonalCarnetAction(busqueda.trim());
      if (Array.isArray(resultado) && resultado.length > 0) {
        const emp = resultado[0];
        setEmpleado({ cedula: emp.cedula, nombre: emp.nombre_completo || `${emp.nombres ?? ""} ${emp.apellidos ?? ""}`.trim() });
        setForm((f) => ({ ...f, nombre: emp.nombre_completo || `${emp.nombres ?? ""} ${emp.apellidos ?? ""}`.trim(), documento: emp.cedula }));
      } else {
        setEmpleado(null);
        toast.error("No se encontró un trabajador con esa cédula.");
      }
    });
  };

  const emitir = () => {
    if (!tipoCodigo) {
      toast.error("Seleccione un tipo de credencial.");
      return;
    }
    if (temporal && !empleado) {
      toast.error("Busque y seleccione un trabajador.");
      return;
    }
    if (!temporal && (!form.nombre.trim() || !form.documento.trim() || !form.motivo.trim())) {
      toast.error("Complete nombre, documento y motivo.");
      return;
    }
    startTransition(async () => {
      const hasta = temporal
        ? new Date(Date.now() + Number(form.horas || 8) * 60 * 60 * 1000).toISOString()
        : aIso(form.hasta);
      const resultado = await crearCredencialExternaAction(grupo, {
        tipo_codigo: tipoCodigo,
        nombre: form.nombre,
        documento: form.documento,
        motivo: form.motivo,
        vigencia_desde: temporal ? new Date().toISOString() : aIso(form.desde),
        vigencia_hasta: hasta,
        correo: form.correo,
        empresa: temporal ? "" : form.empresa,
        contrato: temporal ? "" : form.contrato,
        persona_visitada: temporal ? "" : form.persona,
        empleado_cedula: temporal ? empleado?.cedula : null,
        observaciones: form.observaciones,
      });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }
      toast.success(temporal ? "Credencial temporal emitida." : "Credencial emitida.");
      setForm((f) => ({ ...f, nombre: "", documento: "", correo: "", empresa: "", contrato: "", persona: "", motivo: "", observaciones: "" }));
      setEmpleado(null);
      setBusqueda("");
      cargar();
    });
  };

  const accion = (fn: () => Promise<CredencialExternaApiItem | { error: string }>, mensaje: string) => {
    startTransition(async () => {
      const resultado = await fn();
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }
      toast.success(mensaje);
      cargar();
    });
  };

  const descargar = (id: string) => {
    startTransition(async () => {
      const resultado = await descargarCredencialPdfAction(id);
      if (!(resultado instanceof Blob)) {
        toast.error((resultado as { error: string }).error ?? "No fue posible generar el PDF.");
        return;
      }
      descargarBlob(resultado, `credencial-${id}.pdf`);
    });
  };

  const enviar = (fila: CredencialExternaApiItem) => {
    const destino = fila.correo || window.prompt("Correo destinatario:") || "";
    if (!destino.trim()) return;
    startTransition(async () => {
      const resultado = await enviarCredencialExternaAction(fila.id, destino.trim());
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }
      toast.success("Correo encolado en el outbox.");
    });
  };

  const titulo = temporal ? "Credencial temporal" : "Visitantes y contratistas";
  const descripcion = temporal
    ? "Emisión corta por olvido o extravío del carnet institucional."
    : "Registro en recepción con vigencia y control de devolución.";

  return (
    <PageLayout title={titulo} description={descripcion}>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" /> {temporal ? "Nueva credencial temporal" : "Nueva credencial de visita"}
            </CardTitle>
            <CardDescription>
              {temporal
                ? "La credencial se anula sola al cumplir la vigencia."
                : "Los tipos de credencial salen del catálogo configurable."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Tipo de credencial</Label>
              <Select value={tipoCodigo} onValueChange={setTipoCodigo}>
                <SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => <SelectItem key={t.codigo} value={t.codigo}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {temporal ? (
              <>
                <div className="grid gap-1.5">
                  <Label>Cédula del trabajador</Label>
                  <div className="flex gap-2">
                    <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="buscar cédula..." />
                    <Button type="button" variant="outline" onClick={buscarTrabajador} disabled={isPending}>
                      <Search className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Trabajador</Label>
                  <Input value={empleado?.nombre ?? ""} readOnly placeholder="sin seleccionar" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Vigencia (horas)</Label>
                  <Input type="number" min={1} max={72} value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label>Nombre completo</Label>
                  <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Documento</Label>
                  <Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Empresa</Label>
                  <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Contrato / referencia</Label>
                  <Input value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Persona visitada</Label>
                  <Input value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Desde</Label>
                  <Input type="datetime-local" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Hasta</Label>
                  <Input type="datetime-local" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
                </div>
              </>
            )}

            <div className="grid gap-1.5">
              <Label>Correo (opcional)</Label>
              <Input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label>Motivo</Label>
              <Input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={emitir} disabled={isPending}>
                <Plus className="size-4 mr-1" /> Emitir
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Credenciales emitidas</CardTitle>
            <Select value={estadoFiltro} onValueChange={(v) => { setEstadoFiltro(v); cargar(v); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los estados</SelectItem>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {cargando ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titular</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Vigencia hasta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin credenciales.</TableCell></TableRow>
                  ) : filas.map((fila) => (
                    <TableRow key={fila.id}>
                      <TableCell className="font-medium">{fila.nombre}</TableCell>
                      <TableCell>{fila.documento}</TableCell>
                      <TableCell>{etiquetas.get(fila.tipo_credencial) ?? fila.tipo_credencial}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{fila.motivo}</TableCell>
                      <TableCell>{new Date(fila.vigencia_hasta).toLocaleString("es-VE")}</TableCell>
                      <TableCell>
                        <Badge variant={fila.estado === "ACTIVA" ? "default" : "secondary"}>{fila.estado}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="PDF" onClick={() => descargar(fila.id)}><Download className="size-4" /></Button>
                          <Button size="icon" variant="ghost" title="Enviar por correo" onClick={() => enviar(fila)}><Mail className="size-4" /></Button>
                          {!temporal && fila.estado === "ACTIVA" && (
                            <Button size="icon" variant="ghost" title="Devolver" onClick={() => accion(() => devolverCredencialExternaAction(fila.id), "Devolución registrada.")}><RotateCcw className="size-4" /></Button>
                          )}
                          {fila.estado === "ACTIVA" && (
                            <Button size="icon" variant="ghost" title="Anular" onClick={() => accion(() => anularCredencialExternaAction(fila.id), "Credencial anulada.")}><UserX className="size-4" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
