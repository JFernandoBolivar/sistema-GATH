/**
 * Caso de uso y utilidades para el diseñador visual de carnet (Reglas R1, R5).
 * Genera la vista previa interactiva en cliente equivalente al legado.
 */
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type { DatosCarnetEmpleadoDTO, VistaPreviaCarnetDTO } from "../dtos/carnet-dto";

/**
 * Trunca el nombre completo según la regla del legado:
 * Si tiene más de 3 palabras, toma los 2 primeros nombres y los 2 últimos apellidos.
 */
export function truncarNombre(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 3) return nombreCompleto.trim();
  const nombres = partes.slice(0, 2);
  const apellidos = partes.slice(-2);
  return [...nombres, ...apellidos].join(" ");
}

export interface GenerarHtmlVistaPreviaInput {
  cedula: string;
  nombreCompleto: string;
  codigo?: string;
  cargo?: string;
  departamento?: string;
  fotoUrl?: string | null;
  plantillaUrl?: string | null;
}

/**
 * Escapa caracteres especiales en cadenas de texto para prevenir inyección HTML / XSS (OWASP A03 / C1).
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitiza URLs para prevenir ataques mediante esquemas no seguros (ej. javascript:).
 */
export function sanitizeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^(?:https?:\/\/|\/|data:image\/)/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Genera el markup HTML autocontenido con las proporciones físicas
 * de una tarjeta de identificación vertical CR80 (55mm x 85.6mm).
 * Aplica escape HTML estricto a todos los campos para neutralizar XSS.
 */
