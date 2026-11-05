export interface OpcionesReintento {
  intentosMaximos?: number;
  demoraBaseMs?: number;
  factorBackoff?: number;
  onIntento?: (intento: number, total: number, demoraMs: number) => void;
  pausar?: (demoraMs: number) => Promise<void>;
}

const sleepPorDefecto = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta una operación asíncrona reintentando si falla o si la condición `debeReintentar` se cumple.
 * Aplica backoff exponencial para evitar saturación en conexiones intermitentes.
 */
export async function ejecutarConReintento<T>(
  operacion: (intento: number) => Promise<T>,
  debeReintentar: (resultadoOError: T | unknown) => boolean,
  opciones?: OpcionesReintento,
): Promise<T> {
  const max = opciones?.intentosMaximos ?? 3;
  const base = opciones?.demoraBaseMs ?? 1000;
  const factor = opciones?.factorBackoff ?? 2;
  const pausar = opciones?.pausar ?? sleepPorDefecto;

  let ultimoResultado: T | unknown;

  for (let intento = 1; intento <= max; intento++) {
    try {
      const res = await operacion(intento);
      if (!debeReintentar(res)) {
        return res;
      }
      ultimoResultado = res;
    } catch (e: unknown) {
      ultimoResultado = e;
      if (!debeReintentar(e)) {
        throw e;
      }
    }

    if (intento < max) {
      const demora = base * Math.pow(factor, intento - 1);
      opciones?.onIntento?.(intento + 1, max, demora);
      await pausar(demora);
    }
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ultimoResultado as T;
}
