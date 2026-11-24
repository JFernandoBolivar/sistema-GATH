/** Entrega al navegador un PDF recibido como base64 (las Server Actions no devuelven binarios). */
export function entregarPdf(base64: string, nombre: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre un PDF recibido como base64 en otra pestaña (la ventana se abre antes para que el navegador no la bloquee). */
export function abrirPdf(base64: string, ventana: Window | null): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  if (ventana) ventana.location.href = url;
  else window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
