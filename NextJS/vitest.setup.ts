import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// `@/lib/utils` (cn) arrastra el cliente HTTP legado y con él `next-auth`, que no resuelve en jsdom.
// Ningún test de UI necesita red: se sustituye por un módulo vacío.
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn(), refreshTokens: vi.fn() }));
