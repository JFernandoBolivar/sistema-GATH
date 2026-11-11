import type { OrigenFoto } from "@/shared/components/captura-foto/captura-foto";

export interface FotoLocalAlmacenada {
  solicitudId: string;
  blob: Blob;
  tipo: string;
  nombre: string;
  origen: OrigenFoto;
  guardadoEn: string;
}

const DB_NOMBRE = "gath_fe_de_vida";
const DB_VERSION = 1;
const STORE_FOTOS = "fotos_locales";
/** F2-13: la foto local es un respaldo temporal, no un archivo permanente. */
export const HORAS_VIGENCIA_FOTO_LOCAL = 24;

function vigente(guardadoEn: string | undefined): boolean {
  if (!guardadoEn) return false;
  const fecha = new Date(guardadoEn).getTime();
  if (!Number.isFinite(fecha)) return false;
  return Date.now() - fecha <= HORAS_VIGENCIA_FOTO_LOCAL * 60 * 60 * 1000;
}

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB no está disponible en este entorno."));
      return;
    }
    const peticion = window.indexedDB.open(DB_NOMBRE, DB_VERSION);
    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      if (!db.objectStoreNames.contains(STORE_FOTOS)) {
        db.createObjectStore(STORE_FOTOS, { keyPath: "solicitudId" });
      }
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error ?? new Error("Error al abrir IndexedDB"));
  });
}

/**
 * Guarda la foto capturada o seleccionada en el almacenamiento local del dispositivo (IndexedDB).
 * Permite recuperarla ante pérdida de conexión, cierres involuntarios o recargas de página.
 */
export async function guardarFotoLocal(
  solicitudId: string,
  archivo: File,
  origen: OrigenFoto,
): Promise<boolean> {
  try {
    const db = await abrirDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_FOTOS, "readwrite");
      const store = tx.objectStore(STORE_FOTOS);
      const registro: FotoLocalAlmacenada = {
        solicitudId,
        blob: archivo,
        tipo: archivo.type || "image/jpeg",
        nombre: archivo.name || "fe-de-vida-cedula.jpg",
        origen,
        guardadoEn: new Date().toISOString(),
      };
      const req = store.put(registro);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Recupera la foto guardada localmente para la solicitud indicada si existe.
 */
export async function recuperarFotoLocal(
  solicitudId: string,
): Promise<{ archivo: File; origen: OrigenFoto; guardadoEn: string } | null> {
  try {
    const db = await abrirDb();
    return await new Promise<{ archivo: File; origen: OrigenFoto; guardadoEn: string } | null>(
      (resolve) => {
        const tx = db.transaction(STORE_FOTOS, "readonly");
        const store = tx.objectStore(STORE_FOTOS);
        const req = store.get(solicitudId);
        req.onsuccess = () => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const res = req.result as FotoLocalAlmacenada | undefined;
          if (!res || !res.blob) {
            resolve(null);
            return;
          }
          if (!vigente(res.guardadoEn)) {
            // F2-13: una foto vieja (o de un dispositivo compartido) se descarta.
            store.delete(solicitudId);
            resolve(null);
            return;
          }
          const archivo = new File([res.blob], res.nombre, {
            type: res.tipo,
            lastModified: new Date(res.guardadoEn).getTime(),
          });
          resolve({ archivo, origen: res.origen, guardadoEn: res.guardadoEn });
        };
        req.onerror = () => resolve(null);
      },
    );
  } catch {
    return null;
  }
}

/**
 * Elimina la foto guardada localmente tras una subida exitosa al servidor.
 */
export async function eliminarFotoLocal(solicitudId: string): Promise<boolean> {
  try {
    const db = await abrirDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_FOTOS, "readwrite");
      const store = tx.objectStore(STORE_FOTOS);
      const req = store.delete(solicitudId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
