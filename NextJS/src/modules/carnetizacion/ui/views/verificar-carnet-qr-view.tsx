"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, HeartPulse, Lock, PhoneCall, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import type { FichaQr } from "../../domain/entities/carnet";
import { repoCarnetizacionApi } from "../../infrastructure/repositories/repo-carnetizacion-api";
import { consultarFichaQrUC, consultarSaludEmergenciaUC } from "../../application/use-cases/consultar-qr-ficha";

interface VerificarCarnetQrViewProps {
  securityHash: string;
}

export function VerificarCarnetQrView({ securityHash }: VerificarCarnetQrViewProps) {
  const [ficha, setFicha] = useState<FichaQr | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cargandoSalud, setCargandoSalud] = useState(false);
  const [saludVisible, setSaludVisible] = useState(false);

  useEffect(() => {
    let montado = true;
    async function cargarFicha() {
      try {
        setCargando(true);
        setError(null);
        const data = await consultarFichaQrUC(repoCarnetizacionApi, securityHash);
        if (montado) {
          setFicha(data);
          if (data.datos?.salud) setSaludVisible(true);
        }
      } catch (err) {
        if (montado) setError(err instanceof Error ? err.message : "No se pudo consultar la ficha del carnet.");
      } finally {
        if (montado) setCargando(false);
      }
    }
    cargarFicha();
    return () => {
      montado = false;
    };
  }, [securityHash]);

  const handleConsultarSalud = async () => {
    try {
      setCargandoSalud(true);
      const data = await consultarSaludEmergenciaUC(repoCarnetizacionApi, securityHash);
      setFicha(data);
      setSaludVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error abriendo información médica.");
    } finally {
      setCargandoSalud(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
        <p className="text-sm text-muted-foreground">Verificando credencial institucional...</p>
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="mx-auto max-w-md p-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle className="text-xl">Error de verificación</CardTitle>
            <CardDescription>{error || "No se encontró el carnet solicitado."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // --- Estado 3: Carnet Anulado o Vencido ---
  if (!ficha.esValido || ficha.estado === "ANULADO" || ficha.estado === "VENCIDO") {
    return (
      <div className="mx-auto max-w-md p-4">
        <Card className="border-destructive/40 bg-card shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-10 w-10" />
            </div>
            <div className="mb-2">
              <Badge variant="destructive" className="uppercase tracking-wider">
                {ficha.estado === "VENCIDO" ? "Carnet vencido" : "Carnet no válido"}
              </Badge>
            </div>
            <CardTitle className="text-xl text-destructive font-bold">
              {ficha.estado === "VENCIDO" ? "Credencial Expirada" : "Credencial Anulada"}
            </CardTitle>
            <CardDescription className="text-sm font-medium text-foreground/80 mt-2">
              {ficha.mensaje}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 text-center text-xs text-muted-foreground border-t border-border">
            <p>Por seguridad y privacidad institucional, no se muestra información personal de credenciales inactivas.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Estados 1 y 2: Carnet Vigente (Público o Con Sesión / Admin) ---
  const datos = ficha.datos;
  const iniciales = datos?.nombre
    ? datos.nombre
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("")
    : "ID";

  const nivelBadgeLabel =
    ficha.nivelAcceso === "ADMINISTRADOR"
      ? "Vista de Auditoría (Admin)"
      : ficha.nivelAcceso === "CON_SESION" ? "Usuario con sesión" : "Sin iniciar sesión";

  return (
    <div className="mx-auto max-w-lg p-4 space-y-4">
      {/* Nivel de acceso y aviso */}
      <div className="flex items-center justify-between">
        <Badge variant={ficha.nivelAcceso === "PUBLICO" ? "outline" : "secondary"} className="text-xs">
          {nivelBadgeLabel}
        </Badge>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Ficha Verificada
        </span>
      </div>

      <Card className="border-border shadow-md overflow-hidden">
        {/* Cabecera con avatar e identidad */}
        <div className="bg-primary/5 p-6 text-center border-b border-border">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-2xl overflow-hidden ring-4 ring-background shadow-inner">
            {datos?.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={datos.foto_url}
                alt={datos.nombre}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{iniciales}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-foreground">{datos?.nombre}</h2>
          <div className="mt-1 flex items-center justify-center gap-2">
            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
              <CheckCircle2 className="h-3 w-3" /> Carnet vigente
            </Badge>
            {ficha.fechaVencimiento && (
              <span className="text-xs text-muted-foreground">Vence: {ficha.fechaVencimiento}</span>
            )}
          </div>
        </div>

        <CardContent className="p-5 space-y-4">
          {/* Datos Institucionales */}
          <dl className="grid grid-cols-1 gap-3 text-sm">
            {datos?.cedula && (
              <div className="rounded-lg bg-muted/40 p-2.5">
                <dt className="text-xs text-muted-foreground font-medium">Cédula de Identidad</dt>
                <dd className="font-semibold text-foreground">{datos.cedula}</dd>
              </div>
            )}

            {datos?.fecha_nacimiento && (
              <div className="rounded-lg bg-muted/40 p-2.5">
                <dt className="text-xs text-muted-foreground font-medium">Fecha de Nacimiento</dt>
                <dd className="font-semibold text-foreground">{datos.fecha_nacimiento}</dd>
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-2.5">
              <dt className="text-xs text-muted-foreground font-medium">Cargo Institucional</dt>
              <dd className="font-semibold text-foreground">
                {datos?.cargo}
                {datos?.codigo_cargo && <span className="ml-2 text-xs text-muted-foreground font-normal">({datos.codigo_cargo})</span>}
              </dd>
            </div>

            <div className="rounded-lg bg-muted/40 p-2.5">
              <dt className="text-xs text-muted-foreground font-medium">Ubicación Administrativa</dt>
              <dd className="font-medium text-foreground">{datos?.ubicacion}</dd>
            </div>

            {datos?.direccion_vivienda && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5">
                <dt className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Dirección de Vivienda (Solo Auditoría)
                </dt>
                <dd className="font-medium text-foreground text-xs mt-0.5">{datos.direccion_vivienda}</dd>
              </div>
            )}
          </dl>

          {/* Contactos de Emergencia */}
          {datos?.contactos_emergencia && datos.contactos_emergencia.length > 0 && (
            <div className="rounded-lg border border-border p-3.5 space-y-2 bg-card">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5 text-primary" /> Contactos de Emergencia
              </h3>
              <div className="space-y-2">
                {datos.contactos_emergencia.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-foreground">{c.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">{c.parentesco}</p>
                    </div>
                    {c.telefono ? (
                      <a
                        href={`tel:${c.telefono}`}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline bg-primary/10 px-2 py-1 rounded"
                      >
                        <PhoneCall className="h-3 w-3" /> {c.telefono}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Sin teléfono</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sección de Salud en Emergencias */}
          <div className="rounded-lg border border-border p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HeartPulse className="h-3.5 w-3.5 text-red-500" /> Información Médica
              </h3>
            </div>

            {saludVisible && datos?.salud ? (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-muted/40 p-2">
                    <span className="text-[11px] text-muted-foreground block">Grupo Sanguíneo</span>
                    <span className="font-semibold text-foreground">{datos.salud.grupo_sanguineo || "No registrado"}</span>
                  </div>
                  <div className="rounded bg-muted/40 p-2">
                    <span className="text-[11px] text-muted-foreground block">Alergias</span>
                    <span className="font-semibold text-foreground">
                      {datos.salud.alergias.length > 0 ? datos.salud.alergias.join(", ") : "Ninguna registrada"}
                    </span>
                  </div>
                </div>

                <div className="rounded bg-muted/40 p-2">
                  <span className="text-[11px] text-muted-foreground block">Patologías Crónicas</span>
                  <span className="font-semibold text-foreground">
                    {datos.salud.patologias.length > 0 ? datos.salud.patologias.join(", ") : "Ninguna registrada"}
                  </span>
                </div>

                <div className="rounded bg-muted/40 p-2">
                  <span className="text-[11px] text-muted-foreground block">Discapacidades</span>
                  <span className="font-semibold text-foreground">
                    {datos.salud.discapacidades.length > 0 ? datos.salud.discapacidades.join(", ") : "Ninguna registrada"}
                  </span>
                </div>

                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-500" /> Consulta registrada en la bitácora de auditoría.
                </p>
              </div>
            ) : ficha.saludDisponible ? (
              <div className="space-y-2 text-center py-1">
                <p className="text-xs text-muted-foreground">
                  Información reservada para situaciones de emergencia médica o de primeros auxilios.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleConsultarSalud}
                  disabled={cargandoSalud}
                  className="w-full text-xs font-semibold border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                >
                  {cargandoSalud ? "Consultando..." : "Ver información médica"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Información médica reservada por el titular.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
