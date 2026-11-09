"use client";

/**
 * Al buscar en Usuarios una cédula que no tiene cuenta (QA 2026-11-03): muestra al trabajador, su
 * correo registrado y permite crearle la cuenta con ese correo. Usa el endpoint de «correo de
 * acceso», que crea la cuenta (rol AUTOGESTION, contraseña inicial = cédula, cambio obligatorio y
 * correo de aviso) y queda auditado con el motivo.
 */
import { useEffect, useState, useTransition } from "react";
import { Loader2, UserPlus, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { getEmpleadoPorCedulaAction } from "@/modules/personal/infrastructure/actions/personal-actions";
import { getPasivoPorCedulaAction } from "@/modules/pasivos/infrastructure/actions/pasivos-actions";
import { cambiarCorreoAccesoAction } from "../infrastructure/actions/usuario-actions";

interface Trabajador {
  nombres: string;
  apellidos: string;
  correo: string | null;
  correoAlternativo: string | null;
  esPasivo: boolean;
}

interface Props {
  cedula: string;
  puedeCrear: boolean;
  onCreada: () => void;
}

export function CuentaInexistente({ cedula, puedeCrear, onCreada }: Props) {
  const [trabajador, setTrabajador] = useState<Trabajador | null | "no-existe">(null);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [creando, iniciar] = useTransition();

  useEffect(() => {
    let vigente = true;
    Promise.all([
      getEmpleadoPorCedulaAction(cedula),
      getPasivoPorCedulaAction(cedula).catch(() => null),
    ])
      .then(([r, rPasivo]) => {
        if (!vigente) return;
        if (r && typeof r === "object" && !("error" in r)) {
          const e = r as {
            nombres?: string;
            apellidos?: string;
            correo?: string | null;
            correoAlternativo?: string | null;
            asignaciones?: Array<{
              tipoPersonalNombre?: string;
              denominacionCargo?: string;
              tipoNomina?: string;
              estatus?: string;
            }>;
          };
          const tieneAsignacionPasiva = Boolean(
            e.asignaciones?.some((a) => {
              const str = `${a.tipoPersonalNombre ?? ""} ${a.tipoNomina ?? ""} ${a.denominacionCargo ?? ""} ${a.estatus ?? ""}`.toUpperCase();
              return (
                str.includes("PASIVO") ||
                str.includes("JUBILAD") ||
                str.includes("PENSION") ||
                str.includes("SOBREVIVIENTE")
              );
            }),
          );
          const esPasivo = Boolean(
            (rPasivo && typeof rPasivo === "object" && !("error" in rPasivo)) || tieneAsignacionPasiva,
          );
          setTrabajador({
            nombres: e.nombres ?? "",
            apellidos: e.apellidos ?? "",
            correo: e.correo ?? null,
            correoAlternativo: e.correoAlternativo ?? null,
            esPasivo,
          });
        } else setTrabajador("no-existe");
      })
      .catch(() => vigente && setTrabajador("no-existe"));
    return () => {
      vigente = false;
    };
  }, [cedula]);

  if (trabajador === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (trabajador === "no-existe") {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay un trabajador registrado con la cédula {cedula}.
      </p>
    );
  }

  const nombre = `${trabajador.nombres} ${trabajador.apellidos}`.trim();
  const motivoValido = motivo.trim().length >= 10;

  // El correo alternativo no da acceso: solo el principal (`Employee.correo`) habilita la cuenta.
  const correoUtilizable = trabajador.correo
    ? { fuente: "INSTITUCIONAL" as const, direccion: trabajador.correo }
    : null;

  function crear() {
    if (!correoUtilizable) return;
    iniciar(async () => {
      const r = await cambiarCorreoAccesoAction(cedula, {
        fuente: correoUtilizable.fuente,
        motivo: motivo.trim(),
      });
      if (r && typeof r === "object" && "error" in r) {
        const fallo = r as { error: string; errores?: Record<string, string[]> };
        const detalle = fallo.errores?.motivo?.join(" ");
        if (detalle) setErrorMotivo(detalle);
        else toast.error(fallo.error);
        return;
      }
      toast.success("Cuenta creada. Se envió el aviso con cómo entrar a su correo.");
      onCreada();
    });
  }

  // Motivo real de no tener cuenta
  const explicacionMotivo = (() => {
    if (!trabajador.correo) {
      const alternativo = trabajador.correoAlternativo
        ? ` Su correo alternativo (${trabajador.correoAlternativo}) no da acceso al sistema.`
        : "";
      return trabajador.esPasivo
        ? `Necesita un correo principal para tener cuenta. RRHH debe cargarlo en su ficha (Gestión de Personal Pasivo).${alternativo}`
        : `Necesita un correo institucional para tener cuenta. Agréguelo primero en su ficha (Actualizar Información Básica).${alternativo}`;
    }
    return trabajador.correoAlternativo
      ? `Correo principal: ${trabajador.correo} | Correo alternativo: ${trabajador.correoAlternativo}`
      : `Correo principal registrado: ${trabajador.correo}`;
  })();

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-4 py-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <UserX className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {nombre} (cédula {cedula}) no tiene cuenta de acceso.
            </p>
            <p className="text-sm text-muted-foreground">{explicacionMotivo}</p>
          </div>
        </div>

        {correoUtilizable && puedeCrear ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor="motivo-crear-cuenta">Motivo de la creación</Label>
              <Input
                id="motivo-crear-cuenta"
                placeholder="Mínimo 10 caracteres"
                minLength={10}
                maxLength={500}
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setErrorMotivo(null);
                }}
                disabled={creando}
                aria-invalid={!!errorMotivo}
              />
              {errorMotivo && (
                <p role="alert" className="text-sm text-destructive">{errorMotivo}</p>
              )}
            </div>
            <Button type="button" onClick={crear} disabled={!motivoValido || creando}>
              {creando ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <UserPlus aria-hidden />
              )}
              Crear cuenta con {correoUtilizable.direccion}
            </Button>
          </div>
        ) : null}
        {correoUtilizable && puedeCrear ? (
          <p className="text-xs text-muted-foreground">
            La contraseña inicial será su cédula; deberá cambiarla en su primer ingreso. El acceso
            es siempre con el correo principal.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
