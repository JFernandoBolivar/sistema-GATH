"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  Info,
  Layers,
  Loader2,
  Plus,
  Save,
  Trash2,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  guardarConfiguracionPuntoCuentaAction,
  obtenerConfiguracionPuntoCuentaAction,
} from "@/modules/puntocuenta/infrastructure/actions/puntocuenta-actions";
import {
  type ConfiguracionPuntoCuenta,
  type FirmaItem,
  type PlantillaProceso,
  type ProcesosHabilitados,
  type VariableDisponible,
  PROCESOS_METADATA,
  VARIABLES_FALLBACK,
  validarVariablesTexto,
} from "@/modules/puntocuenta/domain/entities/configuracion-punto-cuenta";
import { RUTA_CONFIGURACION } from "@/shared/lib/administracion-sistema";

const PLANTILLA_GENERAL_KEY = "general";
const PROCESOS_CLAVES = Object.keys(PROCESOS_METADATA) as (keyof ProcesosHabilitados)[];

const ASUNTO_DEFECTO = "Notificación y solicitud de aprobación para movimiento de personal de {nombre} (C.I. {cedula}).";
const EXPOSICION_DEFECTO =
  "Por medio del presente punto de cuenta, se somete a su digna consideración el movimiento administrativo del funcionario {nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}.\n\nDicho movimiento corresponde a {motivo}, trasladándose desde {origen} hacia {destino}, con fecha {fecha}.";
const PROPUESTA_DEFECTO =
  "Por las razones antes expuestas, se propone muy respetuosamente a la Máxima Autoridad aprobar el movimiento administrativo del funcionario {nombre} hacia {destino}.";
const BASE_LEGAL_DEFECTO =
  "De conformidad con lo dispuesto en el Estatuto de la Función Pública, el Reglamento Interno de la Comisión Nacional de Telecomunicaciones y demás normativa aplicable.";

