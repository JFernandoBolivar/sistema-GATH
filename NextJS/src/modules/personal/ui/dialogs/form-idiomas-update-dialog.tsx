"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { EntradaIdioma, IdiomaEmpleado } from "../../domain/entities/empleado";
import {
  actualizarIdiomasAction,
  listarIdiomasCatalogoAction,
} from "../../infrastructure/actions/personal-actions";
import { idiomasEntradaSchema, MAX_IDIOMAS_EMPLEADO, OTRO_IDIOMA_MAX } from "../schema/schema-empleado";

export const NIVELES_IDIOMA: ReadonlyArray<readonly [string, string]> = [
  ["BIEN", "Bien"],
  ["REGULAR", "Regular"],
  ["POCO", "Poco"],
];
const OTRO = "otro";

interface Fila {
  /** Id del catálogo (texto), `"otro"` (nombre libre) o `""` (sin elegir). */
  idioma: string;
  otro: string;
  nivel: string;
}

const aFilas = (idiomas: IdiomaEmpleado[] | undefined): Fila[] =>
  (idiomas ?? []).map((i) => ({
    idioma: i.idiomaId ? String(i.idiomaId) : OTRO,
    otro: i.otroIdioma,
    nivel: i.nivel,
  }));

interface FormIdiomasUpdateDialogProps {
  cedula: string;
  idiomas: IdiomaEmpleado[] | undefined;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

/** RR. HH. corrige los idiomas del trabajador (la lista enviada reemplaza a la actual; vacía = ninguno). */
export default function FormIdiomasUpdateDialog({
  cedula,
  idiomas,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: FormIdiomasUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [filas, setFilas] = useState<Fila[]>(aFilas(idiomas));
  const [catalogo, setCatalogo] = useState<{ id: number; nombre: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const alCambiarApertura = (abierto: boolean) => {
    if (abierto) {
      setFilas(aFilas(idiomas));
      setError(null);
      void listarIdiomasCatalogoAction().then((r) => {
        if ("idiomas" in r) setCatalogo(r.idiomas);
        else setError(r.error);
      });
    }
    setOpen(abierto);
  };

  const cambiar = (indice: number, parcial: Partial<Fila>) =>
    setFilas((actuales) => actuales.map((f, i) => (i === indice ? { ...f, ...parcial } : f)));

  const guardar = () => {
    const entrada: EntradaIdioma[] = filas.map((f) => ({
      idiomaId: f.idioma && f.idioma !== OTRO ? Number(f.idioma) : null,
      otroIdioma: f.idioma === OTRO ? f.otro.trim().replace(/\s+/g, " ") : "",
      nivel: f.nivel,
    }));
    if (filas.some((f) => !f.idioma || (f.idioma === OTRO && !f.otro.trim()))) {
      setError("Elija el idioma de cada fila o escriba su nombre.");
      return;
    }
    const valido = idiomasEntradaSchema.safeParse(entrada);
    if (!valido.success) {
      setError(valido.error.issues[0]?.message ?? "Revise los idiomas.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const resultado = await actualizarIdiomasAction(cedula, valido.data);
      if (resultado && "error" in resultado) {
        setError(resultado.error);
        toast.error(resultado.error);
        return;
      }
      toast.success("Idiomas actualizados exitosamente");
      setOpen(false);
      onGuardado();
    });
  };

  return (
    <Dialog open={open} onOpenChange={alCambiarApertura}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Idiomas del trabajador</DialogTitle>
          <DialogDescription>
            Indique los idiomas que domina (hasta {MAX_IDIOMAS_EMPLEADO}). Si no está en la lista, elija «Otro» y escríbalo.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded bg-red-100 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {filas.length === 0 && <p className="text-sm text-muted-foreground">Sin idiomas registrados.</p>}
        <ul className="flex flex-col gap-3" aria-label="Idiomas">
          {filas.map((f, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Label htmlFor={`idioma-${i}`}>Idioma</Label>
                  <Select value={f.idioma} onValueChange={(v) => cambiar(i, { idioma: v })}>
                    <SelectTrigger id={`idioma-${i}`} className="w-full">
                      <SelectValue placeholder="Elija un idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogo.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTRO}>Otro (escribirlo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar el idioma ${i + 1}`}
                  className="text-destructive"
                  onClick={() => setFilas((actuales) => actuales.filter((_, n) => n !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              {f.idioma === OTRO && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`otro-idioma-${i}`}>Nombre del idioma</Label>
                  <Input
                    id={`otro-idioma-${i}`}
                    value={f.otro}
                    maxLength={OTRO_IDIOMA_MAX}
                    autoComplete="off"
                    onChange={(e) => cambiar(i, { otro: e.target.value })}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`nivel-idioma-${i}`}>Nivel</Label>
                <Select value={f.nivel} onValueChange={(v) => cambiar(i, { nivel: v })}>
                  <SelectTrigger id={`nivel-idioma-${i}`} className="w-full">
                    <SelectValue placeholder="Elija el nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIVELES_IDIOMA.map(([valor, texto]) => (
                      <SelectItem key={valor} value={valor}>
                        {texto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          disabled={filas.length >= MAX_IDIOMAS_EMPLEADO}
          onClick={() => setFilas((actuales) => [...actuales, { idioma: "", otro: "", nivel: "" }])}
        >
          <Plus aria-hidden /> Agregar idioma
        </Button>

        <Button type="button" className="w-full cursor-pointer" disabled={isPending} onClick={guardar}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Actualizando Información" : "Guardar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
