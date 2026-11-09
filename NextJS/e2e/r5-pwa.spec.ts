import { expect, test } from "@playwright/test";

test.describe("R-5 — PWA", () => {
  test("manifest con nombre, inicio e íconos institucionales", async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    const respuesta = await request.get("/manifest.webmanifest");
    expect(respuesta.ok()).toBeTruthy();
    const manifest = await respuesta.json();
    expect(manifest.name).toContain("GATH");
    expect(manifest.short_name).toBe("GATH");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#0a2a5e");
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    for (const icon of manifest.icons as Array<{ src: string }>) {
      const asset = await request.get(icon.src);
      expect(asset.ok(), icon.src).toBeTruthy();
    }
  });

  test("service worker y página offline sin cachear datos personales", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/login");
    await page.waitForFunction(
      async () => {
        if (!("serviceWorker" in navigator)) return false;
        await navigator.serviceWorker.ready;
        return true;
      },
      undefined,
      { timeout: 60_000 },
    );
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, {
      timeout: 60_000,
    });

    await page.waitForFunction(
      async () => Boolean(await caches.match("/offline")),
      undefined,
      { timeout: 30_000 },
    );
    await context.setOffline(true);
    try {
      await page.goto("/dashboard").catch(() => {});
      await expect(page.getByRole("heading", { name: /sin conexión/i })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole("button", { name: /reintentar/i })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    const cacheado = await page.evaluate(async () => {
      const nombres = await caches.keys();
      const entradas: string[] = [];
      for (const nombre of nombres) {
        const cache = await caches.open(nombre);
        entradas.push(...(await cache.keys()).map((r) => new URL(r.url).pathname));
      }
      return entradas;
    });
    expect(cacheado.some((ruta) => ruta.startsWith("/api/"))).toBe(false);
  });
});
