"use client";

/**
 * Detalle de un usuario (D4): cambiar rol, activar/desactivar con motivo,
 * restablecer acceso, cambiar correo de acceso (pantalla pendiente de D8),
 * overrides allow/deny y permiso efectivo calculado en el servidor.
 *
 * El frontend nunca calcula el permiso efectivo: muestra `permisos.efectivos`
 * tal como lo devuelve el motor IAM del backend (un deny siempre gana).
 */
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, KeyRound, Loader2, Mail, Save, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type { PermisoDTO, RolDTO, UsuarioDetalleDTO } from "../application/dtos/usuario-dto";
import {
  cambiarCorreoAccesoAction,
  cambiarEstadoUsuarioAction,
  editarUsuarioAction,
  getPermisosAction,
  getRolesAction,
  guardarOverridesAction,
  obtenerDetalleUsuarioAction,
  restablecerAccesoAction,
} from "../infrastructure/actions/usuario-actions";

function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "—" : fecha.toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
}

function porModulo(codigos: string[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const codigo of codigos) {
    const modulo = codigo.split(".")[0] ?? "otros";
    mapa.set(modulo, [...(mapa.get(modulo) ?? []), codigo]);
  }
  return mapa;
}

export default function UsuarioDetallePage({ id }: { id: number }) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = tienePermiso(permisos, "identidad.ver_usuarios");
  const puedeEditar = tienePermiso(permisos, "identidad.editar_usuarios");
  const puedeEstado = tienePermiso(permisos, "identidad.desactivar_usuarios");
  const puedeRestablecer = tienePermiso(permisos, "identidad.restablecer_acceso");
  const puedeCorreo = tienePermiso(permisos, "identidad.cambiar_correo_acceso");
  const puedeOverrides = tienePermiso(permisos, "identidad.gestionar_permisos_individuales");

  const [detalle, setDetalle] = useState<UsuarioDetalleDTO | null>(null);
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [catalogo, setCatalogo] = useState<PermisoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, startTransition] = useTransition();

  const [rolId, setRolId] = useState<string>("");
  const [motivoRol, setMotivoRol] = useState("");
  const [motivoEstado, setMotivoEstado] = useState("");
  const [motivoAcceso, setMotivoAcceso] = useState("");
  const [fuenteCorreo, setFuenteCorreo] = useState<"INSTITUCIONAL" | "ALTERNATIVO" | "OTRO">("INSTITUCIONAL");
  const [correoOtro, setCorreoOtro] = useState("");
  const [motivoCorreo, setMotivoCorreo] = useState("");
  const [allow, setAllow] = useState<string[]>([]);
  const [deny, setDeny] = useState<string[]>([]);
  const [motivoOverrides, setMotivoOverrides] = useState("");
  const [nuevoAllow, setNuevoAllow] = useState("__none");
  const [nuevoDeny, setNuevoDeny] = useState("__none");
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});

  const mensajeDe = (
    errores: Record<string, string[]> | undefined,
    ...claves: string[]
  ): string | undefined => {
    for (const clave of claves) {
      const mensaje = errores?.[clave]?.join(" ");
      if (mensaje) return mensaje;
    }
    return undefined;
  };

  const ponerError = (campo: string, mensaje: string | undefined) => {
    if (!mensaje) return false;
    setErroresCampo((previo) => ({ ...previo, [campo]: mensaje }));
    return true;
  };

  const limpiarError = (campo: string) =>
    setErroresCampo((previo) => {
      if (!previo[campo]) return previo;
      const copia = { ...previo };
      delete copia[campo];
      return copia;
    });

  const cargar = () => {
    startTransition(async () => {
      setError(null);
      try {
        const datos = await obtenerDetalleUsuarioAction(id);
        if (datos && typeof datos === "object" && "error" in datos) {
          setError((datos as { error: string }).error);
          return;
        }
        const d = datos as UsuarioDetalleDTO;
        setDetalle(d);
        setRolId(d.rolId ? String(d.rolId) : "__none");
        setAllow(d.permisos.allow);
        setDeny(d.permisos.deny);
        if (d.condicion?.toUpperCase() === "PASIVO") {
          setFuenteCorreo("ALTERNATIVO");
        } else {
          setFuenteCorreo("INSTITUCIONAL");
        }
      } catch {
        setError("No fue posible cargar el usuario.");
      }
    });
  };

  useEffect(() => {
    if (!puedeVer) return;
    cargar();
    const catalogos: Promise<[RolDTO[], PermisoDTO[]]> = puedeOverrides
      ? Promise.all([getRolesAction(), getPermisosAction()])
      : getRolesAction().then((r) => [r, [] as PermisoDTO[]] as [RolDTO[], PermisoDTO[]]);
    catalogos
      .then(([r, p]) => {
        setRoles(r);
        setCatalogo(p);
      })
      .catch(() => setError("No fue posible cargar los catálogos."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeVer, puedeOverrides, id]);

  if (!puedeVer) {
    return (
      <section className="px-6 py-4">
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No tiene el permiso «identidad.ver_usuarios» para consultar este usuario.
        </p>
      </section>
    );
  }

  const guardarRol = () => {
    if (!detalle) return;
    if (motivoRol.trim().length < 10) {
      ponerError("motivoRol", "Indique el motivo del cambio de rol (al menos 10 caracteres).");
      return;
    }
    limpiarError("motivoRol");
    startTransition(async () => {
      const resultado = await editarUsuarioAction(detalle.id, {
        rolId: rolId === "__none" ? null : Number(rolId),
        motivo: motivoRol,
      });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const fallo = resultado as { error: string; errores?: Record<string, string[]> };
        if (!ponerError("motivoRol", mensajeDe(fallo.errores, "motivo"))) toast.error(fallo.error);
        return;
      }
      toast.success("Rol actualizado.");
      setMotivoRol("");
      cargar();
    });
  };

  const cambiarEstado = (nuevo: boolean) => {
    if (!detalle) return;
    if (motivoEstado.trim().length < 10) {
      ponerError("motivoEstado", "Indique el motivo (al menos 10 caracteres).");
      return;
    }
    limpiarError("motivoEstado");
    startTransition(async () => {
      const resultado = await cambiarEstadoUsuarioAction(detalle.id, nuevo, motivoEstado);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const fallo = resultado as { error: string; errores?: Record<string, string[]> };
        if (!ponerError("motivoEstado", mensajeDe(fallo.errores, "motivo"))) toast.error(fallo.error);
        return;
      }
      toast.success(nuevo ? "Cuenta activada." : "Cuenta desactivada.");
      setMotivoEstado("");
      cargar();
    });
  };

  const restablecer = () => {
    if (!detalle) return;
    if (motivoAcceso.trim().length < 10) {
      ponerError("motivoAcceso", "Indique el motivo del restablecimiento (al menos 10 caracteres).");
      return;
    }
    limpiarError("motivoAcceso");
    startTransition(async () => {
      const resultado = await restablecerAccesoAction(detalle.id, motivoAcceso);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const fallo = resultado as { error: string; errores?: Record<string, string[]> };
        if (!ponerError("motivoAcceso", mensajeDe(fallo.errores, "motivo"))) toast.error(fallo.error);
      } else {
        toast.success("Acceso restablecido: la contraseña inicial es la cédula.");
        setMotivoAcceso("");
        cargar();
      }
    });
  };

  const cambiarCorreo = () => {
    if (!detalle) return;
    if (motivoCorreo.trim().length < 10) {
      ponerError("motivoCorreo", "Indique el motivo del cambio de correo (al menos 10 caracteres).");
      return;
    }
    limpiarError("motivoCorreo");
    limpiarError("correoOtro");
    startTransition(async () => {
      const resultado = await cambiarCorreoAccesoAction(detalle.cedula, {
        fuente: fuenteCorreo,
        correo: fuenteCorreo === "OTRO" ? correoOtro : undefined,
        motivo: motivoCorreo,
      });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const fallo = resultado as { error: string; errores?: Record<string, string[]> };
        const ubicado =
          ponerError("correoOtro", mensajeDe(fallo.errores, "correo")) ||
          ponerError("motivoCorreo", mensajeDe(fallo.errores, "motivo", "fuente"));
        if (!ubicado) toast.error(fallo.error);
        return;
      }
      toast.success("Correo de acceso actualizado.");
      setCorreoOtro("");
      setMotivoCorreo("");
      cargar();
    });
  };

  const guardarOverrides = () => {
    if (!detalle) return;
    if (motivoOverrides.trim().length < 10) {
      ponerError("motivoOverrides", "Indique el motivo (al menos 10 caracteres).");
      return;
    }
    limpiarError("motivoOverrides");
    startTransition(async () => {
      const resultado = await guardarOverridesAction(detalle.id, { allow, deny, motivo: motivoOverrides });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const fallo = resultado as { error: string; errores?: Record<string, string[]> };
        if (!ponerError("motivoOverrides", mensajeDe(fallo.errores, "motivo"))) toast.error(fallo.error);
        return;
      }
      toast.success("Permisos individuales actualizados.");
      setMotivoOverrides("");
      cargar();
    });
  };

  const opcionesDisponibles = catalogo.filter(
    (p) => !allow.includes(p.codigo) && !deny.includes(p.codigo),
  );

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/usuarios">
            <ArrowLeft className="size-4" aria-hidden="true" /> Volver
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Detalle del usuario</h1>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {cargando && !detalle ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : detalle ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {detalle.nombres} {detalle.apellidos}
              </CardTitle>
              <CardDescription>
                Cédula {detalle.cedula} · {detalle.condicion ?? "SIN ASIGNACIÓN"} ·{" "}
                <Badge variant={detalle.isActive ? "secondary" : "outline"}>
                  {detalle.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Correo de acceso</p>
                <p className="break-words">{detalle.correo ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rol</p>
                <p>{detalle.permisos.rolNombre ?? detalle.rolNombre ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Último acceso</p>
                <p>{fechaLegible(detalle.ultimoAcceso)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contraseña inicial</p>
                <p>{detalle.passwordInicialPendiente ? "Pendiente de cambio" : "No"}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="size-4" aria-hidden="true" /> Rol y estado
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {puedeEditar && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="detalle-rol">Rol</Label>
                    <Select value={rolId} onValueChange={setRolId}>
                      <SelectTrigger id="detalle-rol">
                        <SelectValue placeholder="Seleccione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Sin rol —</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.nombreRol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Field data-invalid={!!erroresCampo.motivoRol}>
                      <Label htmlFor="motivo-rol">Motivo del cambio de rol</Label>
                      <Input
                        id="motivo-rol"
                        value={motivoRol}
                        minLength={10}
                        maxLength={500}
                        onChange={(e) => {
                          setMotivoRol(e.target.value);
                          limpiarError("motivoRol");
                        }}
                        placeholder="Mínimo 10 caracteres"
                        aria-invalid={!!erroresCampo.motivoRol}
                      />
                      {erroresCampo.motivoRol && (
                        <p role="alert" className="text-sm text-destructive">{erroresCampo.motivoRol}</p>
                      )}
                    </Field>
                    <Button type="button" onClick={guardarRol} disabled={cargando} className="self-start">
                      <Save className="size-4" aria-hidden="true" /> Guardar rol
                    </Button>
                  </div>
                )}

                {puedeEstado && (
                  <div className="flex flex-col gap-2 border-t pt-4">
                    <Field data-invalid={!!erroresCampo.motivoEstado}>
                      <Label htmlFor="motivo-estado">Motivo de activación/desactivación</Label>
                      <Input
                        id="motivo-estado"
                        value={motivoEstado}
                        minLength={10}
                        maxLength={500}
                        onChange={(e) => {
                          setMotivoEstado(e.target.value);
                          limpiarError("motivoEstado");
                        }}
                        placeholder="Mínimo 10 caracteres"
                        aria-invalid={!!erroresCampo.motivoEstado}
                      />
                      {erroresCampo.motivoEstado && (
                        <p role="alert" className="text-sm text-destructive">{erroresCampo.motivoEstado}</p>
                      )}
                    </Field>
                    <Button
                      type="button"
                      variant={detalle.isActive ? "destructive" : "default"}
                      onClick={() => cambiarEstado(!detalle.isActive)}
                      disabled={cargando}
                      className="self-start"
                    >
                      {detalle.isActive ? "Desactivar cuenta" : "Activar cuenta"}
                    </Button>
                  </div>
                )}

                {puedeRestablecer && (
                  <div className="border-t pt-4">
                    <Field data-invalid={!!erroresCampo.motivoAcceso}>
                      <Label htmlFor="motivo-acceso">Motivo del restablecimiento</Label>
                      <Input
                        id="motivo-acceso"
                        value={motivoAcceso}
                        minLength={10}
                        maxLength={500}
                        onChange={(e) => {
                          setMotivoAcceso(e.target.value);
                          limpiarError("motivoAcceso");
                        }}
                        placeholder="Mínimo 10 caracteres"
                        aria-invalid={!!erroresCampo.motivoAcceso}
                      />
                      {erroresCampo.motivoAcceso && (
                        <p role="alert" className="text-sm text-destructive">{erroresCampo.motivoAcceso}</p>
                      )}
                    </Field>
                    <Button type="button" variant="outline" onClick={restablecer} disabled={cargando}>
                      <KeyRound className="size-4" aria-hidden="true" /> Restablecer acceso
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      La contraseña vuelve a ser la cédula, se revocan las sesiones y se avisa por correo.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="size-4" aria-hidden="true" /> Correo de acceso
                </CardTitle>
                <CardDescription>
                  Para personal pasivo o trabajadores que necesitan otro correo.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {puedeCorreo ? (
                  <>
                    <Field>
                      <Label htmlFor="fuente-correo">Fuente</Label>
                      <Select
                        value={fuenteCorreo}
                        onValueChange={(v) => setFuenteCorreo(v as typeof fuenteCorreo)}
                      >
                        <SelectTrigger id="fuente-correo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INSTITUCIONAL">Correo institucional actual</SelectItem>
                          <SelectItem value="ALTERNATIVO">Correo alternativo del trabajador</SelectItem>
                          <SelectItem value="OTRO">Otro correo</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {fuenteCorreo === "OTRO" && (
                      <Field data-invalid={!!erroresCampo.correoOtro}>
                        <Label htmlFor="correo-otro">Correo</Label>
                        <Input
                          id="correo-otro"
                          type="email"
                          maxLength={254}
                          value={correoOtro}
                          onChange={(e) => {
                            setCorreoOtro(e.target.value);
                            limpiarError("correoOtro");
                          }}
                          aria-invalid={!!erroresCampo.correoOtro}
                        />
                        {erroresCampo.correoOtro && (
                          <p role="alert" className="text-sm text-destructive">{erroresCampo.correoOtro}</p>
                        )}
                      </Field>
                    )}
                    <Field data-invalid={!!erroresCampo.motivoCorreo}>
                      <Label htmlFor="motivo-correo">Motivo del cambio de correo</Label>
                      <Input
                        id="motivo-correo"
                        value={motivoCorreo}
                        minLength={10}
                        maxLength={500}
                        onChange={(e) => {
                          setMotivoCorreo(e.target.value);
                          limpiarError("motivoCorreo");
                        }}
                        placeholder="Mínimo 10 caracteres"
                        aria-invalid={!!erroresCampo.motivoCorreo}
                      />
                      {erroresCampo.motivoCorreo && (
                        <p role="alert" className="text-sm text-destructive">{erroresCampo.motivoCorreo}</p>
                      )}
                    </Field>
                    <Button type="button" onClick={cambiarCorreo} disabled={cargando} className="self-start">
                      Guardar correo
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No tiene permiso para cambiar el correo de acceso.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden="true" /> Permisos individuales
              </CardTitle>
              <CardDescription>
                Excepciones sobre el rol. Un deny siempre gana. El permiso efectivo lo calcula el servidor.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {puedeOverrides ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-medium">Conceder (allow)</p>
                      {allow.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin concesiones individuales.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {allow.map((codigo) => (
                            <li key={codigo}>
                              <Badge variant="secondary" className="gap-1">
                                {codigo}
                                <button
                                  type="button"
                                  aria-label={`Quitar ${codigo} de allow`}
                                  onClick={() => setAllow(allow.filter((c) => c !== codigo))}
                                >
                                  ×
                                </button>
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Select value={nuevoAllow} onValueChange={setNuevoAllow}>
                          <SelectTrigger aria-label="Permiso a conceder">
                            <SelectValue placeholder="Permiso" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Seleccione</SelectItem>
                            {opcionesDisponibles.map((p) => (
                              <SelectItem key={p.codigo} value={p.codigo}>
                                {p.codigo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (nuevoAllow !== "__none") {
                              setAllow([...allow, nuevoAllow]);
                              setNuevoAllow("__none");
                            }
                          }}
                        >
                          Añadir
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">Denegar (deny)</p>
                      {deny.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin denegaciones individuales.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {deny.map((codigo) => (
                            <li key={codigo}>
                              <Badge variant="destructive" className="gap-1">
                                {codigo}
                                <button
                                  type="button"
                                  aria-label={`Quitar ${codigo} de deny`}
                                  onClick={() => setDeny(deny.filter((c) => c !== codigo))}
                                >
                                  ×
                                </button>
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Select value={nuevoDeny} onValueChange={setNuevoDeny}>
                          <SelectTrigger aria-label="Permiso a denegar">
                            <SelectValue placeholder="Permiso" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Seleccione</SelectItem>
                            {opcionesDisponibles.map((p) => (
                              <SelectItem key={p.codigo} value={p.codigo}>
                                {p.codigo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (nuevoDeny !== "__none") {
                              setDeny([...deny, nuevoDeny]);
                              setNuevoDeny("__none");
                            }
                          }}
                        >
                          Añadir
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Field data-invalid={!!erroresCampo.motivoOverrides}>
                    <Label htmlFor="motivo-overrides">Motivo</Label>
                    <Input
                      id="motivo-overrides"
                      value={motivoOverrides}
                      minLength={10}
                      maxLength={500}
                      onChange={(e) => {
                        setMotivoOverrides(e.target.value);
                        limpiarError("motivoOverrides");
                      }}
                      placeholder="Mínimo 10 caracteres"
                      aria-invalid={!!erroresCampo.motivoOverrides}
                    />
                    {erroresCampo.motivoOverrides && (
                      <p role="alert" className="text-sm text-destructive">{erroresCampo.motivoOverrides}</p>
                    )}
                  </Field>
                  <Button type="button" onClick={guardarOverrides} disabled={cargando} className="self-start">
                    <Save className="size-4" aria-hidden="true" /> Guardar permisos
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tiene permiso para gestionar permisos individuales.
                </p>
              )}

              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">
                  Permiso efectivo ({detalle.permisos.efectivos.length})
                </p>
                {detalle.permisos.efectivos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin permisos efectivos.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {[...porModulo(detalle.permisos.efectivos).entries()].map(([modulo, codigos]) => (
                      <div key={modulo}>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{modulo}</p>
                        <ul className="flex flex-wrap gap-1">
                          {codigos.map((codigo) => (
                            <li key={codigo}>
                              <Badge variant="outline">{codigo}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No se encontró el usuario.</p>
      )}
    </section>
  );
}
