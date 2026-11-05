"use client";

/**
 * Alta de usuarios en ruta propia (D4, O17).
 * Cédula con búsqueda en vivo, rol y correo que se usará.
 * La contraseña inicial es la cédula y se fuerza cambio al ingresar.
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  User,
  UserPlus,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
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

import type { EmpleadoDTO } from "@/modules/personal/application/dtos/empleado-dto";
import { getEmpleadoPorCedulaAction } from "@/modules/personal/infrastructure/actions/personal-actions";
import type { RolDTO } from "../application/dtos/usuario-dto";
import { getRolesAction, registrarUsuarioAction } from "../infrastructure/actions/usuario-actions";
import { registrarUsuarioSchema, type RegistrarUsuarioFormType } from "./schema/schema-usuario";

export default function UsuarioRegistrarPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, "identidad.crear_usuarios");
  const [isPending, startTransition] = useTransition();
  const [roles, setRoles] = useState<RolDTO[]>([]);

  // Búsqueda en vivo del trabajador por cédula
  const [trabajador, setTrabajador] = useState<EmpleadoDTO | null | "no-encontrado">(null);
  const [buscandoTrabajador, setBuscandoTrabajador] = useState(false);

  const form = useForm<RegistrarUsuarioFormType>({
    resolver: zodResolver(registrarUsuarioSchema),
    defaultValues: { cedula: "", rolId: null },
  });

  const cedulaActual = form.watch("cedula");

  useEffect(() => {
    getRolesAction()
      .then(setRoles)
      .catch(() => toast.error("No fue posible cargar el catálogo de roles."));
  }, []);

  // Búsqueda con debounce al cambiar la cédula
  useEffect(() => {
    const cedulaLimpia = (cedulaActual || "").trim();
    if (cedulaLimpia.length < 5) {
      setTrabajador(null);
      setBuscandoTrabajador(false);
      return;
    }

    let cancelado = false;
    setBuscandoTrabajador(true);

    const timer = setTimeout(async () => {
      try {
        const res = await getEmpleadoPorCedulaAction(cedulaLimpia);
        if (cancelado) return;
        if (res && typeof res === "object" && !("error" in res)) {
          setTrabajador(res as EmpleadoDTO);
        } else {
          setTrabajador("no-encontrado");
        }
      } catch {
        if (!cancelado) setTrabajador("no-encontrado");
      } finally {
        if (!cancelado) setBuscandoTrabajador(false);
      }
    }, 350);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [cedulaActual]);

  const onSubmit = (data: RegistrarUsuarioFormType) => {
    if (!puedeCrear) {
      toast.error("No tiene permisos para registrar usuarios.");
      return;
    }
    startTransition(async () => {
      const resultado = await registrarUsuarioAction({
        cedula: data.cedula,
        rolId: data.rolId,
      });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const err = resultado as { error: string; errores?: Record<string, string[]> };
        const sinUbicar = aplicarErroresServidor(form, err.errores, {
          cedula: "cedula",
          rol_id: "rolId",
        });
        toast.error(sinUbicar.length > 0 || !err.errores ? err.error : "Revise los campos marcados en rojo.");
        return;
      }
      toast.success("Usuario registrado correctamente.");
      router.push("/usuarios");
    });
  };

  const trabajadorValido = trabajador && typeof trabajador === "object" ? trabajador : null;
  const cargoPrincipal = trabajadorValido?.asignaciones?.[0]?.denominacionCargo || "Sin cargo asignado";
  const condicionLaboral = trabajadorValido?.asignaciones?.[0]?.tipoNomina || "No especificada";
  const oficinaDependencia =
    trabajadorValido?.asignaciones?.[0]?.direccionGeneral ||
    trabajadorValido?.asignaciones?.[0]?.dependencia ||
    "No especificada";

  return (
    <section className="flex flex-col gap-6 px-6 py-6 max-w-7xl mx-auto w-full">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <UserPlus className="size-6 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight">Registrar usuario</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Alta de cuentas de acceso institucional al sistema para trabajadores del organismo.
        </p>
      </header>

      {/* Texto de ayuda prominente según directriz O17 */}
      <div
        role="note"
        aria-label="Aviso informativo"
        className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
      >
        <Info className="size-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-blue-950 dark:text-blue-100">
            Creación puntual de cuenta
          </p>
          <p className="text-blue-900/90 dark:text-blue-200/90">
            Normalmente las cuentas se crean solas; use esta opción para casos puntuales. La contraseña inicial es la cédula y se pedirá cambiarla al entrar.
          </p>
        </div>
      </div>

      {!puedeCrear && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm font-medium text-destructive flex items-center gap-2"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <span>
            No tiene permisos suficientes para registrar usuarios (se requiere el permiso{" "}
            <code className="font-mono font-semibold">identidad.crear_usuarios</code>).
          </span>
        </div>
      )}

      {/* Layout de dos columnas en escritorio, una columna en móvil */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Formulario de Registro */}
        <div className="lg:col-span-7">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Datos de la cuenta</CardTitle>
              <CardDescription>
                Indique la cédula del trabajador para validar su existencia y asigne el rol correspondiente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
                {/* Campo Cédula con buscador en vivo */}
                <Field data-invalid={!!form.formState.errors.cedula}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cedula">Cédula del trabajador</Label>
                    {buscandoTrabajador && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                        <Loader2 className="size-3 animate-spin text-primary" />
                        Buscando trabajador...
                      </span>
                    )}
                    {!buscandoTrabajador && trabajadorValido && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3.5" />
                        Trabajador encontrado
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="cedula"
                      placeholder="Ej. 12345678"
                      inputMode="numeric"
                      maxLength={20}
                      {...form.register("cedula")}
                      aria-invalid={!!form.formState.errors.cedula}
                      className={trabajadorValido ? "border-emerald-500/60 focus-visible:ring-emerald-500/20" : ""}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <Search className="size-4" />
                    </div>
                  </div>
                  {form.formState.errors.cedula && (
                    <p role="alert" className="text-sm text-destructive">
                      {form.formState.errors.cedula.message}
                    </p>
                  )}
                  {!buscandoTrabajador && trabajador === "no-encontrado" && (
                    <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">
                      No se localizó ningún empleado con esta cédula en la base de datos de personal.
                    </p>
                  )}
                </Field>

                {/* Rol select */}
                <Field className="flex flex-col gap-1.5">
                  <Label htmlFor="rol">Rol del sistema</Label>
                  <Select
                    value={form.watch("rolId") ? String(form.watch("rolId")) : undefined}
                    onValueChange={(v) => form.setValue("rolId", Number(v))}
                  >
                    <SelectTrigger id="rol" className="w-full">
                      <SelectValue placeholder="Seleccione un rol institucional" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.nombreRol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define los permisos efectivos de acceso y acciones permitidas en el sistema.
                  </p>
                </Field>

                {/* Correo que se usará */}
                <div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Mail className="size-3.5" />
                    <span>Correo que se usará para el acceso</span>
                  </div>
                  {trabajadorValido ? (
                    trabajadorValido.correo ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-foreground">
                            {trabajadorValido.correo}
                          </span>
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                            Registrado
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          El usuario iniciará sesión y recibirá la notificación de cuenta en este correo.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 text-xs">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <span>
                          El trabajador no tiene correo registrado en su expediente. La cuenta se creará, pero no podrá recibir credenciales por correo hasta que se registre uno.
                        </span>
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Se utilizará automáticamente el correo institucional registrado en el expediente del trabajador al ingresar su cédula.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isPending || !puedeCrear || buscandoTrabajador}
                  className="w-full mt-2"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin mr-2" aria-hidden="true" />
                  ) : (
                    <UserPlus className="size-4 mr-2" aria-hidden="true" />
                  )}
                  {isPending ? "Registrando usuario..." : "Registrar usuario"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Panel Lateral (Ficha resumida + Qué pasará) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Ficha resumida del trabajador encontrado */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <User className="size-4 text-primary" aria-hidden="true" />
                Ficha resumida del trabajador
              </CardTitle>
              <CardDescription>
                Información del expediente laboral asociado a la cédula consultada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trabajadorValido ? (
                <div className="flex flex-col gap-3 text-sm divide-y divide-border">
                  <div className="flex flex-col gap-0.5 pb-2">
                    <span className="text-xs text-muted-foreground">Nombre completo</span>
                    <span className="font-semibold text-foreground">
                      {trabajadorValido.nombreCompleto || `${trabajadorValido.nombres} ${trabajadorValido.apellidos}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Cédula</span>
                      <span className="font-mono font-medium text-foreground">
                        {trabajadorValido.cedula}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Condición</span>
                      <span className="font-medium text-foreground">
                        {condicionLaboral}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 py-2">
                    <span className="text-xs text-muted-foreground">Cargo</span>
                    <span className="font-medium text-foreground">
                      {cargoPrincipal}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 py-2">
                    <span className="text-xs text-muted-foreground">Ubicación / Dependencia</span>
                    <span className="font-medium text-foreground">
                      {oficinaDependencia}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 pt-2">
                    <span className="text-xs text-muted-foreground">Correo de contacto</span>
                    <span className="font-mono text-xs text-foreground truncate">
                      {trabajadorValido.correo || "No registrado"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-lg">
                  <Search className="size-8 stroke-1 text-muted-foreground/60 mb-2" />
                  <p className="text-xs font-medium">
                    {trabajador === "no-encontrado"
                      ? "No hay trabajador que mostrar con la cédula indicada."
                      : "Escriba la cédula del trabajador para consultar sus datos laborales."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Panel informativo: ¿Qué pasará al crear la cuenta? */}
          <Card className="shadow-sm border-blue-200/50 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-blue-950 dark:text-blue-100">
                <Info className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                ¿Qué pasará al crear la cuenta?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3 text-xs text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <KeyRound className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground font-semibold">Contraseña inicial:</strong> Se establece de forma automática con el mismo número de cédula del trabajador.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <RefreshCw className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground font-semibold">Cambio obligatorio:</strong> El sistema obligará al usuario a cambiar su contraseña en el primer inicio de sesión.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground font-semibold">Vigencia temporal:</strong> La clave inicial cuenta con un periodo de caducidad configurado a nivel institucional (7 días por defecto).
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Mail className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground font-semibold">Notificación por correo:</strong> Si el empleado posee correo en su expediente, se le enviará un aviso de bienvenida con las instrucciones para su ingreso.
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
