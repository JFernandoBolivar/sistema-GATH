"use client";

import { useId, useState } from "react";
import useSWR from "swr";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import {
  MAX_DIAS_RECORDATORIO,
  DIAS_RECORDATORIO_RESPALDO,
  describirDiaRecordatorio,
  normalizarDiasRecordatorio,
} from "../../domain/services/reglas";
import { getDiasRecordatorioSugeridosAction } from "@/modules/configuracion/infrastructure/actions/parametros-actions";

interface Props {
  valor: readonly number[];
  onCambiar: (dias: number[]) => void;
  error?: string;
}

/**
 * Días de recordatorio antes del cierre: opciones sugeridas que se marcan o desmarcan y un
 * campo para agregar otro día. Sin marcar ninguno = sin recordatorios.
 */
export function SelectorDiasRecordatorio({ valor, onCambiar, error }: Props) {
  const base = useId();
  const [otro, setOtro] = useState("");
  const [errorOtro, setErrorOtro] = useState<string | null>(null);
  // D9/D11: los días sugeridos son un parámetro del sistema; se leen del servidor
  // y, si la llamada falla o aún carga, se usan los de respaldo del dominio.
  const { data: sugeridos } = useSWR(
    "config-dias-recordatorio-fe-de-vida",
    () => getDiasRecordatorioSugeridosAction(),
    { fallbackData: [...DIAS_RECORDATORIO_RESPALDO], shouldRetryOnError: false },
  );
  const diasSugeridos =
    Array.isArray(sugeridos) && sugeridos.length > 0
      ? sugeridos
      : DIAS_RECORDATORIO_RESPALDO;
  const opciones = normalizarDiasRecordatorio([...diasSugeridos, ...valor]);

  function alternar(dia: number, marcado: boolean) {
    onCambiar(marcado ? [...valor, dia] : valor.filter((d) => d !== dia));
  }

  function agregarOtro() {
    const n = Number(otro);
    if (!/^\d+$/.test(otro.trim()) || n < 1 || n > MAX_DIAS_RECORDATORIO) {
      setErrorOtro(`Ingrese un número de días entre 1 y ${MAX_DIAS_RECORDATORIO}.`);
      return;
    }
    setErrorOtro(null);
    setOtro("");
    onCambiar([...valor, n]);
  }

  const idAyuda = `${base}-ayuda`;
  const idErrorOtro = `${base}-otro-error`;
  const idError = `${base}-error`;

  return (
    <fieldset
      className="flex flex-col gap-3"
      aria-describedby={`${idAyuda}${error ? ` ${idError}` : ""}`}
    >
      <legend className="text-base font-medium">Recordatorios antes del cierre</legend>
      <p id={idAyuda} className="text-sm text-muted-foreground">
        Se avisará por el sistema y por correo a quien aún no haya enviado su fe de vida. Si no
        marca ninguno, no se envían recordatorios.
      </p>
      <div className="flex flex-wrap gap-2">
        {opciones.map((dia) => {
          const marcado = valor.includes(dia);
          return (
            <Toggle
              key={dia}
              variant="outline"
              pressed={marcado}
              onPressedChange={(p) => alternar(dia, p)}
              className="min-h-11 px-3 text-base data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {marcado ? <Check aria-hidden /> : null}
              {describirDiaRecordatorio(dia)}
            </Toggle>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${base}-otro`} className="text-sm font-medium">
          Agregar otro día
        </label>
        <div className="flex gap-2">
          <Input
            id={`${base}-otro`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DIAS_RECORDATORIO}
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarOtro();
              }
            }}
            aria-invalid={errorOtro ? true : undefined}
            aria-describedby={errorOtro ? idErrorOtro : undefined}
            className="max-w-32"
            placeholder="Días"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={agregarOtro}
            disabled={!otro.trim()}
          >
            <Plus aria-hidden /> Agregar
          </Button>
        </div>
        {errorOtro ? (
          <p id={idErrorOtro} role="alert" className="text-sm font-medium text-danger">
            {errorOtro}
          </p>
        ) : null}
      </div>
      {error ? (
        <p id={idError} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
