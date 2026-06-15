"use client";

import { useEffect } from "react";
import { clearAuthCookies } from "#/actions/auth-actions";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (
      error.name === "AuthSessionExpiredError" ||
      error.message?.includes("Sesión expirada")
    ) {
      clearAuthCookies().then(() => {
        window.location.href = "/login";
      });
    }
  }, [error]);

  const handleClearAndReload = async () => {
    await clearAuthCookies();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Error al cargar la aplicación
          </h1>
          <p className="text-slate-300 mb-6 text-sm">
            Ocurrió un error inesperado al cargar la página. Puede ser causado
            por una sesión expirada o datos inconsistentes.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Reintentar
            </button>
            <button
              onClick={handleClearAndReload}
              className="w-full px-4 py-2.5 bg-red-600/80 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Limpiar cookies y volver al inicio
            </button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <details className="mt-6 text-left">
              <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                Detalles del error
              </summary>
              <pre className="mt-2 text-xs text-red-300 bg-black/30 p-3 rounded-lg overflow-auto max-h-32">
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
