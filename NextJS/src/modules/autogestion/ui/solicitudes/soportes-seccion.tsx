"use client";

import { useId, useRef, useState, useTransition } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CapturaFoto } from "@/shared/components/captura-foto/captura-foto";
import type { SeccionCodigo, SoporteEntity } from "../../domain/entities/solicitud-actualizacion";
import { validarArchivoSoporte, formatearTamano } from "../../domain/services/validar-soporte";
import { TIPOS_SOPORTE_POR_SECCION } from "../../domain/value-objects/campos-seccion";
import {
  eliminarSoporteAction,
  subirSoporteAction,
} from "../../infrastructure/actions/solicitudes-actions";
import { CLASE_CONTROL } from "./selector-catalogo";

interface Props {
  solicitudId: string;
  seccion: SeccionCodigo;
  soportes: SoporteEntity[];
  obligatorio: boolean;
  /** Se llama tras subir o quitar para recargar el detalle. */
  onCambio: () => void;
}

function EnlaceSoporte({ s }: { s: SoporteEntity }) {
  return (
    <a
      href={s.urlArchivo}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-2 break-all text-primary underline-offset-2 hover:underline"
    >
      <FileText className="size-4 shrink-0" aria-hidden />
      {s.nombreOriginal || "Soporte"} ({formatearTamano(s.tamanoBytes)})
    </a>
  );
}

/** Soportes documentales de una sección: PDF/JPG/PNG hasta 10 MB, validados en el cliente y en el servidor. */
export function SoportesSeccion({ solicitudId, seccion, soportes, obligatorio, onCambio }: Props) {
  const idBase = useId();
  const tipos = TIPOS_SOPORTE_POR_SECCION[seccion];
  const [tipo, setTipo] = useState(tipos[0].valor);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const propios = soportes.filter((s) => s.seccion === seccion);

  function subir(archivo: File) {
    const problema = validarArchivoSoporte(archivo, false);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    iniciar(async () => {
      const datos = new FormData();
      datos.set("solicitudId", solicitudId);
      datos.set("seccion", seccion);
      datos.set("tipo", tipo);
      datos.set("file", archivo);
      const res = await subirSoporteAction(datos);
      if (res.ok) {
        toast.success(res.mensaje);
        if (entrada.current) entrada.current.value = "";
        onCambio();
      } else {
        setError(res.mensaje);
      }
    });
  }

  function quitar(id: string) {
    iniciar(async () => {
      const res = await eliminarSoporteAction(solicitudId, id);
      if (res.ok) onCambio();
      else setError(res.mensaje);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Paperclip className="size-5" aria-hidden /> Soportes
        {obligatorio ? (
          <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-sm font-semibold text-warning">
            Obligatorio
          </span>
        ) : null}
      </h3>
      {obligatorio && propios.length === 0 ? (
        <p className="text-sm text-warning">
          Esta sección exige al menos un soporte para poder enviarse.
        </p>
      ) : null}

      {propios.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {propios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
              <EnlaceSoporte s={s} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendiente}
                onClick={() => quitar(s.id)}
              >
                <Trash2 aria-hidden /> Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idBase}-tipo`} className="text-base font-medium">
            Tipo de documento
          </label>
          <select
            id={`${idBase}-tipo`}
            className={CLASE_CONTROL}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {tipos.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idBase}-archivo`} className="text-base font-medium">
            Archivo (PDF, JPG o PNG, hasta 10 MB)
          </label>
          <input
            ref={entrada}
            id={`${idBase}-archivo`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={pendiente}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) subir(archivo);
            }}
            className="min-h-11 rounded-md border border-input bg-card p-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:font-semibold file:text-primary-foreground"
          />
        </div>
      </div>
      {pendiente ? (
        <p role="status" className="text-sm text-muted-foreground">
          Procesando…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Foto de perfil (carnet): cámara del dispositivo o archivo; reemplaza a la anterior. */
export function FotoSeccion({
  solicitudId,
  soportes,
  onCambio,
}: {
  solicitudId: string;
  soportes: SoporteEntity[];
  onCambio: () => void;
}) {
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [clave, setClave] = useState(0);
  const actual = soportes.find((s) => s.seccion === "foto");

  function guardar() {
    if (!foto) return;
    iniciar(async () => {
      const datos = new FormData();
      datos.set("solicitudId", solicitudId);
      datos.set("seccion", "foto");
      datos.set("tipo", "FOTO");
      datos.set("file", foto);
      const res = await subirSoporteAction(datos);
      if (res.ok) {
        toast.success("Foto cargada. Se enviará con su solicitud.");
        setFoto(null);
        setClave((c) => c + 1);
        setError(null);
        onCambio();
      } else {
        setError(res.mensaje);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      {actual ? (
        <p className="text-base">
          Foto cargada para esta solicitud: <EnlaceSoporte s={actual} />. Puede reemplazarla con
          otra.
        </p>
      ) : (
        <p className="text-base text-muted-foreground">Aún no ha cargado una foto nueva.</p>
      )}
      <CapturaFoto
        key={clave}
        etiqueta="Nueva foto de perfil"
        nombreArchivo="foto-perfil.jpg"
        disabled={pendiente}
        onChange={(f) => setFoto(f)}
      />
      {foto ? (
        <Button type="button" className="w-fit" onClick={guardar} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar foto"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