export function generarHtmlVistaPrevia(datos: GenerarHtmlVistaPreviaInput): string {
  const cedula = escapeHtml(datos.cedula.trim() || "00000000");
  const nombre = escapeHtml((datos.nombreCompleto.trim() || "NOMBRE DEL TITULAR").toUpperCase());
  const cargo = escapeHtml((datos.cargo?.trim() || "CARGO NO ASIGNADO").toUpperCase());
  const departamento = escapeHtml((datos.departamento?.trim() || "DIRECCIÓN GENERAL").toUpperCase());
  const codigo = datos.codigo?.trim() ? escapeHtml(datos.codigo.trim()) : undefined;
  const fotoUrl = sanitizeUrl(datos.fotoUrl);
  const plantillaUrl = sanitizeUrl(datos.plantillaUrl);

  const bgStyle = plantillaUrl
    ? `background-image: url('${plantillaUrl}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%);`;

  const fotoMarkup = fotoUrl
    ? `<img src="${fotoUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Fotografía" />`
    : `<div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #f1f5f9; color: #64748b;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        <span style="font-size: 8px; font-weight: 700; margin-top: 3px; letter-spacing: 0.5px;">FOTO</span>
      </div>`;

  const headerInstitucional = !plantillaUrl
    ? `<div style="position: absolute; top: 0; left: 0; right: 0; height: 56px; background: linear-gradient(135deg, #001f3f 0%, #003366 100%); border-bottom: 2px solid #d4af37; padding: 6px 8px; text-align: center; box-sizing: border-box; z-index: 2;">
        <div style="color: #ffffff; font-size: 6.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">República Bolivariana de Venezuela</div>
        <div style="color: #cbd5e1; font-size: 5.5px; font-weight: 600; text-transform: uppercase; margin-top: 1px;">Comisión Nacional de Telecomunicaciones</div>
        <div style="color: #ffd700; font-size: 11px; font-weight: 900; letter-spacing: 1px; margin-top: 2px;">CONATEL</div>
      </div>`
    : "";

  const qrSvg = `<svg width="34" height="34" viewBox="0 0 24 24" fill="#001f3f" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M3 3H10V10H3V3ZM5 5H8V8H5V5Z" />
    <path fill-rule="evenodd" clip-rule="evenodd" d="M14 3H21V10H14V3ZM16 5H19V8H16V5Z" />
    <path fill-rule="evenodd" clip-rule="evenodd" d="M3 14H10V21H3V14ZM5 16H8V19H5V16Z" />
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
  </svg>`;

  return `
    <div style="display: flex; justify-content: center; padding: 6px;">
      <div style="position: relative; width: 280px; height: 436px; border: 2px solid #003366; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 31, 63, 0.2), 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; ${bgStyle} font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; user-select: none;">
        ${headerInstitucional}

        <!-- Marco de Fotografía -->
        <div style="position: absolute; top: 68px; left: 50%; transform: translateX(-50%); width: 96px; height: 116px; border: 2.2px solid #003366; border-radius: 6px; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15); overflow: hidden; z-index: 3;">
          ${fotoMarkup}
        </div>

        <!-- Bloque de Datos del Empleado -->
        <div style="position: absolute; top: 196px; left: 10px; right: 10px; text-align: center; z-index: 3; display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 11px; font-weight: 800; color: #002244; text-transform: uppercase; line-height: 1.25; margin-bottom: 3px; max-height: 38px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${nombre}
          </div>
          <div style="font-size: 10px; font-weight: 700; color: #1e293b; letter-spacing: 0.5px; margin-bottom: 5px;">
            C.I: ${cedula}
          </div>
          <div style="font-size: 8.5px; font-weight: 700; color: #003366; text-transform: uppercase; line-height: 1.2; margin-bottom: 3px; max-height: 30px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${cargo}
          </div>
          <div style="font-size: 7.5px; font-weight: 600; color: #475569; text-transform: uppercase; line-height: 1.2; max-height: 28px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${departamento}
          </div>
          ${codigo ? `<div style="font-size: 7px; font-weight: 600; color: #64748b; margin-top: 2px;">CÓD: ${codigo}</div>` : ""}
        </div>

        <!-- Bloque Inferior: QR + Sello de Seguridad -->
        <div style="position: absolute; bottom: 10px; left: 12px; right: 12px; height: 50px; display: flex; align-items: center; justify-content: space-between; z-index: 3;">
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
              ${qrSvg}
            </div>
            <span style="font-size: 5.5px; font-weight: 700; color: #64748b; margin-top: 1px;">CI: ${cedula}</span>
          </div>

          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
            <span style="padding: 2px 6px; background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: #ffd700; font-size: 6px; font-weight: 800; border-radius: 3px; letter-spacing: 0.5px; border: 0.5px solid #d4af37; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
              GATH • IDENTIDAD
            </span>
            <span style="font-size: 5.5px; color: #475569; font-weight: 600;">
              CARNET INSTITUCIONAL
            </span>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

/**
 * Caso de uso: consulta los datos del empleado requeridos para el diseñador de carnet.
 */
export async function obtenerDatosEmpleadoParaCarnet(
  repo: RepoCarnetizacion,
  cedula: string
): Promise<DatosCarnetEmpleadoDTO | null> {
  const entidad = await repo.obtenerDatosEmpleado(cedula);
  if (!entidad) return null;
  return {
    cedula: entidad.cedula,
    nombres: entidad.nombres,
    apellidos: entidad.apellidos,
    nombreCompleto: entidad.nombreCompleto,
    codigo: entidad.codigo,
    cargo: entidad.cargo,
    departamento: entidad.departamento,
    fotoUrl: entidad.fotoUrl,
  };
}

/**
 * Caso de uso: construye el DTO completo de vista previa de carnet.
 */
export function construirVistaPreviaCarnet(
  datos: GenerarHtmlVistaPreviaInput
): VistaPreviaCarnetDTO {
  return {
    cedula: datos.cedula,
    nombreCompleto: datos.nombreCompleto,
    codigo: datos.codigo,
    cargo: datos.cargo,
    departamento: datos.departamento,
    fotoUrl: datos.fotoUrl,
    plantillaUrl: datos.plantillaUrl,
    htmlVistaPrevia: generarHtmlVistaPrevia(datos),
  };
}