export function ConfiguracionPuntoCuentaPage() {
  const [isPending, startTransition] = useTransition();
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Estados del formulario
  const [generar, setGenerar] = useState(false);
  const [procesos, setProcesos] = useState<ProcesosHabilitados>({
    cambio_oficina: true,
    cambio_nivel: false,
    cambio_division: false,
    cambio_cargo_misma_oficina: false,
    egreso_activo: false,
    pase_a_pasivo: false,
    encargaduria_prestamo: false,
    cambio_estatus: false,
  });

  // Plantilla General - Secciones Formales
  const [titulo, setTitulo] = useState("PUNTO DE CUENTA");
  const [encabezado, setEncabezado] = useState(ASUNTO_DEFECTO);
  const [cuerpo, setCuerpo] = useState(EXPOSICION_DEFECTO);
  const [presentadoA, setPresentadoA] = useState("Director(a) General de la Comisión Nacional de Telecomunicaciones");
  const [cargoPresentadoA, setCargoPresentadoA] = useState("Director(a) General");
  const [presentadoPor, setPresentadoPor] = useState("Director(a) General de Gestión Humana");
  const [cargoPresentadoPor, setCargoPresentadoPor] = useState("Director(a) General de Gestión Humana");
  const [unidad, setUnidad] = useState("Dirección General de Gestión Humana");
  const [asunto, setAsunto] = useState(ASUNTO_DEFECTO);
  const [exposicion, setExposicion] = useState(EXPOSICION_DEFECTO);
  const [propuesta, setPropuesta] = useState(PROPUESTA_DEFECTO);
  const [baseLegal, setBaseLegal] = useState(BASE_LEGAL_DEFECTO);
  const [observacionesTexto, setObservacionesTexto] = useState("");

  // Interruptores de secciones (General)
  const [incluirPresentadoA, setIncluirPresentadoA] = useState(true);
  const [incluirPresentadoPor, setIncluirPresentadoPor] = useState(true);
  const [incluirAsunto, setIncluirAsunto] = useState(true);
  const [incluirExposicion, setIncluirExposicion] = useState(true);
  const [incluirPropuesta, setIncluirPropuesta] = useState(true);
  const [incluirBaseLegal, setIncluirBaseLegal] = useState(true);
  const [incluirDecision, setIncluirDecision] = useState(true);
  const [incluirObservaciones, setIncluirObservaciones] = useState(true);
  const [incluirTablaResumen, setIncluirTablaResumen] = useState(false);
  const [incluirFirmas, setIncluirFirmas] = useState(true);

  // Plantillas por Proceso
  const [plantillasProcesos, setPlantillasProcesos] = useState<Record<string, PlantillaProceso>>({});
  const [tabActiva, setTabActiva] = useState<string>(PLANTILLA_GENERAL_KEY);

  // Formato compartido y firmas
  const [mostrarNivel, setMostrarNivel] = useState(true);
  const [firmas, setFirmas] = useState<FirmaItem[]>([
    { cargo: "Director(a) General de Gestión Humana", nombre: "" },
  ]);
  const [version, setVersion] = useState(1);
  const [variablesDisponibles, setVariablesDisponibles] = useState<VariableDisponible[]>(VARIABLES_FALLBACK);

  // Último campo enfocado para inserción de variables
  const [campoEnfocado, setCampoEnfocado] = useState<string>("exposicion");

  const tagsPermitidosSet = useMemo(
    () => new Set(variablesDisponibles.map((v) => v.tag)),
    [variablesDisponibles]
  );

  useEffect(() => {
    (async () => {
      setCargando(true);
      const res = await obtenerConfiguracionPuntoCuentaAction();
      if (res.success && res.data) {
        setGenerar(Boolean(res.data.generar));
        if (res.data.procesos_habilitados) {
          setProcesos(res.data.procesos_habilitados);
        }
        if (res.data.titulo) setTitulo(res.data.titulo);
        if (res.data.encabezado !== undefined) {
          setEncabezado(res.data.encabezado);
          if (res.data.asunto === undefined) setAsunto(res.data.encabezado);
        }
        if (res.data.cuerpo !== undefined) {
          setCuerpo(res.data.cuerpo);
          if (res.data.exposicion === undefined) setExposicion(res.data.cuerpo);
        }

        // Secciones formales
        if (res.data.presentado_a !== undefined) setPresentadoA(res.data.presentado_a);
        if (res.data.cargo_presentado_a !== undefined) setCargoPresentadoA(res.data.cargo_presentado_a);
        if (res.data.presentado_por !== undefined) setPresentadoPor(res.data.presentado_por);
        if (res.data.cargo_presentado_por !== undefined) setCargoPresentadoPor(res.data.cargo_presentado_por);
        if (res.data.unidad !== undefined) setUnidad(res.data.unidad);
        if (res.data.asunto !== undefined) setAsunto(res.data.asunto);
        if (res.data.exposicion !== undefined) setExposicion(res.data.exposicion);
        if (res.data.propuesta !== undefined) setPropuesta(res.data.propuesta);
        if (res.data.base_legal !== undefined) setBaseLegal(res.data.base_legal);
        if (res.data.observaciones_texto !== undefined) setObservacionesTexto(res.data.observaciones_texto);

        // Toggles
        if (res.data.incluir_presentado_a !== undefined) setIncluirPresentadoA(res.data.incluir_presentado_a);
        if (res.data.incluir_presentado_por !== undefined) setIncluirPresentadoPor(res.data.incluir_presentado_por);
        if (res.data.incluir_asunto !== undefined) setIncluirAsunto(res.data.incluir_asunto);
        if (res.data.incluir_exposicion !== undefined) setIncluirExposicion(res.data.incluir_exposicion);
        if (res.data.incluir_propuesta !== undefined) setIncluirPropuesta(res.data.incluir_propuesta);
        if (res.data.incluir_base_legal !== undefined) setIncluirBaseLegal(res.data.incluir_base_legal);
        if (res.data.incluir_decision !== undefined) setIncluirDecision(res.data.incluir_decision);
        if (res.data.incluir_observaciones !== undefined) setIncluirObservaciones(res.data.incluir_observaciones);
        if (res.data.incluir_tabla_resumen !== undefined) setIncluirTablaResumen(res.data.incluir_tabla_resumen);
        if (res.data.incluir_firmas !== undefined) setIncluirFirmas(res.data.incluir_firmas);

        if (res.data.plantillas_procesos) setPlantillasProcesos(res.data.plantillas_procesos);
        if (res.data.variables_disponibles && res.data.variables_disponibles.length > 0) {
          setVariablesDisponibles(res.data.variables_disponibles);
        }
        if (res.data.mostrar_nivel !== undefined) setMostrarNivel(res.data.mostrar_nivel);
        if (res.data.firmas && res.data.firmas.length > 0) setFirmas(res.data.firmas);
        if (res.data.version) setVersion(res.data.version);
      } else {
        toast.error("No fue posible cargar la configuración actual");
      }
      setCargando(false);
    })();
  }, []);

  const handleProcesoToggle = (clave: keyof ProcesosHabilitados) => {
    setProcesos((prev) => ({
      ...prev,
      [clave]: !prev[clave],
    }));
  };

  const plantillaActual = useMemo<PlantillaProceso>(() => {
    if (tabActiva === PLANTILLA_GENERAL_KEY) {
      return {
        personalizado: true,
        titulo,
        encabezado,
        cuerpo,
        presentado_a: presentadoA,
        cargo_presentado_a: cargoPresentadoA,
        presentado_por: presentadoPor,
        cargo_presentado_por: cargoPresentadoPor,
        unidad,
        asunto,
        exposicion,
        propuesta,
        base_legal: baseLegal,
        observaciones_texto: observacionesTexto,
        incluir_presentado_a: incluirPresentadoA,
        incluir_presentado_por: incluirPresentadoPor,
        incluir_asunto: incluirAsunto,
        incluir_exposicion: incluirExposicion,
        incluir_propuesta: incluirPropuesta,
        incluir_base_legal: incluirBaseLegal,
        incluir_decision: incluirDecision,
        incluir_observaciones: incluirObservaciones,
        incluir_tabla_resumen: incluirTablaResumen,
        incluir_firmas: incluirFirmas,
      };
    }
    const proc = plantillasProcesos[tabActiva];
    return {
      personalizado: Boolean(proc?.personalizado),
      titulo: proc?.titulo || "",
      encabezado: proc?.encabezado || "",
      cuerpo: proc?.cuerpo || "",
      presentado_a: proc?.presentado_a ?? presentadoA,
      cargo_presentado_a: proc?.cargo_presentado_a ?? cargoPresentadoA,
      presentado_por: proc?.presentado_por ?? presentadoPor,
      cargo_presentado_por: proc?.cargo_presentado_por ?? cargoPresentadoPor,
      unidad: proc?.unidad ?? unidad,
      asunto: proc?.asunto ?? asunto,
      exposicion: proc?.exposicion ?? exposicion,
      propuesta: proc?.propuesta ?? propuesta,
      base_legal: proc?.base_legal ?? baseLegal,
      observaciones_texto: proc?.observaciones_texto ?? observacionesTexto,
      incluir_presentado_a: proc?.incluir_presentado_a ?? incluirPresentadoA,
      incluir_presentado_por: proc?.incluir_presentado_por ?? incluirPresentadoPor,
      incluir_asunto: proc?.incluir_asunto ?? incluirAsunto,
      incluir_exposicion: proc?.incluir_exposicion ?? incluirExposicion,
      incluir_propuesta: proc?.incluir_propuesta ?? incluirPropuesta,
      incluir_base_legal: proc?.incluir_base_legal ?? incluirBaseLegal,
      incluir_decision: proc?.incluir_decision ?? incluirDecision,
      incluir_observaciones: proc?.incluir_observaciones ?? incluirObservaciones,
      incluir_tabla_resumen: proc?.incluir_tabla_resumen ?? incluirTablaResumen,
      incluir_firmas: proc?.incluir_firmas ?? incluirFirmas,
    };
  }, [
    tabActiva,
    titulo,
    encabezado,
    cuerpo,
    presentadoA,
    cargoPresentadoA,
    presentadoPor,
    cargoPresentadoPor,
    unidad,
    asunto,
    exposicion,
    propuesta,
    baseLegal,
    observacionesTexto,
    incluirPresentadoA,
    incluirPresentadoPor,
    incluirAsunto,
    incluirExposicion,
    incluirPropuesta,
    incluirBaseLegal,
    incluirDecision,
    incluirObservaciones,
    incluirTablaResumen,
    incluirFirmas,
    plantillasProcesos,
  ]);

  const erroresVariablesActuales = useMemo(() => {
    const camposValidar = [
      plantillaActual.titulo,
      plantillaActual.encabezado,
      plantillaActual.cuerpo,
      plantillaActual.asunto,
      plantillaActual.exposicion,
      plantillaActual.propuesta,
      plantillaActual.base_legal,
      plantillaActual.presentado_a,
      plantillaActual.cargo_presentado_a,
      plantillaActual.presentado_por,
      plantillaActual.cargo_presentado_por,
      plantillaActual.unidad,
      plantillaActual.observaciones_texto,
    ];
    const errores: string[] = [];
    for (const valor of camposValidar) {
      if (typeof valor === "string" && valor) {
        errores.push(...validarVariablesTexto(valor, tagsPermitidosSet));
      }
    }
    return Array.from(new Set(errores));
  }, [plantillaActual, tagsPermitidosSet]);

  const handleUpdatePlantillaActual = (campo: keyof PlantillaProceso, valor: unknown) => {
    if (tabActiva === PLANTILLA_GENERAL_KEY) {
      if (campo === "titulo") setTitulo(String(valor));
      if (campo === "encabezado") {
        setEncabezado(String(valor));
        setAsunto(String(valor));
      }
      if (campo === "cuerpo") {
        setCuerpo(String(valor));
        setExposicion(String(valor));
      }
      if (campo === "asunto") {
        setAsunto(String(valor));
        setEncabezado(String(valor));
      }
      if (campo === "exposicion") {
        setExposicion(String(valor));
        setCuerpo(String(valor));
      }
      if (campo === "propuesta") setPropuesta(String(valor));
      if (campo === "base_legal") setBaseLegal(String(valor));
      if (campo === "presentado_a") setPresentadoA(String(valor));
      if (campo === "cargo_presentado_a") setCargoPresentadoA(String(valor));
      if (campo === "presentado_por") setPresentadoPor(String(valor));
      if (campo === "cargo_presentado_por") setCargoPresentadoPor(String(valor));
      if (campo === "unidad") setUnidad(String(valor));
      if (campo === "observaciones_texto") setObservacionesTexto(String(valor));
      if (campo === "incluir_presentado_a") setIncluirPresentadoA(Boolean(valor));
      if (campo === "incluir_presentado_por") setIncluirPresentadoPor(Boolean(valor));
      if (campo === "incluir_asunto") setIncluirAsunto(Boolean(valor));
      if (campo === "incluir_exposicion") setIncluirExposicion(Boolean(valor));
      if (campo === "incluir_propuesta") setIncluirPropuesta(Boolean(valor));
      if (campo === "incluir_base_legal") setIncluirBaseLegal(Boolean(valor));
      if (campo === "incluir_decision") setIncluirDecision(Boolean(valor));
      if (campo === "incluir_observaciones") setIncluirObservaciones(Boolean(valor));
      if (campo === "incluir_tabla_resumen") setIncluirTablaResumen(Boolean(valor));
      if (campo === "incluir_firmas") setIncluirFirmas(Boolean(valor));
    } else {
      setPlantillasProcesos((prev) => {
        const actual = prev[tabActiva] || {
          personalizado: true,
          titulo: "",
          encabezado: "",
          cuerpo: "",
        };
        return {
          ...prev,
          [tabActiva]: {
            ...actual,
            [campo]: valor,
          },
        };
      });
    }
  };

  const handleTogglePersonalizado = (marcado: boolean) => {
    if (tabActiva === PLANTILLA_GENERAL_KEY) return;
    setPlantillasProcesos((prev) => {
      const actual = prev[tabActiva] || {
        personalizado: false,
        titulo: "",
        encabezado: "",
        cuerpo: "",
      };
      return {
        ...prev,
        [tabActiva]: {
          ...actual,
          personalizado: marcado,
          titulo: marcado ? actual.titulo || titulo : actual.titulo,
          encabezado: marcado ? actual.encabezado || encabezado : actual.encabezado,
          cuerpo: marcado ? actual.cuerpo || cuerpo : actual.cuerpo,
          asunto: marcado ? actual.asunto || asunto : actual.asunto,
          exposicion: marcado ? actual.exposicion || exposicion : actual.exposicion,
          propuesta: marcado ? actual.propuesta || propuesta : actual.propuesta,
          base_legal: marcado ? actual.base_legal || baseLegal : actual.base_legal,
          presentado_a: marcado ? actual.presentado_a || presentadoA : actual.presentado_a,
          cargo_presentado_a: marcado ? actual.cargo_presentado_a || cargoPresentadoA : actual.cargo_presentado_a,
          presentado_por: marcado ? actual.presentado_por || presentadoPor : actual.presentado_por,
          cargo_presentado_por: marcado ? actual.cargo_presentado_por || cargoPresentadoPor : actual.cargo_presentado_por,
          unidad: marcado ? actual.unidad || unidad : actual.unidad,
        },
      };
    });
  };

  const handleInsertarTag = (tag: string) => {
    // Inserta en el campo actualmente seleccionado (por defecto exposición o cuerpo)
    const campoTarget = campoEnfocado || "exposicion";
    const valorPrevio = String((plantillaActual as unknown as Record<string, unknown>)[campoTarget] ?? "");
    const nuevoValor = valorPrevio ? `${valorPrevio} ${tag}` : tag;
    handleUpdatePlantillaActual(campoTarget as keyof PlantillaProceso, nuevoValor);
  };

  const handleAddFirma = () => {
    setFirmas((prev) => [...prev, { cargo: "", nombre: "" }]);
  };

  const handleRemoveFirma = (index: number) => {
    setFirmas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateFirma = (index: number, campo: keyof FirmaItem, valor: string) => {
    setFirmas((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [campo]: valor } : f))
    );
  };

  const handleVistaPrevia = async () => {
    setIsPreviewPending(true);
    // La pestaña se abre en el mismo clic: si se abre después del `await`, el
    // bloqueador de ventanas emergentes la descarta sin avisar.
    const ventana = window.open("", "_blank");
    try {
      let procesoParam: string | undefined = undefined;
      if (tabActiva !== PLANTILLA_GENERAL_KEY) {
        procesoParam = tabActiva;
      }

      const payload = {
        titulo: plantillaActual.titulo || titulo,
        encabezado: plantillaActual.encabezado || encabezado,
        cuerpo: plantillaActual.cuerpo || cuerpo,
        asunto: plantillaActual.asunto || asunto,
        exposicion: plantillaActual.exposicion || exposicion,
        propuesta: plantillaActual.propuesta || propuesta,
        base_legal: plantillaActual.base_legal || baseLegal,
        presentado_a: plantillaActual.presentado_a || presentadoA,
        cargo_presentado_a: plantillaActual.cargo_presentado_a || cargoPresentadoA,
        presentado_por: plantillaActual.presentado_por || presentadoPor,
        cargo_presentado_por: plantillaActual.cargo_presentado_por || cargoPresentadoPor,
        unidad: plantillaActual.unidad || unidad,
        observaciones_texto: plantillaActual.observaciones_texto || observacionesTexto,
        incluir_presentado_a: plantillaActual.incluir_presentado_a ?? incluirPresentadoA,
        incluir_presentado_por: plantillaActual.incluir_presentado_por ?? incluirPresentadoPor,
        incluir_asunto: plantillaActual.incluir_asunto ?? incluirAsunto,
        incluir_exposicion: plantillaActual.incluir_exposicion ?? incluirExposicion,
        incluir_propuesta: plantillaActual.incluir_propuesta ?? incluirPropuesta,
        incluir_base_legal: plantillaActual.incluir_base_legal ?? incluirBaseLegal,
        incluir_decision: plantillaActual.incluir_decision ?? incluirDecision,
        incluir_observaciones: plantillaActual.incluir_observaciones ?? incluirObservaciones,
        incluir_tabla_resumen: plantillaActual.incluir_tabla_resumen ?? incluirTablaResumen,
        incluir_firmas: plantillaActual.incluir_firmas ?? incluirFirmas,
        firmas,
        mostrar_nivel: mostrarNivel,
        proceso: procesoParam,
        plantillas_procesos: plantillasProcesos,
      };

      const res = await fetch("/api/puntocuenta/vista-previa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "No fue posible generar la vista previa en PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      if (ventana && !ventana.closed) {
        ventana.location.href = url;
      } else {
        // Bloqueada igual: se descarga el PDF para que el clic no quede sin efecto.
        const a = document.createElement("a");
        a.href = url;
        a.download = "vista-previa-punto-de-cuenta.pdf";
        a.click();
        toast.info("El navegador bloqueó la pestaña; se descargó la vista previa.");
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      ventana?.close();
      toast.error(err instanceof Error ? err.message : "Error al generar la vista previa");
    } finally {
      setIsPreviewPending(false);
    }
  };

  const handleGuardar = () => {
    // Validar variables de la plantilla general
    const errGen = [
      ...validarVariablesTexto(titulo, tagsPermitidosSet),
      ...validarVariablesTexto(encabezado, tagsPermitidosSet),
      ...validarVariablesTexto(cuerpo, tagsPermitidosSet),
      ...validarVariablesTexto(asunto, tagsPermitidosSet),
      ...validarVariablesTexto(exposicion, tagsPermitidosSet),
      ...validarVariablesTexto(propuesta, tagsPermitidosSet),
      ...validarVariablesTexto(baseLegal, tagsPermitidosSet),
      ...validarVariablesTexto(presentadoA, tagsPermitidosSet),
      ...validarVariablesTexto(cargoPresentadoA, tagsPermitidosSet),
      ...validarVariablesTexto(presentadoPor, tagsPermitidosSet),
      ...validarVariablesTexto(cargoPresentadoPor, tagsPermitidosSet),
      ...validarVariablesTexto(unidad, tagsPermitidosSet),
    ];
    if (errGen.length > 0) {
      toast.error(`La plantilla general contiene variables no válidas: ${Array.from(new Set(errGen)).join(", ")}`);
      return;
    }

    // Validar variables de cada plantilla personalizada
    for (const [procKey, plantilla] of Object.entries(plantillasProcesos)) {
      if (plantilla.personalizado) {
        const errProc = [
          ...validarVariablesTexto(plantilla.titulo, tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.encabezado, tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.cuerpo, tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.asunto || "", tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.exposicion || "", tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.propuesta || "", tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.base_legal || "", tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.presentado_a || "", tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.cargo_presentado_a || "", tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.presentado_por || "", tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.cargo_presentado_por || "", tagsPermitidosSet),
          ...validarVariablesTexto(plantilla.unidad || "", tagsPermitidosSet),
        ];
        if (errProc.length > 0) {
          const meta = PROCESOS_METADATA[procKey as keyof ProcesosHabilitados];
          toast.error(
            `La plantilla de "${meta?.titulo || procKey}" contiene variables no válidas: ${Array.from(new Set(errProc)).join(", ")}`
          );
          return;
        }
      }
    }

    startTransition(async () => {
      const datos: Partial<ConfiguracionPuntoCuenta> = {
        generar,
        procesos_habilitados: procesos,
        titulo: titulo.trim(),
        encabezado,
        cuerpo,
        presentado_a: presentadoA,
        cargo_presentado_a: cargoPresentadoA,
        presentado_por: presentadoPor,
        cargo_presentado_por: cargoPresentadoPor,
        unidad,
        asunto,
        exposicion,
        propuesta,
        base_legal: baseLegal,
        observaciones_texto: observacionesTexto,
        incluir_presentado_a: incluirPresentadoA,
        incluir_presentado_por: incluirPresentadoPor,
        incluir_asunto: incluirAsunto,
        incluir_exposicion: incluirExposicion,
        incluir_propuesta: incluirPropuesta,
        incluir_base_legal: incluirBaseLegal,
        incluir_decision: incluirDecision,
        incluir_observaciones: incluirObservaciones,
        incluir_tabla_resumen: incluirTablaResumen,
        incluir_firmas: incluirFirmas,
        plantillas_procesos: plantillasProcesos,
        firmas,
        mostrar_nivel: mostrarNivel,
      };

      const res = await guardarConfiguracionPuntoCuentaAction(datos);
      if (res.success && res.data) {
        toast.success(`Configuración guardada correctamente (Versión ${res.data.version}).`);
        setVersion(res.data.version);
      } else {
        toast.error(res.error || "Error al guardar la configuración");
      }
    });
  };

  if (cargando) {
    return (
      <PageLayout title="Configuración de Punto de Cuenta" description="Cargando configuración...">
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin mr-2 text-primary" />
          Cargando configuración...
        </div>
      </PageLayout>
    );
  }

  // Filtrar solo los procesos habilitados para las pestañas
  const procesosHabilitadosParaPlantilla = PROCESOS_CLAVES.filter((k) => Boolean(procesos[k]));

  return (
    <PageLayout
      title="Configuración de Punto de Cuenta"
      description="Estructura formal de la Administración Pública venezolana, procesos que generan punto de cuenta y diseño de plantillas en PDF."
    >
      <div className="space-y-6">
        {/* Volver y Versión */}
        <div className="flex items-center justify-between">
          <Link
            href={RUTA_CONFIGURACION}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Volver a Configuración
          </Link>
          <Badge variant="outline" className="text-xs">
            Versión de configuración: v{version}
          </Badge>
        </div>

        {/* 1. Interruptor Maestro */}
        <Card className={generar ? "border-primary/50 bg-primary/5" : "border-muted"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Generación de puntos de cuenta</CardTitle>
                <CardDescription>
                  Interruptor general del sistema. Cuando está desactivado, ningún movimiento genera punto de cuenta ni se muestra el aviso de descarga.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {generar ? "Activo" : "Inactivo"}
                </span>
                <Switch
                  checked={generar}
                  onCheckedChange={setGenerar}
                  aria-label="Generar puntos de cuenta"
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 2. Procesos que generan Punto de Cuenta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos y procesos habilitados</CardTitle>
            <CardDescription>
              Indique qué operaciones administrativas generan automáticamente punto de cuenta. Cada movimiento habilitado puede personalizar su propia plantilla.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {PROCESOS_CLAVES.map((clave) => {
                const meta = PROCESOS_METADATA[clave];
                const estaHabilitado = Boolean(procesos[clave]);
                const tienePersonalizada = Boolean(plantillasProcesos[clave]?.personalizado);
                return (
                  <div
                    key={clave}
                    className={`flex items-start justify-between p-3 rounded-lg border transition-colors ${
                      estaHabilitado ? "bg-card border-border" : "bg-muted/30 border-muted text-muted-foreground"
                    }`}
                  >
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`proc-${clave}`} className="text-sm font-medium cursor-pointer">
                          {meta.titulo}
                        </Label>
                        {estaHabilitado && tienePersonalizada && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                            Personalizada
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{meta.descripcion}</p>
                    </div>
                    <Switch
                      id={`proc-${clave}`}
                      checked={estaHabilitado}
                      onCheckedChange={() => handleProcesoToggle(clave)}
                      aria-label={`Habilitar ${meta.titulo}`}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 3. Variables Dinámicas Disponibles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="size-4" aria-hidden /> Variables dinámicas disponibles
            </CardTitle>
            <CardDescription>
              Haga clic en cualquiera de las tarjetitas para insertarla en el campo activo. Todas provienen del diccionario canónico del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5" role="region" aria-label="Variables disponibles">
              {variablesDisponibles.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => handleInsertarTag(v.tag)}
                  title={v.desc}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono bg-muted/80 hover:bg-primary/10 hover:text-primary text-foreground border border-border/60 transition-colors cursor-pointer"
                >
                  <span className="font-semibold">{v.tag}</span>
                  <span className="text-[10px] text-muted-foreground font-sans truncate max-w-[150px]">
                    · {v.desc}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Plantillas y Secciones del Documento PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" aria-hidden /> Estructura y secciones del documento PDF
            </CardTitle>
            <CardDescription>
              Diseñado según el estándar oficial de la Administración Pública venezolana: cintillo institucional sin duplicación de título, remisión (Presentado a / por), Asunto, Exposición de Motivos, Propuesta, Base Legal, Casillas de Decisión y Firmas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Pestañas de plantillas */}
            <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
              <div className="pb-1">
                <TabsList className="h-auto flex flex-wrap gap-1 bg-muted/60 p-1 justify-start">
                  <TabsTrigger value={PLANTILLA_GENERAL_KEY} className="text-xs">
                    Plantilla general
                  </TabsTrigger>
                  {procesosHabilitadosParaPlantilla.map((clave) => {
                    const meta = PROCESOS_METADATA[clave];
                    const esPersonalizado = Boolean(plantillasProcesos[clave]?.personalizado);
                    return (
                      <TabsTrigger key={clave} value={clave} className="text-xs gap-1.5">
                        <span>{meta.titulo}</span>
                        {esPersonalizado ? (
                          <span className="size-1.5 rounded-full bg-primary" aria-label="Personalizado" />
                        ) : null}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Contenido de Plantilla General */}
              <TabsContent value={PLANTILLA_GENERAL_KEY} className="space-y-5 pt-3">
                <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="size-4 mt-0.5 text-primary shrink-0" aria-hidden />
                  <p>
                    Esta es la <strong>plantilla general predeterminada</strong>. Los movimientos habilitados que no cuenten con una plantilla personalizada utilizarán estos mismos textos y secciones.
                  </p>
                </div>

                {/* Título */}
                <div>
                  <Label htmlFor="titulo-general" className="text-xs font-semibold">
                    Denominación del documento
                  </Label>
                  <Input
                    id="titulo-general"
                    value={titulo}
                    onFocus={() => setCampoEnfocado("titulo")}
                    onChange={(e) => handleUpdatePlantillaActual("titulo", e.target.value)}
                    placeholder="PUNTO DE CUENTA"
                    className="mt-1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Se muestra en la identificación superior como «PUNTO DE CUENTA N.º XXXX-AAAA» sin repetirse en el cintillo.
                  </p>
                </div>

                {/* Bloque de Remisión: Presentado a / Presentado por / Unidad */}
                <div className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <div className="flex items-center gap-2">
                      <UserCheck className="size-4 text-primary" aria-hidden />
                      <Label className="text-sm font-semibold">Bloque de Remisión (Presentado A / Presentado POR)</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          id="switch-remision-a"
                          checked={incluirPresentadoA}
                          onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_presentado_a", val)}
                        />
                        <Label htmlFor="switch-remision-a" className="text-xs">Presentado A</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          id="switch-remision-por"
                          checked={incluirPresentadoPor}
                          onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_presentado_por", val)}
                        />
                        <Label htmlFor="switch-remision-por" className="text-xs">Presentado POR</Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <div>
                      <Label className="text-xs font-medium">PRESENTADO A (Destinatario):</Label>
                      <Input
                        value={presentadoA}
                        onFocus={() => setCampoEnfocado("presentado_a")}
                        onChange={(e) => handleUpdatePlantillaActual("presentado_a", e.target.value)}
                        placeholder="Director(a) General de CONATEL"
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Cargo del Destinatario:</Label>
                      <Input
                        value={cargoPresentadoA}
                        onFocus={() => setCampoEnfocado("cargo_presentado_a")}
                        onChange={(e) => handleUpdatePlantillaActual("cargo_presentado_a", e.target.value)}
                        placeholder="Director General"
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">PRESENTADO POR (Remitente):</Label>
                      <Input
                        value={presentadoPor}
                        onFocus={() => setCampoEnfocado("presentado_por")}
                        onChange={(e) => handleUpdatePlantillaActual("presentado_por", e.target.value)}
                        placeholder="Director(a) General de Gestión Humana"
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Unidad u Oficina Emisora:</Label>
                      <Input
                        value={unidad}
                        onFocus={() => setCampoEnfocado("unidad")}
                        onChange={(e) => handleUpdatePlantillaActual("unidad", e.target.value)}
                        placeholder="Dirección General de Gestión Humana"
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección Asunto */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="asunto-general" className="text-xs font-semibold">
                      ASUNTO
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Activo en PDF</span>
                      <Switch
                        checked={incluirAsunto}
                        onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_asunto", val)}
                      />
                    </div>
                  </div>
                  <Textarea
                    id="asunto-general"
                    value={asunto}
                    onFocus={() => setCampoEnfocado("asunto")}
                    onChange={(e) => handleUpdatePlantillaActual("asunto", e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                {/* Sección Síntesis / Exposición de Motivos */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exposicion-general" className="text-xs font-semibold">
                      SÍNTESIS / EXPOSICIÓN DE MOTIVOS
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Activo en PDF</span>
                      <Switch
                        checked={incluirExposicion}
                        onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_exposicion", val)}
                      />
                    </div>
                  </div>
                  <Textarea
                    id="exposicion-general"
                    value={exposicion}
                    onFocus={() => setCampoEnfocado("exposicion")}
                    onChange={(e) => handleUpdatePlantillaActual("exposicion", e.target.value)}
                    rows={4}
                    className="text-xs"
                  />
                </div>

                {/* Sección Propuesta */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="propuesta-general" className="text-xs font-semibold">
                      PROPUESTA
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Activo en PDF</span>
                      <Switch
                        checked={incluirPropuesta}
                        onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_propuesta", val)}
                      />
                    </div>
                  </div>
                  <Textarea
                    id="propuesta-general"
                    value={propuesta}
                    onFocus={() => setCampoEnfocado("propuesta")}
                    onChange={(e) => handleUpdatePlantillaActual("propuesta", e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>

                {/* Sección Base Legal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="base-legal-general" className="text-xs font-semibold">
                      BASE LEGAL (opcional)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Activo en PDF</span>
                      <Switch
                        checked={incluirBaseLegal}
                        onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_base_legal", val)}
                      />
                    </div>
                  </div>
                  <Textarea
                    id="base-legal-general"
                    value={baseLegal}
                    onFocus={() => setCampoEnfocado("base_legal")}
                    onChange={(e) => handleUpdatePlantillaActual("base_legal", e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                {/* Controles de Decisión y Observaciones */}
                <div className="grid gap-3 sm:grid-cols-3 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5 pr-2">
                      <Label className="text-xs font-semibold">Casillas de Decisión</Label>
                      <p className="text-[10px] text-muted-foreground">Aprobado, Negado, Diferido, Visto</p>
                    </div>
                    <Switch
                      checked={incluirDecision}
                      onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_decision", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5 pr-2">
                      <Label className="text-xs font-semibold">Observaciones / Guías</Label>
                      <p className="text-[10px] text-muted-foreground">Líneas para anotaciones de la autoridad</p>
                    </div>
                    <Switch
                      checked={incluirObservaciones}
                      onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_observaciones", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5 pr-2">
                      <Label className="text-xs font-semibold">Tabla Resumen de Datos</Label>
                      <p className="text-[10px] text-muted-foreground">Apagada por defecto (datos en redacción)</p>
                    </div>
                    <Switch
                      checked={incluirTablaResumen}
                      onCheckedChange={(val) => handleUpdatePlantillaActual("incluir_tabla_resumen", val)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Contenido de cada Proceso Específico */}
              {procesosHabilitadosParaPlantilla.map((clave) => {
                const meta = PROCESOS_METADATA[clave];
                const procConfig = plantillasProcesos[clave];
                const esPersonalizado = Boolean(procConfig?.personalizado);

                return (
                  <TabsContent key={clave} value={clave} className="space-y-4 pt-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <Label htmlFor={`switch-custom-${clave}`} className="text-sm font-semibold">
                          Personalizar plantilla para {meta.titulo}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {esPersonalizado
                            ? "Plantilla exclusiva activa para este movimiento."
                            : "Actualmente hereda la plantilla general predeterminada."}
                        </p>
                      </div>
                      <Switch
                        id={`switch-custom-${clave}`}
                        checked={esPersonalizado}
                        onCheckedChange={handleTogglePersonalizado}
                        aria-label={`Personalizar plantilla para ${meta.titulo}`}
                      />
                    </div>

                    {!esPersonalizado ? (
                      <div className="space-y-3 opacity-60 pointer-events-none p-3 border rounded-lg bg-muted/10">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-muted-foreground" aria-hidden />
                          Usando plantilla general:
                        </p>
                        <div>
                          <Label className="text-xs">Título</Label>
                          <Input value={titulo} disabled className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Encabezado</Label>
                          <Textarea value={encabezado} disabled rows={2} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Cuerpo</Label>
                          <Textarea value={cuerpo} disabled rows={3} className="mt-1" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`titulo-${clave}`} className="text-xs font-semibold">
                            Título para {meta.titulo}
                          </Label>
                          <Input
                            id={`titulo-${clave}`}
                            value={procConfig?.titulo || ""}
                            onFocus={() => setCampoEnfocado("titulo")}
                            onChange={(e) => handleUpdatePlantillaActual("titulo", e.target.value)}
                            placeholder={`PUNTO DE CUENTA - ${meta.titulo.toUpperCase()}`}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`encabezado-${clave}`} className="text-xs font-semibold">
                            Texto de encabezado / Asunto
                          </Label>
                          <Textarea
                            id={`encabezado-${clave}`}
                            value={procConfig?.encabezado || procConfig?.asunto || ""}
                            onFocus={() => setCampoEnfocado("asunto")}
                            onChange={(e) => {
                              handleUpdatePlantillaActual("encabezado", e.target.value);
                              handleUpdatePlantillaActual("asunto", e.target.value);
                            }}
                            placeholder={asunto}
                            rows={2}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`cuerpo-${clave}`} className="text-xs font-semibold">
                            Texto del cuerpo / Exposición de motivos
                          </Label>
                          <Textarea
                            id={`cuerpo-${clave}`}
                            value={procConfig?.cuerpo || procConfig?.exposicion || ""}
                            onFocus={() => setCampoEnfocado("exposicion")}
                            onChange={(e) => {
                              handleUpdatePlantillaActual("cuerpo", e.target.value);
                              handleUpdatePlantillaActual("exposicion", e.target.value);
                            }}
                            placeholder={exposicion}
                            rows={4}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`propuesta-${clave}`} className="text-xs font-semibold">
                            Propuesta formal para este movimiento
                          </Label>
                          <Textarea
                            id={`propuesta-${clave}`}
                            value={procConfig?.propuesta || ""}
                            onFocus={() => setCampoEnfocado("propuesta")}
                            onChange={(e) => handleUpdatePlantillaActual("propuesta", e.target.value)}
                            placeholder={propuesta}
                            rows={3}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>

            {/* Alerta de variables no válidas si existen en la plantilla activa */}
            {erroresVariablesActuales.length > 0 && (
              <div role="alert" className="p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-xs space-y-1">
                <p className="font-semibold">Variables no reconocidas en el texto:</p>
                <p>
                  {erroresVariablesActuales.join(", ")} no son variables válidas. Las variables permitidas son:{" "}
                  {variablesDisponibles.map((v) => v.tag).join(", ")}.
                </p>
              </div>
            )}

            {/* Ajustes de nivel y firmas (comunes) */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="switch-nivel" className="text-sm font-medium">Mostrar Nivel administrativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Acompaña el nombre de la oficina con su nivel (ej. «Gerencia de Operaciones (Nivel Central)»).
                  </p>
                </div>
                <Switch id="switch-nivel" checked={mostrarNivel} onCheckedChange={setMostrarNivel} />
              </div>

              {/* Firmas comunes */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Firmantes del documento (común para todas las plantillas)</Label>
                    <p className="text-xs text-muted-foreground">
                      Cargos y nombres que firman al pie del punto de cuenta.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddFirma}
                    className="gap-1 text-xs"
                  >
                    <Plus className="size-3.5" /> Añadir firmante
                  </Button>
                </div>

                <div className="space-y-2">
                  {firmas.map((firma, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Cargo (ej. Director General de Gestión Humana)"
                        value={firma.cargo}
                        onChange={(e) => handleUpdateFirma(idx, "cargo", e.target.value)}
                        className="text-xs"
                        aria-label={`Cargo del firmante ${idx + 1}`}
                      />
                      <Input
                        placeholder="Nombre completo (opcional)"
                        value={firma.nombre}
                        onChange={(e) => handleUpdateFirma(idx, "nombre", e.target.value)}
                        className="text-xs"
                        aria-label={`Nombre del firmante ${idx + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFirma(idx)}
                        disabled={firmas.length <= 1}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`Eliminar firmante ${idx + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Acciones finales */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleVistaPrevia}
                disabled={isPreviewPending || erroresVariablesActuales.length > 0}
                className="gap-2 text-xs"
              >
                {isPreviewPending ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                Previsualizar PDF formal
              </Button>

              <Button
                type="button"
                onClick={handleGuardar}
                disabled={isPending || erroresVariablesActuales.length > 0}
                className="gap-2"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar configuración
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
