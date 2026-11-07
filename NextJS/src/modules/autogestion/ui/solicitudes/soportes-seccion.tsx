"use client";

import { useId, useState, useTransition } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CapturaFoto } from "@/shared/components/captura-foto/captura-foto";
import { ArchivoElegido, ZonaSubida } from "@/shared/components/zona-subida/zona-subida";
import type { SeccionCodigo, SoporteEntity } from "../../domain/entities/solicitud-actualizacion";
import {
  MAX_BYTES_SOPORTE,
  validarArchivoSoporte,
  formatearTamano,
} from "../../domain/services/validar-soporte";
import { TIPOS_SOPORTE_POR_SECCION } from "../../domain/value-objects/campos-seccion";
import {
  eliminarSoporteAction,
  subirSoporteAction,
} from "../../infrastructure/actions/solicitudes-actions";

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

/** Formatos admitidos por el input (espejo de EXTENSIONES_SOPORTE y sus tipos MIME). */
const ACCEPT_SOPORTE = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const TEXTO_FORMATOS = `PDF, JPG o PNG, hasta ${MAX_BYTES_SOPORTE / (1024 * 1024)} MB`;

interface SelectorTipoProps {
  id: string;
  etiqueta: string;
  tipos: ReadonlyArray<{ valor: string; texto: string }>;
  valor: string;
  onCambio: (valor: string) => void;
  disabled?: boolean;
  claseEtiqueta?: string;
}

/** Lista desplegable del sistema para el tipo de documento. */
function SelectorTipo({
  id,
  etiqueta,
  tipos,
  valor,
  onCambio,
  disabled,
  claseEtiqueta = "text-base font-medium",
}: SelectorTipoProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={claseEtiqueta}>
        {etiqueta}
      </label>
      <Select value={valor} onValueChange={onCambio} disabled={disabled}>
        <SelectTrigger id={id} className="min-h-11 w-full text-base">
          <SelectValue placeholder="Seleccione un tipo" />
        </SelectTrigger>
        <SelectContent>
          {tipos.map((t) => (
            <SelectItem key={t.valor} value={t.valor}>
              {t.texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Zona de carga o, si ya hay un archivo en curso, su nombre con opción de quitarlo. */
function CargaArchivo({
  archivo,
  etiqueta,
  pendiente,
  onArchivo,
  onQuitar,
}: {
  archivo: File | null;
  etiqueta: string;
  pendiente: boolean;
  onArchivo: (archivo: File) => void;
  onQuitar: () => void;
}) {
  if (archivo) {
    return (
      <ArchivoElegido
        nombre={archivo.name}
        detalle={formatearTamano(archivo.size)}
        disabled={pendiente}
        onQuitar={onQuitar}
      />
    );
  }
  return (
    <ZonaSubida
      etiquetaZona={etiqueta}
      etiquetaInput={etiqueta}
      accept={ACCEPT_SOPORTE}
      titulo="Haz clic aquí para seleccionar"
      detalle={TEXTO_FORMATOS}
      ayuda="o arrastra y suelta el archivo"
      disabled={pendiente}
      onArchivo={onArchivo}
    />
  );
}

/** Soportes documentales de una sección: PDF/JPG/PNG hasta 10 MB, validados en el cliente y en el servidor. */
export function SoportesSeccion({ solicitudId, seccion, soportes, obligatorio, onCambio }: Props) {
  const idBase = useId();
  const tipos = TIPOS_SOPORTE_POR_SECCION[seccion];
  const [tipo, setTipo] = useState(tipos[0]?.valor ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [archivo, setArchivo] = useState<File | null>(null);
  const propios = soportes.filter((s) => s.seccion === seccion);

  if (tipos.length === 0) return null;

  function subir(elegido: File) {
    const problema = validarArchivoSoporte(elegido, false);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setArchivo(elegido);
    iniciar(async () => {
      const datos = new FormData();
      datos.set("solicitudId", solicitudId);
      datos.set("seccion", seccion);
      datos.set("tipo", tipo);
      datos.set("file", elegido);
      const res = await subirSoporteAction(datos);
      if (res.ok) {
        toast.success(res.mensaje);
        setArchivo(null);
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

      <div className="flex flex-col gap-3">
        <div className="sm:max-w-sm">
          <SelectorTipo
            id={`${idBase}-tipo`}
            etiqueta="Tipo de documento"
            tipos={tipos}
            valor={tipo}
            onCambio={setTipo}
            disabled={pendiente}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-medium">Archivo ({TEXTO_FORMATOS})</p>
          <CargaArchivo
            archivo={archivo}
            etiqueta={`Archivo (${TEXTO_FORMATOS})`}
            pendiente={pendiente}
            onArchivo={subir}
            onQuitar={() => {
              setArchivo(null);
              setError(null);
            }}
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

/** Soporte de UN registro concreto (documento que respalda la cédula, el parentesco o el título). */
export function SoporteRegistro({
  solicitudId,
  seccion,
  entidadId,
  referencia,
  soportes,
  onCambio,
}: {
  solicitudId: string;
  seccion: SeccionCodigo;
  entidadId?: string | null;
  referencia?: string | null;
  soportes: SoporteEntity[];
  onCambio: () => void;
}) {
  const idBase = useId();
  const tipos = TIPOS_SOPORTE_POR_SECCION[seccion];
  const [tipo, setTipo] = useState(tipos[0]?.valor ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [archivo, setArchivo] = useState<File | null>(null);
  const propios = soportes.filter(
    (s) =>
      s.seccion === seccion &&
      ((entidadId && s.entidadId === entidadId) || (referencia && s.referencia === referencia)),
  );

  if (tipos.length === 0) return null;

  function subir(elegido: File) {
    const problema = validarArchivoSoporte(elegido, false);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setArchivo(elegido);
    iniciar(async () => {
      const datos = new FormData();
      datos.set("solicitudId", solicitudId);
      datos.set("seccion", seccion);
      datos.set("tipo", tipo);
      if (entidadId) datos.set("entidadId", entidadId);
      if (referencia) datos.set("referencia", referencia);
      datos.set("file", elegido);
      const res = await subirSoporteAction(datos);
      if (res.ok) {
        toast.success(res.mensaje);
        setArchivo(null);
        onCambio();
      } else {
        setError(res.mensaje);
      }
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-dashed p-3">
      <p className="text-sm font-medium">Documento que respalda este registro</p>
      {propios.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {propios.map((s) => (
            <li key={s.id}>
              <EnlaceSoporte s={s} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no ha cargado el documento.</p>
      )}
      <div className="flex flex-col gap-2">
        <SelectorTipo
          id={`${idBase}-tipo`}
          etiqueta="Tipo"
          claseEtiqueta="text-sm"
          tipos={tipos}
          valor={tipo}
          onCambio={setTipo}
          disabled={pendiente}
        />
        <CargaArchivo
          archivo={archivo}
          etiqueta={`Archivo del registro (${TEXTO_FORMATOS})`}
          pendiente={pendiente}
          onArchivo={subir}
          onQuitar={() => {
            setArchivo(null);
            setError(null);
          }}
        />
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
