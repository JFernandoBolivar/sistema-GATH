import sharp from "sharp";
const S = "C:/Users/josef/OneDrive/Documentos/trabajo/servicios/nextjs/public/";
const G = "public/icons/";
const fuente = S + "icon.png";
const blanco = { r: 255, g: 255, b: 255, alpha: 1 };
const transparente = { r: 0, g: 0, b: 0, alpha: 0 };
// Logo centrado en un lienzo cuadrado, con margen (fracción del lado).
async function cuadrado(lado, margen, fondo, salida) {
  const interior = Math.round(lado * (1 - 2 * margen));
  const logo = await sharp(fuente).resize(interior, interior, { fit: "contain", background: transparente }).toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: fondo } })
    .composite([{ input: logo, gravity: "center" }]).png().toFile(salida);
}
await cuadrado(16, 0.02, transparente, G + "favicon-16.png");
await cuadrado(32, 0.03, transparente, G + "favicon-32.png");
await cuadrado(180, 0.12, blanco, G + "apple-touch-icon.png");
await cuadrado(192, 0.08, transparente, G + "icon-192.png");
await cuadrado(512, 0.08, transparente, G + "icon-512.png");
await cuadrado(512, 0.2, blanco, G + "maskable-512.png");   // zona segura de Android
await cuadrado(48, 0.03, transparente, "public/favicon.png");
console.log("OK");
