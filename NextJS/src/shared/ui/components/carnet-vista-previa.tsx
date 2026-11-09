"use client";

/**
 * Componente React nativo para la vista previa del carnet institucional (CR80 vertical).
 * Sustituye el uso de dangerouslySetInnerHTML eliminando vectores de XSS (OWASP A03 / C1)
 * mediante renderizado declarativo con auto-escape estricto de React.
 */
import React from "react";

export interface CarnetVistaPreviaProps {
  cedula: string;
  nombreCompleto: string;
  codigo?: string;
  cargo?: string;
  departamento?: string;
  fotoUrl?: string | null;
  plantillaUrl?: string | null;
  className?: string;
}

/**
 * Sanitiza URLs para prevenir ataques de pseudo-protocolo (ej. javascript: o vbscript:).
 */
export function sanitizeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^(?:https?:\/\/|\/|data:image\/)/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function CarnetVistaPrevia({
  cedula,
  nombreCompleto,
  codigo,
  cargo,
  departamento,
  fotoUrl,
  plantillaUrl,
  className = "",
}: CarnetVistaPreviaProps) {
  const cedulaTexto = cedula.trim() || "00000000";
  const nombreTexto = (nombreCompleto.trim() || "NOMBRE DEL TITULAR").toUpperCase();
  const cargoTexto = (cargo?.trim() || "CARGO NO ASIGNADO").toUpperCase();
  const deptoTexto = (departamento?.trim() || "DIRECCIÓN GENERAL").toUpperCase();
  const codigoTexto = codigo?.trim();

  const fotoSegura = sanitizeUrl(fotoUrl);
  const plantillaSegura = sanitizeUrl(plantillaUrl);

  return (
    <div className={`flex justify-center p-1.5 ${className}`}>
      <div
        className="relative overflow-hidden select-none"
        style={{
          width: "280px",
          height: "436px",
          border: "2px solid #003366",
          borderRadius: "12px",
          boxShadow: "0 8px 24px rgba(0, 31, 63, 0.2), 0 2px 8px rgba(0,0,0,0.08)",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxSizing: "border-box",
          ...(plantillaSegura
            ? {
                backgroundImage: `url('${plantillaSegura}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background: "linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)",
              }),
        }}
      >
        {/* Cabecera Institucional (solo cuando no hay plantilla personalizada) */}
        {!plantillaSegura && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "56px",
              background: "linear-gradient(135deg, #001f3f 0%, #003366 100%)",
              borderBottom: "2px solid #d4af37",
              padding: "6px 8px",
              textAlign: "center",
              boxSizing: "border-box",
              zIndex: 2,
            }}
          >
            <div
              style={{
                color: "#ffffff",
                fontSize: "6.5px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              República Bolivariana de Venezuela
            </div>
            <div
              style={{
                color: "#cbd5e1",
                fontSize: "5.5px",
                fontWeight: 600,
                textTransform: "uppercase",
                marginTop: "1px",
              }}
            >
              Comisión Nacional de Telecomunicaciones
            </div>
            <div
              style={{
                color: "#ffd700",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "1px",
                marginTop: "2px",
              }}
            >
              CONATEL
            </div>
          </div>
        )}

        {/* Marco de Fotografía */}
        <div
          style={{
            position: "absolute",
            top: "68px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "96px",
            height: "116px",
            border: "2.2px solid #003366",
            borderRadius: "6px",
            backgroundColor: "#ffffff",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
            overflow: "hidden",
            zIndex: 3,
          }}
        >
          {fotoSegura ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fotoSegura}
              alt="Fotografía del titular"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f1f5f9",
                color: "#64748b",
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              <span
                style={{
                  fontSize: "8px",
                  fontWeight: 700,
                  marginTop: "3px",
                  letterSpacing: "0.5px",
                }}
              >
                FOTO
              </span>
            </div>
          )}
        </div>

        {/* Bloque de Datos del Empleado (Auto-escapados por JSX) */}
        <div
          style={{
            position: "absolute",
            top: "196px",
            left: "10px",
            right: "10px",
            textAlign: "center",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#002244",
              textTransform: "uppercase",
              lineHeight: 1.25,
              marginBottom: "3px",
              maxHeight: "38px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {nombreTexto}
          </div>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#1e293b",
              letterSpacing: "0.5px",
              marginBottom: "5px",
            }}
          >
            C.I: {cedulaTexto}
          </div>
          <div
            style={{
              fontSize: "8.5px",
              fontWeight: 700,
              color: "#003366",
              textTransform: "uppercase",
              lineHeight: 1.2,
              marginBottom: "3px",
              maxHeight: "30px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {cargoTexto}
          </div>
          <div
            style={{
              fontSize: "7.5px",
              fontWeight: 600,
              color: "#475569",
              textTransform: "uppercase",
              lineHeight: 1.2,
              maxHeight: "28px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {deptoTexto}
          </div>
          {codigoTexto && (
            <div
              style={{
                fontSize: "7px",
                fontWeight: 600,
                color: "#64748b",
                marginTop: "2px",
              }}
            >
              CÓD: {codigoTexto}
            </div>
          )}
        </div>

        {/* Bloque Inferior: QR + Sello Institucional */}
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "12px",
            right: "12px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 3,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                padding: "2px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="#001f3f"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M3 3H10V10H3V3ZM5 5H8V8H5V5Z" />
                <path fillRule="evenodd" clipRule="evenodd" d="M14 3H21V10H14V3ZM16 5H19V8H16V5Z" />
                <path fillRule="evenodd" clipRule="evenodd" d="M3 14H10V21H3V14ZM5 16H8V19H5V16Z" />
                <rect x="6" y="6" width="1" height="1" fill="#001f3f" />
                <rect x="17" y="6" width="1" height="1" fill="#001f3f" />
                <rect x="6" y="17" width="1" height="1" fill="#001f3f" />
                <rect x="12" y="4" width="1" height="4" fill="#001f3f" />
                <rect x="12" y="12" width="2" height="2" fill="#001f3f" />
                <rect x="16" y="12" width="2" height="1" fill="#001f3f" />
                <rect x="19" y="13" width="2" height="2" fill="#001f3f" />
                <rect x="12" y="16" width="1" height="4" fill="#001f3f" />
                <rect x="15" y="15" width="2" height="2" fill="#001f3f" />
                <rect x="18" y="18" width="3" height="3" fill="#001f3f" />
                <rect x="14" y="19" width="2" height="2" fill="#001f3f" />
              </svg>
            </div>
            <span
              style={{
                fontSize: "5.5px",
                fontWeight: 700,
                color: "#64748b",
                marginTop: "1px",
              }}
            >
              CI: {cedulaTexto}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "3px",
            }}
          >
            <span
              style={{
                padding: "2px 6px",
                background: "linear-gradient(135deg, #001f3f 0%, #003366 100%)",
                color: "#ffd700",
                fontSize: "6px",
                fontWeight: 800,
                borderRadius: "3px",
                letterSpacing: "0.5px",
                border: "0.5px solid #d4af37",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            >
              GATH • IDENTIDAD
            </span>
            <span style={{ fontSize: "5.5px", color: "#475569", fontWeight: 600 }}>
              CARNET INSTITUCIONAL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
