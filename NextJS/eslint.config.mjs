import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@next/next/no-img-element": "warn",
      "jsx-a11y/alt-text": "warn",
      "@typescript-eslint/no-unused-expressions": "error",
    },
  },
  // Frontera Onion (AUD3-02-01): dependencias solo hacia adentro.
  // domain <- application <- infrastructure/ui. Se usa no-restricted-imports (nativo)
  // porque eslint-plugin-import no esta instalado como dependencia directa.
  {
    files: ["src/modules/*/domain/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/application", "**/application/**", "**/infrastructure", "**/infrastructure/**", "**/ui", "**/ui/**"],
              message: "Frontera Onion: domain no importa de application, infrastructure ni ui.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/application/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/infrastructure", "**/infrastructure/**", "**/ui", "**/ui/**"],
              message: "Frontera Onion: application no importa de infrastructure ni ui.",
            },
          ],
        },
      ],
    },
  },
  {
    // ui puede usar infrastructure/actions (server actions), no http ni repositories.
    files: ["src/modules/*/ui/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/infrastructure/http", "**/infrastructure/http/**", "**/infrastructure/repositories", "**/infrastructure/repositories/**"],
              message: "Frontera Onion: ui usa infrastructure/actions, no http ni repositories.",
            },
          ],
        },
      ],
    },
  },
  {
    // Deuda documentada (6 violaciones ui -> infrastructure/http, AUD3-02-01).
    // Los *-descargas son servicios de descarga que llaman al cliente HTTP desde el
    // navegador (requieren una server action o ruta nueva: rediseno). Los demas
    // importan solo TIPOS *ApiItem de infrastructure/http (mover a domain/application).
    // Quedan en "warn" por archivo; al corregirlos se quitan de esta lista.
    files: [
      "src/modules/auditoria/ui/services/descargas-auditoria.ts",
      "src/modules/movimientos/ui/services/descargas-movimientos.ts",
      "src/modules/carnetizacion/ui/views/credenciales-externas-view.tsx",
      "src/modules/carnetizacion/ui/views/lote-credenciales-view.tsx",
      "src/modules/movimientos/ui/cambiar-pasivo-page.tsx",
      "src/modules/personal/ui/reportes-error/reportes-error-page.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["**/infrastructure/http", "**/infrastructure/http/**", "**/infrastructure/repositories", "**/infrastructure/repositories/**"],
              message: "Frontera Onion (deuda documentada): ui usa infrastructure/actions, no http ni repositories.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Utilidades de Node (CommonJS), no forman parte de la app.
      "scripts/**",
    ],
  },
];

export default eslintConfig;
