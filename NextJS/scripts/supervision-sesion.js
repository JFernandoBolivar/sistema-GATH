const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const LOG_FILE = "/tmp/supervision-frontend.log";
const BASE_URL = process.env.APP_URL || "http://localhost:3001";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "usuario.prueba.e2e@conatel.gob.ve";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "E2eSmokeTest!2026";

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;
  process.stdout.write(formattedMessage);
  try {
    fs.appendFileSync(LOG_FILE, formattedMessage);
  } catch (err) {
    process.stderr.write(`Error escribiendo en log: ${err.message}\n`);
  }
}

async function main() {
  fs.writeFileSync(LOG_FILE, `=== SUPERVISIÓN FRONTEND GATH INICIADA ===\n`);
  writeLog(`Servidor X DISPLAY: ${process.env.DISPLAY || "NO DEFINIDO"}`);
  writeLog(`Objetivo: ${BASE_URL}/login`);
  writeLog(`Usuario: ${EMAIL}`);

  writeLog("Lanzando Chromium en modo headed (headless: false)...");

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1440,900",
      "--start-maximized",
    ],
  });

  const context = await browser.newContext({
    viewport: null, // Tamaño completo de la ventana
  });

  function setupPageSupervision(page, pageIndex = 1) {
    const prefix = `[Tab #${pageIndex}]`;
    writeLog(`${prefix} Supervisando pestaña: ${page.url() || "about:blank"}`);

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      const locStr = location.url ? ` (${path.basename(location.url)}:${location.lineNumber})` : "";
      writeLog(`${prefix} [CONSOLE ${type.toUpperCase()}] ${text}${locStr}`);
    });

    page.on("pageerror", (error) => {
      writeLog(`${prefix} [PAGE ERROR] ${error.message}\n${error.stack || ""}`);
    });

    page.on("response", (response) => {
      const status = response.status();
      const url = response.url();
      const method = response.request().method();
      if (status >= 400) {
        writeLog(`${prefix} [HTTP ${status} ERROR] ${method} ${url} - ${response.statusText()}`);
      }
    });

    page.on("crash", () => {
      writeLog(`${prefix} [CRASH] La página se cerró abruptamente.`);
    });

    page.on("close", () => {
      writeLog(`${prefix} Pestaña cerrada.`);
    });
  }

  let tabCount = 1;
  const initialPage = await context.newPage();
  setupPageSupervision(initialPage, tabCount);

  context.on("page", (newPage) => {
    tabCount += 1;
    setupPageSupervision(newPage, tabCount);
  });

  try {
    writeLog(`Navegando hacia ${BASE_URL}/login...`);
    await initialPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    writeLog("Página de login cargada en el navegador.");

    writeLog("Esperando campos de formulario de login...");
    await initialPage.waitForSelector("#usuario", { timeout: 15000 });

    writeLog("Completando credenciales del usuario sintético...");
    await initialPage.fill("#usuario", EMAIL);
    await initialPage.fill("#password", PASSWORD);

    writeLog("Enviando formulario (click en 'Ingresar al Sistema')...");
    await initialPage.click('button[type="submit"]');

    writeLog("Esperando redirección post-login...");
    await initialPage.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });

    writeLog(`>>> SESIÓN INICIADA EXITOSAMENTE. URL actual: ${initialPage.url()} <<<`);
    writeLog(">>> CONTROL TOTAL CEDIDO AL USUARIO HUMANO. Supervisando pasivamente en background. <<<");
  } catch (error) {
    writeLog(`[ALERTA DURANTE LOGIN] ${error.message}`);
    writeLog("Dejando la ventana abierta para inspección manual por el usuario.");
  }

  // Mantener el proceso Node.js vivo indefinidamente mientras el navegador no se cierre
  const keepAliveInterval = setInterval(() => {
    // Keep event loop active
  }, 10000);

  const cleanup = async (signal) => {
    writeLog(`Señal ${signal} recibida. Finalizando supervisión...`);
    clearInterval(keepAliveInterval);
    await browser.close().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGTERM", () => cleanup("SIGTERM"));
  process.on("SIGHUP", () => {
    writeLog("SIGHUP recibido (sesión de shell terminada); manteniendo navegador activo.");
  });

  await new Promise((resolve) => {
    browser.on("disconnected", () => {
      writeLog("El navegador fue cerrado por el usuario. Finalizando script.");
      clearInterval(keepAliveInterval);
      resolve();
    });
  });
}

main().catch((err) => {
  writeLog(`[FATAL] Error en script de supervisión: ${err.message}\n${err.stack || ""}`);
  process.exit(1);
});
