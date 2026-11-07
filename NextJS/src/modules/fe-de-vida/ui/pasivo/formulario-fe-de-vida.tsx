"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, MapPin, Send, Shield, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { reducirFoto } from "@/shared/components/captura-foto/reducir-foto";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import type { OrigenFoto } from "@/shared/components/captura-foto/captura-foto";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import type { ItemBorrador } from "@/modules/autogestion/domain/entities/solicitud-actualizacion";
import {
  SECCIONES_DEF,
  claveCampo,
  etiquetaCampo,
  type EntidadDef,
} from "@/modules/autogestion/domain/value-objects/campos-seccion";
import { getMiExpedienteAction } from "@/modules/autogestion/infrastructure/actions/autogestion-actions";
import { EditorEntidad } from "@/modules/autogestion/ui/solicitudes/editor-entidad";
import { useNombresCatalogo } from "@/modules/autogestion/ui/solicitudes/use-nombres-catalogo";
import { formatearValor } from "@/modules/autogestion/ui/formato-solicitud";
import type { DetalleSolicitudDTO, SolicitudDTO } from "../../application/dtos/fe-de-vida-dto";
import { requiereFotoNueva, puedeEnviarFeDeVida } from "../../domain/services/reglas";
import {
  enviarPresencialAction,
  enviarSolicitudAction,
  guardarBorradorAction,
  guardarBorradorPresencialAction,
  subirEvidenciaAction,
  subirEvidenciaPresencialAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import {
  eliminarFotoLocal,
  guardarFotoLocal,
  recuperarFotoLocal,
} from "../../infrastructure/storage/foto-local-storage";
import { AvisoConectividad } from "../comun/aviso-conectividad";
import {
  confirmacionEnvioSchema,
  type ConfirmacionEnvioValores,
  type DatosContactoValores,
} from "../schema/schema-fe-de-vida";
import { aEntrada, cambiosAItems, fusionarContacto, valoresIniciales } from "./borrador-items";
import { PanelGuiaFeDeVida } from "./panel-guia-fe-de-vida";
import { useRegistrarGuia } from "@/modules/autogestion/ui/guias/contexto-guia";
import { PasoContacto } from "./paso-contacto";
import { PasoFoto } from "./paso-foto";
import { ejecutarConReintento } from "./subida-con-reintento";

type Paso = "contacto" | "emergencia" | "hijos" | "foto" | "revisar";

const TITULOS: Record<Paso, string> = {
  contacto: "Sus datos",
  emergencia: "Emergencia y dirección",
  hijos: "Sus hijos",
  foto: "Foto con su cédula",
  revisar: "Revisar y enviar",
};

function pasoFormularioAGuia(p: Paso): number {
  if (p === "foto") return 3;
  if (p === "revisar") return 4;
  return 2;
}

const entidadDe = (seccion: "contacto" | "vivienda" | "familiar", entidad: string): EntidadDef => {
  const def = SECCIONES_DEF[seccion].entidades.find((e) => e.entidad === entidad);
  if (!def) throw new Error(`Entidad ${entidad} no definida`);
  return def;
};

const ENTIDADES_EMERGENCIA: Array<["contacto" | "vivienda", EntidadDef]> = [
  ["contacto", entidadDe("contacto", "contacto_emergencia")],
  ["vivienda", entidadDe("vivienda", "datos_vivienda")],
];
const ENTIDAD_HIJOS = entidadDe("familiar", "familiar");

/** Todos los campos de estas entidades están habilitados para el pasivo (no hay plazo por campo). */
const CAMPOS_HABILITADOS = [...ENTIDADES_EMERGENCIA.map(([, e]) => e), ENTIDAD_HIJOS].flatMap((e) =>
  e.campos.map((c) => claveCampo(e.entidad, c.campo)),
);

interface Props {
  solicitud: SolicitudDTO;
  detalle: DetalleSolicitudDTO;
  onActualizar: () => void;
  modo?: "en_linea" | "presencial";
  fichaInicial?: Record<string, unknown> | null;
}

/** Formulario por pasos de la fe de vida: datos, emergencia y dirección, hijos, foto y envío. */
export function FormularioFeDeVida({
  solicitud,
  detalle,
  onActualizar,
  modo = "en_linea",
  fichaInicial,
}: Props) {
  const esPresencial = modo === "presencial";
  const {
    data: dataFicha,
    error,
    isLoading: loadingFicha,
    mutate,
  } = useSWR(
    esPresencial ? null : "mi-expediente-fe-de-vida",
    () => getMiExpedienteAction(),
  );
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const ficha = (esPresencial ? fichaInicial : dataFicha) as NonNullable<typeof dataFicha>;
  const isLoading = !esPresencial && loadingFicha;
  const inicial = useMemo(() => cambiosAItems(detalle.cambios), [detalle.cambios]);
  const [items, setItems] = useState<ItemBorrador[]>(inicial);
  const [indice, setIndice] = useState(0);
  const [foto, setFoto] = useState<{ archivo: File; origen: OrigenFoto } | null>(null);
  const [fotoSubida, setFotoSubida] = useState(false);
  const [fotoRecuperadaLocal, setFotoRecuperadaLocal] = useState(false);
  const [mensajeSubida, setMensajeSubida] = useState<string | undefined>(undefined);
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  useRegistrarGuia(() => setGuiaAbierta(true));
  const [erroresContacto, setErroresContacto] = useState<Record<string, string[]> | undefined>(undefined);
  const [guardando, iniciarGuardado] = useTransition();
  const [subiendo, iniciarSubida] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const nombres = useNombresCatalogo(
    items.map((i) => ({ campo: i.campo, valorPropuesto: i.valor })),
  );

  // Recuperación preventiva de foto guardada localmente en IndexedDB tras recarga o corte de red
  useEffect(() => {
    let montado = true;
    if (!solicitud.tieneEvidencia && !foto) {
      recuperarFotoLocal(solicitud.id).then((guardada) => {
        if (montado && guardada) {
          setFoto({ archivo: guardada.archivo, origen: guardada.origen });
          setFotoRecuperadaLocal(true);
        }
      });
    }
    return () => {
      montado = false;
    };
  }, [solicitud.id, solicitud.tieneEvidencia, foto]);

  const manejarFoto = useCallback(
    (archivo: File | null, origen: OrigenFoto | null) => {
      if (archivo && origen) {
        setFoto({ archivo, origen });
        setFotoRecuperadaLocal(false);
        void guardarFotoLocal(solicitud.id, archivo, origen);
      } else {
        setFoto(null);
        setFotoRecuperadaLocal(false);
        void eliminarFotoLocal(solicitud.id);
      }
    },
    [solicitud.id],
  );

  const tieneHijos = useMemo(() => {
    const declarado = items.find(
      (i) => i.entidad === "datos_complementarios" && i.campo === "tiene_hijos",
    );
    return declarado
      ? declarado.valor === true
      : ficha?.datos_complementarios?.tiene_hijos === true;
  }, [items, ficha]);

  const pasos = useMemo<Paso[]>(
    () =>
      tieneHijos
        ? ["contacto", "emergencia", "hijos", "foto", "revisar"]
        : ["contacto", "emergencia", "foto", "revisar"],
    [tieneHijos],
  );
  const paso = pasos[Math.min(indice, pasos.length - 1)];

  const confirmacion = useForm<ConfirmacionEnvioValores>({
    resolver: zodResolver(confirmacionEnvioSchema),
    defaultValues: { declaro: undefined },
  });

  if (isLoading)
    return <VistaCargando mensaje="Cargando sus datos…" onReintentar={() => mutate()} />;
  if (error || !ficha) {
    return <VistaError mensaje="No se pudieron cargar sus datos." onReintentar={() => mutate()} />;
  }

  const hayHijosRegistrados = (ficha.familiares ?? []).some((f) =>
    String(f.parentesco_nombre ?? "")
      .toUpperCase()
      .includes("HIJO"),
  );
  const hayHijoPropuesto = items.some(
    (i) => i.seccion === "familiar" && i.entidad === "familiar" && i.accion === "CREAR",
  );
  const hijosOk = hayHijosRegistrados || hayHijoPropuesto;
  const viviendaOk =
    Boolean(ficha.empleado.datos_vivienda) ||
    items.some(
      (i) =>
        i.seccion === "vivienda" &&
        i.entidad === "datos_vivienda" &&
        (i.accion === "CREAR" || i.accion === "MODIFICAR"),
    );

  function guardarYAvanzar(
    nuevos: ItemBorrador[],
    siguiente: number,
    opciones?: { sinCorreoAlternativo: boolean; justificacionSinCorreo: string },
  ) {
    iniciarGuardado(async () => {
      const res = esPresencial
        ? await guardarBorradorPresencialAction(solicitud.id, aEntrada(nuevos), opciones)
        : await guardarBorradorAction(solicitud.id, aEntrada(nuevos));
      if (!res.ok) {
        toast.error(res.mensaje);
        if (res.errores) {
          const keys = Object.keys(res.errores);
          if (keys.some((k) => ["telefono_movil", "telefono_habitacion", "correo_alternativo", "tiene_hijos"].includes(k))) {
            setErroresContacto(res.errores);
            const idx = pasos.indexOf("contacto");
            if (idx !== -1 && indice !== idx) {
              setIndice(idx);
            }
          }
        }
        return;
      }
      setErroresContacto(undefined);
      setItems(nuevos);
      setIndice(siguiente);
    });
  }

  function continuarContacto(
    valores: DatosContactoValores,
    opciones?: { sinCorreoAlternativo: boolean; justificacionSinCorreo: string },
  ) {
    if (!ficha) return;
    guardarYAvanzar(fusionarContacto(items, valores, ficha), 1, opciones);
  }

  function subirFotoYContinuar() {
    if (!foto) {
      setIndice(indice + 1);
      return;
    }
    iniciarSubida(async () => {
      // Guardado preventivo local en caso de desconexión abrupta
      await guardarFotoLocal(solicitud.id, foto.archivo, foto.origen);

      setMensajeSubida("Subiendo foto con su cédula…");
      const archivoReducido = await reducirFoto(foto.archivo);
      const accionEvidencia = esPresencial ? subirEvidenciaPresencialAction : subirEvidenciaAction;

      const res = await ejecutarConReintento(
        async (intento) => {
          const form = new FormData();
          form.append("solicitudId", solicitud.id);
          form.append("file", archivoReducido);
          form.append("origen", foto.origen);
          return await accionEvidencia(form);
        },
        (resOError) => {
          if (!resOError) return true;
          if (typeof resOError === "object" && "ok" in resOError) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const r = resOError as { ok: boolean };
            return !r.ok;
          }
          return true;
        },
        {
          intentosMaximos: 3,
          demoraBaseMs: 1000,
          factorBackoff: 2,
          onIntento: (intento, total) => {
            setMensajeSubida(`Reintentando subida (${intento} de ${total})…`);
          },
        },
      );

      setMensajeSubida(undefined);

      if (!res.ok) {
        toast.error(
          "No se pudo subir la foto por problemas de conexión. Su foto quedó guardada en este dispositivo; podrá reintentar al recuperar la conexión.",
        );
        return;
      }

      // Subida completada: limpiar copia local y avanzar
      await eliminarFotoLocal(solicitud.id);
      setFotoSubida(true);
      setFoto(null);
      setFotoRecuperadaLocal(false);
      setIndice(indice + 1);
    });
  }

  function enviar() {
    if (!puedeEnviarFeDeVida({ fotoVigente, viviendaOk, tieneHijos, hijosOk })) {
      toast.error(
        !viviendaOk
          ? "Registre sus datos de vivienda antes de enviar la fe de vida."
          : "Registre al menos un hijo antes de enviar la fe de vida.",
      );
      return;
    }
    iniciarEnvio(async () => {
      const accionBorrador = esPresencial ? guardarBorradorPresencialAction : guardarBorradorAction;
      const guardado = await accionBorrador(solicitud.id, aEntrada(items));
      if (!guardado.ok) {
        toast.error(guardado.mensaje);
        if (guardado.errores) {
          const keys = Object.keys(guardado.errores);
          if (keys.some((k) => ["telefono_movil", "telefono_habitacion", "correo_alternativo", "tiene_hijos"].includes(k))) {
            setErroresContacto(guardado.errores);
            const idx = pasos.indexOf("contacto");
            if (idx !== -1) setIndice(idx);
            return;
          }
          if (keys.some((k) => k.includes("emergencia") || k.includes("vivienda") || k.includes("direccion"))) {
            const idx = pasos.indexOf("emergencia");
            if (idx !== -1) setIndice(idx);
            return;
          }
          if (keys.some((k) => k.includes("familiar") || k.includes("hijo"))) {
            const idx = pasos.indexOf("hijos");
            if (idx !== -1) setIndice(idx);
            return;
          }
        }
        return;
      }
      const accionEnviar = esPresencial ? enviarPresencialAction : enviarSolicitudAction;
      const res = await accionEnviar(solicitud.id);
      if (!res.ok) {
        if (res.errores) {
          aplicarErroresServidor(confirmacion, res.errores);
          const keys = Object.keys(res.errores);
          if (keys.some((k) => ["telefono_movil", "telefono_habitacion", "correo_alternativo", "tiene_hijos"].includes(k))) {
            setErroresContacto(res.errores);
            const idx = pasos.indexOf("contacto");
            if (idx !== -1) setIndice(idx);
          } else if (keys.some((k) => k.includes("emergencia") || k.includes("vivienda") || k.includes("direccion"))) {
            const idx = pasos.indexOf("emergencia");
            if (idx !== -1) setIndice(idx);
          } else if (keys.some((k) => k.includes("familiar") || k.includes("hijo"))) {
            const idx = pasos.indexOf("hijos");
            if (idx !== -1) setIndice(idx);
          } else if (keys.some((k) => k.includes("evidencia") || k.includes("foto"))) {
            const idx = pasos.indexOf("foto");
            if (idx !== -1) setIndice(idx);
          }
        }
        toast.error(res.mensaje);
        return;
      }
      toast.success(
        esPresencial
          ? "Fe de vida presencial registrada y constancia emitida."
          : "Fe de vida enviada. Su constancia está lista.",
      );
      onActualizar();
    });
  }

  const fotoVigente = solicitud.tieneEvidencia || fotoSubida;
  const exigeNueva = requiereFotoNueva(solicitud) && !fotoSubida;
  const inicialesContacto = valoresIniciales(ficha, items);
  const conCambios = items.filter((i) => !(i.accion === "MODIFICAR" && i.campo === "tiene_hijos"));

  return (
    <div className="flex flex-col gap-6">
      <AvisoConectividad className="w-full" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Pasos de la fe de vida">
          <ol className="flex flex-wrap gap-2">
            {pasos.map((p, i) => (
              <li
                key={p}
                aria-current={i === indice ? "step" : undefined}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  i === indice
                    ? "border-primary bg-primary text-primary-foreground"
                    : i < indice
                      ? "border-success/40 bg-success-soft text-success"
                      : "text-muted-foreground"
                }`}
              >
                {i + 1}. {TITULOS[p]}
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        Paso {indice + 1} de {pasos.length}: {TITULOS[paso]}
      </p>

      {paso === "contacto" ? (
        <PasoContacto
          ficha={ficha}
          valoresIniciales={inicialesContacto}
          guardando={guardando}
          permiteSinCorreo={esPresencial}
          sinCorreoInicial={solicitud.sinCorreoAlternativo ?? false}
          justificacionInicial={solicitud.justificacionSinCorreo ?? ""}
          onContinuar={continuarContacto}
          erroresServidor={erroresContacto}
        />
      ) : null}

      {paso === "emergencia" ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="size-5 text-primary" aria-hidden />
            Contacto de emergencia y dirección de habitación
          </h2>
          <p className="text-base text-muted-foreground">
            Revise estos datos y corríjalos si cambiaron. Si están bien, continúe.
          </p>

          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 font-medium">
              <ShieldAlert className="size-4 text-primary" aria-hidden />
              <span>Ejemplo de contacto y vivienda:</span>
            </p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground flex flex-col gap-1">
              <li><strong>Contacto de emergencia:</strong> Familiar o persona de confianza (nombres, apellidos y teléfono activo).</li>
              <li><strong>Dirección de habitación:</strong> Estado, municipio, parroquia, avenida/calle y número de casa o edificio.</li>
            </ul>
          </div>

          {ENTIDADES_EMERGENCIA.map(([seccion, def]) => (
            <EditorEntidad
              key={def.entidad}
              seccion={seccion}
              definicion={def}
              ficha={ficha}
              items={items}
              nombres={nombres}
              camposHabilitados={CAMPOS_HABILITADOS}
              onItems={setItems}
            />
          ))}
          <NavegacionPasos
            guardando={guardando}
            puedeContinuar={viviendaOk}
            motivoBloqueo="Registre sus datos de vivienda para continuar."
            onAtras={() => setIndice(indice - 1)}
            onContinuar={() => guardarYAvanzar(items, indice + 1)}
          />
        </div>
      ) : null}

      {paso === "hijos" ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="size-5 text-primary" aria-hidden />
            Sus hijos
          </h2>
          <p className="text-base text-muted-foreground">
            {hayHijosRegistrados || hayHijoPropuesto
              ? "Aparecen los hijos que ya tenemos registrados. Corrija sus datos o agregue los que falten."
              : "No tiene hijos registrados. Use «Agregar familiar» para registrar al menos uno."}
          </p>

          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 font-medium">
              <Users className="size-4 text-primary" aria-hidden />
              <span>Ejemplo de registro de hijos:</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Indique la cédula (si tiene), nombres, apellidos y fecha de nacimiento de sus hijos menores de edad o dependientes directos.
            </p>
          </div>

          <EditorEntidad
            seccion="familiar"
            definicion={ENTIDAD_HIJOS}
            ficha={ficha}
            items={items}
            nombres={nombres}
            camposHabilitados={CAMPOS_HABILITADOS}
            onItems={setItems}
          />
          <NavegacionPasos
            guardando={guardando}
            puedeContinuar={hijosOk}
            motivoBloqueo="Registre al menos un hijo para continuar."
            onAtras={() => setIndice(indice - 1)}
            onContinuar={() => guardarYAvanzar(items, indice + 1)}
          />
        </div>
      ) : null}

      {paso === "foto" ? (
        <PasoFoto
          fotoVigente={fotoVigente}
          exigeNueva={exigeNueva}
          fotoElegida={foto?.archivo ?? null}
          subiendo={subiendo}
          mensajeSubida={mensajeSubida}
          fotoRecuperadaLocal={fotoRecuperadaLocal}
          onFoto={manejarFoto}
          onAtras={() => setIndice(indice - 1)}
          onContinuar={subirFotoYContinuar}
        />
      ) : null}

      {paso === "revisar" ? (
        <form
          onSubmit={confirmacion.handleSubmit(enviar)}
          noValidate
          className="flex flex-col gap-4"
        >
          <h2 className="text-xl font-semibold">Revise y envíe</h2>
          <section aria-labelledby="fv-resumen" className="rounded-lg border bg-card p-4">
            <h3 id="fv-resumen" className="text-base font-semibold">
              Datos que corrigió
            </h3>
            {conCambios.length === 0 ? (
              <p className="mt-2 text-base text-muted-foreground">
                No corrigió ningún dato: se confirman los que ya tenemos.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {conCambios.map((i, n) => (
                  <li key={`${i.entidad}-${i.campo}-${n}`} className="text-base">
                    <span className="font-medium">{etiquetaCampo(i.campo, i.entidad)}:</span>{" "}
                    {formatearValor(i.valor, i.campo, nombres)}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-base">
              {tieneHijos ? "Declaró que tiene hijos." : "Declaró que no tiene hijos."}
            </p>
            <p className="mt-1 text-base">
              Foto con la cédula: {fotoVigente ? "cargada" : "pendiente"}.
            </p>
          </section>
          <div className="flex flex-col gap-1.5">
            {/* Tarjeta de la declaración: es el paso que habilita el envío (azul institucional, verde al marcarla). */}
            <label
              className={cn(
                "group flex cursor-pointer items-start gap-4 rounded-xl border p-5 shadow-sm transition-all duration-200",
                confirmacion.watch("declaro")
                  ? "border-success/50 bg-success-soft ring-2 ring-success/20"
                  : "border-primary/25 bg-primary/5 hover:border-primary/50 hover:shadow-md",
              )}
            >
              <input
                type="checkbox"
                className="mt-1 size-5 accent-success transition-transform group-hover:scale-110"
                {...confirmacion.register("declaro")}
              />
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                  {confirmacion.watch("declaro") ? (
                    <ShieldCheck className="size-5 text-success" aria-hidden />
                  ) : (
                    <Shield className="size-5 text-primary" aria-hidden />
                  )}
                  Declaración jurada de fe de vida
                </span>
                <span className="text-base leading-relaxed text-muted-foreground">
                  Declaro bajo fe de juramento que la información suministrada y los recaudos
                  consignados son fidedignos y corresponden a mi persona.
                </span>
              </div>
            </label>
            {confirmacion.formState.errors.declaro ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {confirmacion.formState.errors.declaro.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setIndice(indice - 1)}
              disabled={enviando}
            >
              <ArrowLeft aria-hidden /> Atrás
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              disabled={
                enviando ||
                !confirmacion.watch("declaro") ||
                !puedeEnviarFeDeVida({ fotoVigente, viviendaOk, tieneHijos, hijosOk })
              }
            >
              {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {enviando ? "Enviando…" : "Enviar fe de vida"} <Send aria-hidden />
            </Button>
          </div>
          {!fotoVigente ? (
            <p role="status" className="text-sm font-medium text-warning">
              Debe cargar su foto con la cédula antes de enviar.
            </p>
          ) : null}
          {!viviendaOk ? (
            <p role="status" className="text-sm font-medium text-warning">
              Registre sus datos de vivienda antes de enviar.
            </p>
          ) : null}
          {tieneHijos && !hijosOk ? (
            <p role="status" className="text-sm font-medium text-warning">
              Registre al menos un hijo antes de enviar.
            </p>
          ) : null}
        </form>
      ) : null}
      <PanelGuiaFeDeVida
        abierto={guiaAbierta}
        onOpenChange={setGuiaAbierta}
        pasoActual={pasoFormularioAGuia(paso)}
      />
    </div>
  );
}

function NavegacionPasos({
  guardando,
  onAtras,
  onContinuar,
  puedeContinuar = true,
  motivoBloqueo = "Complete los datos obligatorios para continuar.",
}: {
  guardando: boolean;
  onAtras: () => void;
  onContinuar: () => void;
  puedeContinuar?: boolean;
  motivoBloqueo?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {!puedeContinuar ? (
        <p role="status" className="text-sm font-medium text-warning">
          {motivoBloqueo}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onAtras}
          disabled={guardando}
        >
          <ArrowLeft aria-hidden /> Atrás
        </Button>
        <Button
          type="button"
          className="min-h-11"
          onClick={onContinuar}
          disabled={guardando || !puedeContinuar}
        >
          {guardando ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {guardando ? "Guardando…" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
