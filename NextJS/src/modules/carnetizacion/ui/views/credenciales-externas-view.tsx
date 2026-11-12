"use client";

/**
 * Visitas y contratistas / credencial temporal (O45-A).
 * Formulario + listado + PDF + devolución/anulación + envío por correo.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Download, Mail, Plus, RotateCcw, UserX } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/components/command";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/ui/components/table";

import type { EmployeeCarnet, TipoCredencial } from "../../domain/entities/carnet";
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

function inicialesNombre(nombre: string): string {
  const partes = nombre.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  const ini = `${partes[0]?.charAt(0) ?? ""}${partes[1]?.charAt(0) ?? ""}`.toUpperCase();
  return ini || "?";
}

function AvatarTrabajador({ cedula, nombre }: { cedula: string; nombre: string }) {
  const [sinFoto, setSinFoto] = useState(false);
  const clase =
    "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary";
  if (sinFoto || !cedula) {
    return (
      <div aria-hidden="true" className={clase}>
        {inicialesNombre(nombre)}
      </div>
    );
  }
  return (
    <div className={clase}>
      {/* Foto autenticada del mismo origen; next/image no reenvia cookies. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/v1/personal/${encodeURIComponent(cedula)}/foto/`}
        alt={`Foto de ${nombre}`}
        className="size-full object-cover"
        onError={() => setSinFoto(true)}
      />
    </div>
  );
}

/** Resumen del trabajador elegido; en móvil se apila. */
function TarjetaTrabajador({ emp, onCambiar }: { emp: EmployeeCarnet; onCambiar: () => void }) {
  return (
    <div
      data-testid="tarjeta-trabajador"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
    >
      <AvatarTrabajador cedula={emp.cedula} nombre={emp.nombre_completo} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="break-words text-base font-bold text-foreground">{emp.nombre_completo}</p>
        <p className="text-sm text-muted-foreground">C.I. {emp.cedula}</p>
        <p className="text-sm text-foreground">{emp.cargo || "Sin cargo registrado"}</p>
        <p className="text-sm text-muted-foreground">{emp.departamento || "Sin oficina registrada"}</p>
        <p className="break-all text-sm text-muted-foreground">{emp.correo || "Sin correo registrado"}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <Badge variant="secondary">ACTIVO</Badge>
        <Button type="button" variant="outline" onClick={onCambiar} className="min-h-11">
          Cambiar
        </Button>
      </div>
    </div>
  );
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
  const [empleado, setEmpleado] = useState<EmployeeCarnet | null>(null);

  // Persona visitada: debe ser un trabajador registrado en el sistema.
  const [personaEmpleado, setPersonaEmpleado] = useState<EmployeeCarnet | null>(null);
  const [busquedaPersona, setBusquedaPersona] = useState("");
  const [resultadosPersona, setResultadosPersona] = useState<EmployeeCarnet[]>([]);
  const [buscandoPersona, setBuscandoPersona] = useState(false);
  // Último texto cuya búsqueda ya terminó (para distinguir «sin resultados» de «aún no buscó»).
  const [ultimaBusquedaPersona, setUltimaBusquedaPersona] = useState<string | null>(null);
  const [personaAbierta, setPersonaAbierta] = useState(false);

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

  // Búsqueda de la persona visitada entre los trabajadores registrados.
  useEffect(() => {
    if (busquedaPersona.trim().length < 2) {
      setResultadosPersona([]);
      setUltimaBusquedaPersona(null);
      return;
    }
    let activo = true;
    const timer = setTimeout(async () => {
      setBuscandoPersona(true);
      const texto = busquedaPersona.trim();
      try {
        const res = await buscarPersonalCarnetAction(texto);
        if (activo && Array.isArray(res)) setResultadosPersona(res as EmployeeCarnet[]);
        else if (activo) setResultadosPersona([]);
      } catch {
        if (activo) setResultadosPersona([]);
      } finally {
        if (activo) {
          setBuscandoPersona(false);
          setUltimaBusquedaPersona(texto);
        }
      }
    }, 300);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [busquedaPersona]);

  const seleccionarPersona = (emp: EmployeeCarnet) => {
    setPersonaEmpleado(emp);
    setForm((f) => ({ ...f, persona: `${emp.nombre_completo} (C.I. ${emp.cedula})` }));
    setBusquedaPersona(emp.nombre_completo);
    setPersonaAbierta(false);
  };

  const seleccionarTrabajador = (emp: EmployeeCarnet) => {
    setEmpleado(emp);
    setForm((f) => ({
      ...f,
      nombre: emp.nombre_completo,
      documento: emp.cedula,
      correo: emp.correo || "",
    }));
    setBusquedaPersona("");
    setPersonaAbierta(false);
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
    if (!temporal && !personaEmpleado) {
      toast.error("Seleccione la persona visitada del listado de trabajadores.");
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
      setPersonaEmpleado(null);
      setBusquedaPersona("");
      setResultadosPersona([]);
      setUltimaBusquedaPersona(null);
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

  const selectorTrabajador = ({
    id,
    seleccionado,
    onSelect,
    etiqueta,
  }: {
    id: string;
    seleccionado: EmployeeCarnet | null;
    onSelect: (emp: EmployeeCarnet) => void;
    etiqueta: string | null;
  }) => (
                      <Popover open={personaAbierta} onOpenChange={setPersonaAbierta}>
                        <PopoverTrigger asChild>
                          <Button
                            id={id}
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={personaAbierta}
                            className="h-11 w-full justify-between gap-2 text-sm font-normal"
                          >
                            <span
                              className={cn(
                                "truncate text-left",
                                !etiqueta && "text-muted-foreground",
                              )}
                            >
                              {etiqueta ?? "Buscar trabajador por nombre o cédula…"}
                            </span>
                            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-(--radix-popover-trigger-width) min-w-[320px] p-0"
                          align="start"
                        >
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Buscar trabajador…"
                              value={busquedaPersona}
                              onValueChange={setBusquedaPersona}
                            />
                            <CommandList className="max-h-64 overflow-y-auto">
                              <CommandEmpty>
                                {busquedaPersona.trim().length < 2
                                  ? "Escriba al menos 2 caracteres del nombre o la cédula"
                                  : buscandoPersona || ultimaBusquedaPersona !== busquedaPersona.trim()
                                    ? "Buscando…"
                                    : "No se encontraron trabajadores."}
                              </CommandEmpty>
                              <CommandGroup>
                                {resultadosPersona.map((emp) => (
                                  <CommandItem
                                    key={emp.cedula}
                                    value={emp.cedula}
                                    onSelect={() => onSelect(emp)}
                                    className="cursor-pointer"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium">
                                        {emp.nombre_completo}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        C.I. {emp.cedula}
                                        {emp.cargo ? ` · ${emp.cargo}` : ""}
                                      </p>
                                    </div>
                                    {seleccionado?.cedula === emp.cedula && (
                                      <Check className="size-4 shrink-0 text-primary" aria-hidden />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
  );

  const titulo = temporal ? "Credencial temporal" : "Visitantes y contratistas";
  const descripcion = temporal
    ? "Emisión corta por olvido o extravío del carnet institucional."
    : "Registro en recepción con vigencia y control de devolución.";

  return (
    <PageLayout title={titulo} description={descripcion}>
      <div className="flex flex-col gap-4">
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="size-5 text-primary" aria-hidden />
              {temporal ? "Nueva credencial temporal" : "Nueva credencial de visita"}
            </CardTitle>
            <CardDescription>
              {temporal
                ? "La credencial se anula sola al cumplir la vigencia."
                : "Registre la visita y emita la credencial con su vigencia."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-4 sm:p-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Credencial</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {tipos.length === 1 ? (
                  <div className="space-y-1.5">
                    <p className="text-sm text-muted-foreground">Tipo de credencial</p>
                    <p className="flex min-h-11 items-center text-base font-semibold text-foreground">
                      {tipos[0].nombre}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="cred-tipo">Tipo de credencial</Label>
                    <Select value={tipoCodigo} onValueChange={setTipoCodigo}>
                      <SelectTrigger id="cred-tipo" className="h-11 w-full">
                        <SelectValue placeholder="Seleccione un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {tipos.map((t) => (
                          <SelectItem key={t.codigo} value={t.codigo}>
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!temporal && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cred-motivo">Motivo de la visita</Label>
                    <Input
                      id="cred-motivo"
                      value={form.motivo}
                      onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                      placeholder="Ej.: reunión, mantenimiento, entrevista"
                      className="h-11"
                    />
                  </div>
                )}
              </div>
            </section>

            {temporal ? (
              <section className="space-y-3 border-t border-border pt-5">
                <h3 className="text-sm font-semibold text-foreground">Trabajador</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="cred-trabajador">Trabajador</Label>
                    {selectorTrabajador({
                      id: "cred-trabajador",
                      seleccionado: empleado,
                      onSelect: seleccionarTrabajador,
                      etiqueta: empleado ? `${empleado.nombre_completo} · V-${empleado.cedula}` : null,
                    })}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cred-horas">Vigencia (horas)</Label>
                    <Input
                      id="cred-horas"
                      type="number"
                      min={1}
                      max={72}
                      value={form.horas}
                      onChange={(e) => setForm({ ...form, horas: e.target.value })}
                      className="h-11"
                    />
                  </div>
                </div>
                {empleado ? (
                  <TarjetaTrabajador
                    emp={empleado}
                    onCambiar={() => {
                      setEmpleado(null);
                      setPersonaAbierta(true);
                    }}
                  />
                ) : null}
              </section>
            ) : (
              <>
                <section className="space-y-3 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold text-foreground">Datos del visitante</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-nombre">Nombre completo</Label>
                      <Input
                        id="cred-nombre"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        placeholder="Nombres y apellidos"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-documento">Documento</Label>
                      <Input
                        id="cred-documento"
                        value={form.documento}
                        onChange={(e) => setForm({ ...form, documento: e.target.value })}
                        placeholder="Cédula o pasaporte"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-empresa">Empresa</Label>
                      <Input
                        id="cred-empresa"
                        value={form.empresa}
                        onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                        placeholder="Empresa u organización"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-correo">Correo del visitante (opcional)</Label>
                      <Input
                        id="cred-correo"
                        type="email"
                        value={form.correo}
                        onChange={(e) => setForm({ ...form, correo: e.target.value })}
                        placeholder="correo@ejemplo.com"
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Se le enviará la credencial a este correo
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-contrato">Contrato / referencia</Label>
                      <Input
                        id="cred-contrato"
                        value={form.contrato}
                        onChange={(e) => setForm({ ...form, contrato: e.target.value })}
                        placeholder="Contrato, orden o referencia"
                        className="h-11"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold text-foreground">Detalle de la visita</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-persona">Persona visitada</Label>
                      {selectorTrabajador({
                        id: "cred-persona",
                        seleccionado: personaEmpleado,
                        onSelect: seleccionarPersona,
                        etiqueta: personaEmpleado
                          ? `${personaEmpleado.nombre_completo} · V-${personaEmpleado.cedula}`
                          : null,
                      })}
                      <p className="text-xs text-muted-foreground">
                        Solo se aceptan trabajadores registrados en el sistema.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-desde">Desde</Label>
                      <Input
                        id="cred-desde"
                        type="datetime-local"
                        value={form.desde}
                        onChange={(e) => setForm({ ...form, desde: e.target.value })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-hasta">Hasta</Label>
                      <Input
                        id="cred-hasta"
                        type="datetime-local"
                        value={form.hasta}
                        onChange={(e) => setForm({ ...form, hasta: e.target.value })}
                        className="h-11"
                      />
                    </div>
                  </div>
                </section>
              </>
            )}

            {temporal ? (
              <section className="space-y-3 border-t border-border pt-5">
                <h3 className="text-sm font-semibold text-foreground">Detalle de la emisión</h3>
                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cred-motivo-temporal">Motivo</Label>
                    <Input
                      id="cred-motivo-temporal"
                      value={form.motivo}
                      onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                      placeholder="Motivo de la emisión temporal"
                      className="h-11"
                    />
                  </div>
                </div>
              </section>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {temporal
                  ? "La credencial temporal se anula sola al cumplir las horas indicadas."
                  : "La credencial se emite con la vigencia indicada y queda registrada en el control de visitantes."}
              </p>
              <Button onClick={emitir} disabled={isPending} className="min-h-11 shrink-0">
                <Plus className="size-4" aria-hidden />
                Emitir credencial
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
